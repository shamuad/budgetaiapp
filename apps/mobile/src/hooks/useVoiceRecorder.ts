import { i18n } from '@budgetaiapp/shared';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

// Still mpeg4/aac on both platforms, so the container stays audio/mp4.
const MIME_TYPE = 'audio/mp4';

// Android upmixes the stereo 44.1 kHz preset in device-specific ways on single-microphone
// hardware, so speech is captured as mono 16 kHz there. iOS keeps the preset untouched:
// those values land directly in AVAudioRecorder's settings, where the downsampled
// combination is rejected and prepareToRecord() fails.
const SPEECH_CAPTURE_OVERRIDES =
  Platform.OS === 'android' ? { sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 } : null;

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  ...SPEECH_CAPTURE_OVERRIDES,
  isMeteringEnabled: true,
};

// Metering is dBFS: 0 is loud, around -160 is silence. iOS reports a windowed average
// (averagePower), Android reports the peak since the last read (getMaxAmplitude), which
// runs systematically hotter, so the speech threshold cannot be shared between them.
// Erring low is deliberate: a threshold that is too high mistakes speech for silence and
// truncates the sentence, while one that is too low only delays the automatic stop.
const SPEECH_METERING_THRESHOLD = Platform.OS === 'android' ? -35 : -40;
const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 15000;
const POLL_INTERVAL_MS = 200;

// Counted in polls rather than wall-clock time: each reading describes one poll window,
// so timer drift must not be mistaken for a longer silence than was actually recorded.
const SILENCE_STOP_POLLS = Math.round(1200 / POLL_INTERVAL_MS);

export type VoiceRecording = {
  base64: string;
  mimeType: string;
};

type VoiceRecorderOptions = {
  onFinish: (recording: VoiceRecording) => void | Promise<void>;
  onError: (error: unknown) => void;
};

/**
 * Records a short voice note and hands it back encoded, stopping on its own once
 * the speaker falls silent. Metering is only polled while a recording is running.
 */
export function useVoiceRecorder({ onFinish, onError }: VoiceRecorderOptions) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const callbacksRef = useRef({ onFinish, onError });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const silentPollsRef = useRef(0);

  // Keeps the callbacks fresh without making start/stop change identity every render.
  useEffect(() => {
    callbacksRef.current = { onFinish, onError };
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finish = useCallback(
    async (deliver: boolean) => {
      const wasActive = recorder.isRecording || pollRef.current !== null;

      if (finishingRef.current || (!wasActive && !deliver)) {
        return;
      }

      finishingRef.current = true;
      stopPolling();
      setIsRecording(false);
      setIsProcessing(deliver);
      heardSpeechRef.current = false;
      silentPollsRef.current = 0;

      try {
        if (recorder.isRecording) {
          await recorder.stop();
        }

        await setAudioModeAsync({ allowsRecording: false });

        if (!deliver) {
          return;
        }

        if (!recorder.uri) {
          throw new Error(i18n.t('addTransaction.aiError'));
        }

        const base64 = await new File(recorder.uri).base64();

        await callbacksRef.current.onFinish({ base64, mimeType: MIME_TYPE });
      } catch (error) {
        if (deliver) {
          callbacksRef.current.onError(error);
        }
      } finally {
        finishingRef.current = false;
        setIsProcessing(false);
      }
    },
    [recorder, stopPolling]
  );

  const checkForSilence = useCallback(() => {
    if (finishingRef.current) {
      return;
    }

    const { durationMillis, metering } = recorder.getStatus();

    if (durationMillis >= MAX_RECORDING_MS) {
      void finish(true);
      return;
    }

    if (durationMillis < MIN_RECORDING_MS || metering === undefined) {
      return;
    }

    if (metering > SPEECH_METERING_THRESHOLD) {
      heardSpeechRef.current = true;
      silentPollsRef.current = 0;
      return;
    }

    // Only a pause that follows actual speech counts as the end of the sentence.
    if (!heardSpeechRef.current) {
      return;
    }

    silentPollsRef.current += 1;

    if (silentPollsRef.current >= SILENCE_STOP_POLLS) {
      void finish(true);
    }
  }, [finish, recorder]);

  const start = useCallback(async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        callbacksRef.current.onError(new Error(i18n.t('addTransaction.aiMicDenied')));
        return;
      }

      finishingRef.current = false;
      heardSpeechRef.current = false;
      silentPollsRef.current = 0;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      stopPolling();
      pollRef.current = setInterval(checkForSilence, POLL_INTERVAL_MS);
    } catch (error) {
      callbacksRef.current.onError(error);
    }
  }, [checkForSilence, recorder, stopPolling]);

  const toggle = useCallback(async () => {
    await (isRecording ? finish(true) : start());
  }, [finish, isRecording, start]);

  /** Stops without sending anything to the AI, for when the form is dismissed. */
  const cancel = useCallback(() => finish(false), [finish]);

  useEffect(() => stopPolling, [stopPolling]);

  return { isRecording, isProcessing, toggle, cancel };
}
