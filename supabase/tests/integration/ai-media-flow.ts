import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createClient } from '@supabase/supabase-js';

import type { Asset, Category } from '../../../packages/shared/types/database';
import {
  parseReceiptAIResponse,
  parseTransactionAIResponse,
} from '../../../packages/shared/lib/aiResponse';
import { toISODate } from '../../../packages/shared/lib/valueParsing';

function requiredEnv(name: string) {
  const value = process.env[name];

  assert.ok(value, `${name} is required`);
  return value;
}

const supabaseUrl = requiredEnv('SUPABASE_URL');
const anonKey = requiredEnv('SUPABASE_ANON_KEY');
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const hostname = new URL(supabaseUrl).hostname;
assert.ok(
  hostname === '127.0.0.1' || hostname === 'localhost',
  `Refusing to run the AI integration fixture outside local Supabase: ${hostname}`,
);

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `ai-media-${runId}@example.com`;
const password = 'Valid-Password-123!';
const voiceFixture = Buffer.from('budgree-voice-fixture').toString('base64');
const receiptFixture = Buffer.from('budgree-receipt-fixture').toString('base64');
const testDate = '2026-09-04';
let createdUserId: string | null = null;
let mockFailure: unknown = null;
let mockRequests = 0;

function promptCategories(categories: Category[]) {
  return categories.map(({ id, name, type }) => ({ id, name, type }));
}

function promptAccounts(assets: Asset[]) {
  return assets.map(({ id, name, type, payment_clue }) => ({ id, name, type, payment_clue }));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    contents?: Array<{ parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }>;
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function startGeminiMock(category: Category, asset: Asset) {
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, 'POST');
      assert.match(request.url ?? '', /^\/v1beta\/models\/gemini-3-flash-preview:generateContent$/);
      assert.equal(request.headers['x-goog-api-key'], 'local-integration-test-key');

      const payload = await readBody(request);
      const parts = payload.contents?.[0]?.parts ?? [];
      const media = parts.find((part) => part.inlineData)?.inlineData;
      const prompt = parts.map((part) => part.text ?? '').join('\n');
      let modelText: string;

      if (media?.mimeType === 'audio/mp4') {
        assert.equal(media.data, voiceFixture);
        assert.match(prompt, /The user request is in the attached audio\./);
        assert.match(prompt, /Expense categories: Market\./);
        assert.match(prompt, /Daily Card \(card\)/);

        modelText = JSON.stringify({
          title: 'Albert Heijn',
          amount: 42.5,
          type: 'expense',
          category: category.name,
          account_name: asset.name,
          to_account_name: null,
          asset_symbol: null,
          shares: null,
          unit_price: null,
          currency: 'EUR',
          installments: 1,
          date: testDate,
          action: 'none',
        });
      } else if (media?.mimeType === 'image/png') {
        assert.equal(media.data, receiptFixture);
        assert.match(prompt, new RegExp(`${category.id} \\| Market \\(expense\\)`));
        assert.match(
          prompt,
          new RegExp(`${asset.id} \\| Daily Card \\| card \\| payment_clue: 0718`),
        );

        modelText = JSON.stringify({
          title: 'Albert Heijn',
          amount: 42.5,
          currency: 'EUR',
          date: testDate,
          category_id: category.id,
          account_id: asset.id,
          type: 'expense',
          installments: 1,
        });
      } else {
        assert.fail(`Unexpected media type: ${media?.mimeType ?? 'missing'}`);
      }

      mockRequests += 1;
      sendJson(response, 200, { candidates: [{ content: { parts: [{ text: modelText }] } }] });
    } catch (error) {
      mockFailure = error;
      sendJson(response, 500, { error: { message: 'Local Gemini fixture rejected the request.' } });
    }
  });

  return new Promise<typeof server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(54325, '0.0.0.0', () => resolve(server));
  });
}

async function invoke(accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ask-gemini`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { text?: string; error?: string; message?: string };

  assert.equal(
    response.status,
    200,
    `ask-gemini returned ${response.status}: ${payload.error ?? payload.message ?? 'unknown error'}`,
  );
  assert.ok(payload.text, 'ask-gemini should return model text');

  return payload.text;
}

async function main() {
  let mockServer: Awaited<ReturnType<typeof startGeminiMock>> | null = null;

  try {
    const authClient = createClient(supabaseUrl, anonKey, clientOptions);
    const { data: signup, error: signupError } = await authClient.auth.signUp({ email, password });

    assert.ifError(signupError);
    assert.ok(signup.session?.access_token, 'Local signup should create an authenticated session');
    assert.ok(signup.user?.id, 'Local signup should return a user id');
    createdUserId = signup.user.id;

    const { data: market, error: categoryError } = await authClient
      .from('categories')
      .select('*')
      .eq('name', 'Market')
      .eq('type', 'expense')
      .single<Category>();
    assert.ifError(categoryError);
    assert.ok(market, 'The default Market category should exist');

    const { data: asset, error: assetError } = await authClient
      .from('assets')
      .insert({
        name: 'Daily Card',
        symbol: 'EUR',
        type: 'card',
        icon: '💳',
        payment_clue: '0718',
        quantity: 0,
        purchase_price: 0,
        current_price: 0,
        currency: 'EUR',
        is_credit: false,
      })
      .select('*')
      .single<Asset>();
    assert.ifError(assetError);
    assert.ok(asset, 'The test account should be returned');

    mockServer = await startGeminiMock(market, asset);
    const common = {
      categories: promptCategories([market]),
      accounts: promptAccounts([asset]),
      today: testDate,
      weekday: 'Friday',
    };
    const accessToken = signup.session.access_token;

    const voiceText = await invoke(accessToken, {
      action: 'parse_transaction',
      text: null,
      audio_base64: voiceFixture,
      audio_mime_type: 'audio/mp4',
      ...common,
    });
    const voice = parseTransactionAIResponse(voiceText, [market], [asset], new Date(2026, 0, 1));

    assert.equal(voice.values?.title, 'Albert Heijn');
    assert.equal(voice.values?.amount, 42.5);
    assert.equal(voice.values?.category?.id, market.id);
    assert.equal(voice.values?.asset?.id, asset.id);
    assert.equal(toISODate(voice.values!.date), testDate);

    const receiptText = await invoke(accessToken, {
      action: 'scan_receipt',
      image_base64: receiptFixture,
      image_mime_type: 'image/png',
      ...common,
    });
    const receipt = parseReceiptAIResponse(
      receiptText,
      [market],
      [asset],
      new Date(2026, 0, 1),
    );

    assert.equal(receipt.action, 'none');
    assert.equal(receipt.values?.title, 'Albert Heijn');
    assert.equal(receipt.values?.category?.id, market.id);
    assert.equal(receipt.values?.asset?.id, asset.id);
    assert.equal(receipt.values?.currency, 'EUR');
    assert.equal(mockRequests, 2, 'Both media requests should reach the local Gemini fixture');
    assert.ifError(mockFailure);

    console.log('AI voice and receipt integration passed.');
  } finally {
    if (mockServer) {
      await new Promise<void>((resolve, reject) =>
        mockServer!.close((error) => (error ? reject(error) : resolve())),
      );
    }

    if (createdUserId) {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      assert.ifError(error);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
