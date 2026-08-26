/**
 * Gemini proxy: the only place the API key exists.
 *
 * The mobile app used to hold `EXPO_PUBLIC_GEMINI_API_KEY` and talk to Google
 * directly, which shipped the key inside the JS bundle for anyone to read.
 * The app now posts the same multimodal `parts` here and gets back the raw
 * model text, so `parseTransactionResponse` on the client is untouched.
 *
 * Deploy:  supabase functions deploy ask-gemini
 * Secret:  supabase secrets set GEMINI_API_KEY=...
 */

// `gemini-flash-latest` used to be the primary and is deliberately gone: on this
// key it accepts the connection and then never answers, timing out on every
// probe across repeated rounds while the two below replied in under two seconds.
// The lite model transcribes audio noticeably worse, so it stays the fallback and
// is only reached once the primary has failed.
const MODELS = ['gemini-3-flash-preview', 'gemini-flash-lite-latest'];

// Sampling defaults to temperature 1, which returns a different transcription for
// byte-identical audio. Extraction is not a creative task, so sampling is switched off.
const GENERATION_CONFIG = {
  temperature: 0,
  topP: 1,
  topK: 1,
  responseMimeType: 'application/json',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Worth abandoning this model for the next one instead of failing the request:
 * 429 and 503 mean saturated, and 404 means the version was retired — the standing
 * risk of pinning a preview build rather than a floating `-latest` alias.
 */
const RETRY_NEXT_MODEL_STATUSES = [404, 429, 503];

// A throttled model can hold the connection open for minutes rather than
// refusing outright. Without a ceiling the isolate gets killed by the platform
// first, which loses the logs and returns an unreadable failure to the app.
// Generous next to the ~2s these models take on text, because a receipt image or
// a voice clip is a much heavier prompt. Budget: both models timing out costs
// 60s, inside the 150s wall clock, so the app always gets a readable JSON error
// back instead of an isolate the platform killed mid-request.
const MODEL_TIMEOUT_MS = 30_000;

type InlinePart = { inlineData: { mimeType: string; data: string } };

/** What the app sends: prompt strings, plus base64 audio or receipt images. */
type IncomingPart = string | InlinePart;

type GeminiPart = { text: string } | InlinePart;

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isInlinePart(part: unknown): part is InlinePart {
  const inlineData = (part as InlinePart | null)?.inlineData;

  return (
    typeof inlineData?.mimeType === 'string' &&
    typeof inlineData?.data === 'string' &&
    inlineData.data.length > 0
  );
}

/** Rewrites the client's parts into Gemini's `contents` shape, dropping anything malformed. */
function toGeminiParts(parts: unknown): GeminiPart[] {
  if (!Array.isArray(parts)) {
    return [];
  }

  return (parts as IncomingPart[]).reduce<GeminiPart[]>((accumulated, part) => {
    if (typeof part === 'string' && part.trim()) {
      accumulated.push({ text: part });
    } else if (isInlinePart(part)) {
      accumulated.push({ inlineData: part.inlineData });
    }

    return accumulated;
  }, []);
}

/** The model's answer is a JSON document delivered as text, possibly across several parts. */
function readResponseText(payload: unknown): string {
  const parts = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    ?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => part?.text ?? '')
    .join('')
    .trim();
}

/**
 * The short reason Google gives for a rejection ("API key not valid",
 * "Quota exceeded"). Only `error.message` is forwarded: the rest of the body
 * can quote the request — including receipt images and audio — back at us.
 */
async function readUpstreamMessage(response: Response): Promise<string> {
  const raw = await response.text();

  try {
    const message = (JSON.parse(raw) as { error?: { message?: string } })?.error?.message;

    if (typeof message === 'string' && message) {
      return message;
    }
  } catch {
    // Not JSON: an HTML error page from a proxy in front of the API.
  }

  return `HTTP ${response.status}`;
}

Deno.serve(async (request) => {
  // Deliberately the first statement in the handler: if this line is absent
  // from the logs, the request never reached the function at all and was
  // turned away by the API gateway (a 401 from JWT verification looks exactly
  // like this — "booted" and "shutdown" with nothing in between).
  console.log(`ask-gemini: ${request.method} received`);

  // Preflight has to be answered before anything else can fail, otherwise the
  // real POST is never sent and every error looks like a CORS error.
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  try {
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed', message: `${request.method} is not supported.` }, 405);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      return json(
        { error: 'missing_api_key', message: 'GEMINI_API_KEY is not set on this project.' },
        500,
      );
    }

    let parts: GeminiPart[] = [];

    try {
      const body = await request.json();
      parts = toGeminiParts(body?.parts);
    } catch {
      return json({ error: 'invalid_body', message: 'Expected JSON shaped like { parts: [...] }.' }, 400);
    }

    if (parts.length === 0) {
      return json({ error: 'invalid_body', message: 'No usable prompt parts were sent.' }, 400);
    }

    let lastStatus = 503;
    let lastMessage = 'Every model was busy.';

    for (const model of MODELS) {
      const startedAt = Date.now();
      let response: Response;

      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: GENERATION_CONFIG,
            }),
            signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
          },
        );
      } catch (error) {
        // Almost always the abort above. Giving up on this model and moving to
        // the next one is strictly better than hanging: an isolate killed by the
        // platform drops its buffered logs and answers the app with nothing.
        lastStatus = 504;
        lastMessage = `${model} did not answer within ${MODEL_TIMEOUT_MS / 1000}s.`;

        const reason = error instanceof Error ? error.message : String(error);

        console.error(`Gemini ${model} gave up after ${Date.now() - startedAt}ms: ${reason}`);

        continue;
      }

      console.log(`Gemini ${model} answered ${response.status} in ${Date.now() - startedAt}ms`);

      if (RETRY_NEXT_MODEL_STATUSES.includes(response.status)) {
        lastStatus = response.status;
        lastMessage = await readUpstreamMessage(response);
        continue;
      }

      if (!response.ok) {
        const message = await readUpstreamMessage(response);

        console.error(`Gemini ${model} failed (${response.status}): ${message}`);

        return json({ error: 'upstream_error', message, status: response.status }, 502);
      }

      const text = readResponseText(await response.json());

      if (!text) {
        return json({ error: 'empty_response', message: `${model} returned no text.` }, 502);
      }

      return json({ text }, 200);
    }

    return json({ error: 'model_overloaded', message: lastMessage }, lastStatus);
  } catch (error) {
    // Without this the runtime's own 500 goes out with no CORS headers, which
    // reaches the app as an opaque failure with nothing to read.
    const message = error instanceof Error ? error.message : String(error);

    console.error('ask-gemini crashed:', message);

    return json({ error: 'function_error', message }, 500);
  }
});
