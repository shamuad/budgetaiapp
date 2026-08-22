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
// hardware, so speech is captured as mono 16 kHz there. iOS keeps the preset untouched.
const SPEECH_CAPTURE_OVERRIDES =
  Platform.OS === 'android' ? { sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 } : null;

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  ...SPEECH_CAPTURE_OVERRIDES,
};

const MAX_RECORDING_MS = 60_000;

export type VoiceRecording = {
  base64: string;
  mimeType: string;
};

type VoiceRecorderOptions = {
  onFinish: (recording: VoiceRecording) => void | Promise<void>;
  onError: (error: unknown) => void;
};

/**
 * Records a short voice note for push-to-talk: hold to record, release to deliver.
 */
export function useVoiceRecorder({ onFinish, onError }: VoiceRecorderOptions) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const callbacksRef = useRef({ onFinish, onError });
  const finishingRef = useRef(false);
  const isHeldRef = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbacksRef.current = { onFinish, onError };
  });

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(
    async (deliver: boolean) => {
      const wasActive = recorder.isRecording || isRecording;

      if (finishingRef.current || (!wasActive && !deliver)) {
        return;
      }

      finishingRef.current = true;
      clearMaxTimer();
      setIsRecording(false);
      setIsProcessing(deliver);

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
    [clearMaxTimer, isRecording, recorder]
  );

  const start = useCallback(async () => {
    isHeldRef.current = true;

    const run = async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();

        if (!permission.granted) {
          callbacksRef.current.onError(new Error(i18n.t('addTransaction.aiMicDenied')));
          return;
        }

        if (!isHeldRef.current) {
          return;
        }

        finishingRef.current = false;

        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();

        if (!isHeldRef.current) {
          await finish(false);
          return;
        }

        recorder.record();
        setIsRecording(true);

        maxTimerRef.current = setTimeout(() => {
          isHeldRef.current = false;
          void finish(true);
        }, MAX_RECORDING_MS);
      } catch (error) {
        callbacksRef.current.onError(error);
      }
    };

    startPromiseRef.current = run();
    await startPromiseRef.current;
    startPromiseRef.current = null;
  }, [finish, recorder]);

  const stop = useCallback(async () => {
    isHeldRef.current = false;

    if (startPromiseRef.current) {
      await startPromiseRef.current;
    }

    if (recorder.isRecording) {
      await finish(true);
    }
  }, [finish, recorder]);

  /** Stops without sending anything to the AI, for when the form is dismissed. */
  const cancel = useCallback(() => finish(false), [finish]);

  useEffect(
    () => () => {
      clearMaxTimer();
    },
    [clearMaxTimer]
  );

  return { isRecording, isProcessing, start, stop, cancel };
}
