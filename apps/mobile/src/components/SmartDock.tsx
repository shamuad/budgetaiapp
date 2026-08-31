import { i18n } from '@budgetaiapp/shared';
import { Mic, ScanLine, Send, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorScheme, type ColorTokens } from '../theming';

type DockMode = 'hub' | 'text';

type SmartDockProps = {
  visible: boolean;
  aiInput: string;
  onChangeAiInput: (text: string) => void;
  /** Wired directly to the existing `handleParseText` — untouched AI logic. */
  onSubmitText: () => void | Promise<void>;
  /** Existing `isRecording` state from `useVoiceRecorder`, read-only here. */
  isRecording: boolean;
  /** Existing `isProcessing` state from `useVoiceRecorder` — true while the AI is
   * transcribing/parsing a just-finished voice note, read-only here. */
  isVoiceProcessing: boolean;
  isBusy: boolean;
  /** Existing `startRecording` from `useVoiceRecorder` — push-to-talk, unmodified. */
  onVoicePressIn: () => void;
  /** Existing `stopRecording` from `useVoiceRecorder` — unmodified. */
  onVoicePressOut: () => void;
  onScan: () => void;
};

// Vivid, standard Apple system colors — kept identical across light/dark so
// each action reads as a bold, unmistakable button rather than a muted icon,
// the same way Contacts colors its Call/Message/Mail actions.
const DOCK_ACTION_COLOR = {
  text: '#6D5CE0',
  voice: '#FF3B30',
  scan: '#30B255',
} as const;

/**
 * Unified AI Hub: three big, colorful action buttons (Smart Text, Voice, Scan
 * Receipt) that all delegate to the existing AI/voice functions passed in as
 * props. This component owns no AI state of its own beyond which of its two
 * local UI modes ("hub" buttons vs. the text composer) is showing.
 */
export default function SmartDock({
  visible,
  aiInput,
  onChangeAiInput,
  onSubmitText,
  isRecording,
  isVoiceProcessing,
  isBusy,
  onVoicePressIn,
  onVoicePressOut,
  onScan,
}: SmartDockProps) {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [mode, setMode] = useState<DockMode>('hub');
  const inputRef = useRef<TextInput>(null);

  // The voice pill must stay a single, unchanging touch target for the whole
  // gesture — swapping its content or handlers mid-press is what caused the
  // "hold to talk doesn't work" bug previously. Refs keep the handlers stable
  // even though the modal re-renders while `isRecording` flips.
  const onVoicePressInRef = useRef(onVoicePressIn);
  const onVoicePressOutRef = useRef(onVoicePressOut);
  onVoicePressInRef.current = onVoicePressIn;
  onVoicePressOutRef.current = onVoicePressOut;

  const handleVoicePressIn = useCallback(() => {
    onVoicePressInRef.current();
  }, []);

  const handleVoicePressOut = useCallback(() => {
    onVoicePressOutRef.current();
  }, []);

  useEffect(() => {
    if (!visible) {
      setMode('hub');
    }
  }, [visible]);

  useEffect(() => {
    if (mode === 'text') {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  const canSend = aiInput.trim().length > 0 && !isBusy && !isRecording;

  async function submitText() {
    if (!canSend) {
      return;
    }

    await onSubmitText();
    setMode('hub');
  }

  return (
    <View style={styles.wrap}>
      {mode === 'text' ? (
        <View style={styles.composer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconButton}
            onPress={() => setMode('hub')}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('addTransaction.cancel')}>
            <X color={colors.textMuted} size={18} />
          </TouchableOpacity>
          <View style={styles.composerField}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={aiInput}
              onChangeText={onChangeAiInput}
              placeholder={i18n.t('addTransaction.aiPlaceholder')}
              placeholderTextColor={colors.placeholder}
              keyboardAppearance={scheme}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => void submitText()}
              editable={!isBusy}
              multiline
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={() => void submitText()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('addTransaction.aiParse')}>
            <Send color={colors.onBrand} size={16} />
          </TouchableOpacity>
        </View>
      ) : isVoiceProcessing ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
          style={styles.processing}>
          <ProcessingState styles={styles} colors={colors} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(220)} style={styles.iconRow}>
          <DockIconButton
            label={i18n.t('addTransaction.smartText')}
            color={DOCK_ACTION_COLOR.text}
            onPress={() => setMode('text')}
            disabled={isBusy}
            styles={styles}
            colors={colors}>
            <Sparkles color={colors.onBrand} size={26} strokeWidth={2} />
          </DockIconButton>
          <DockIconButton
            label={i18n.t('addTransaction.voice')}
            color={DOCK_ACTION_COLOR.voice}
            disabled={isBusy}
            styles={styles}
            colors={colors}
            onPressIn={handleVoicePressIn}
            onPressOut={handleVoicePressOut}>
            <Mic color={colors.onBrand} size={26} strokeWidth={2} />
          </DockIconButton>
          <DockIconButton
            label={i18n.t('addTransaction.scanReceipt')}
            color={DOCK_ACTION_COLOR.scan}
            onPress={onScan}
            disabled={isBusy || isRecording}
            styles={styles}
            colors={colors}>
            <ScanLine color={colors.onBrand} size={26} strokeWidth={2} />
          </DockIconButton>
        </Animated.View>
      )}

      {/* A non-interactive overlay, never the buttons themselves, carries the
          listening indicator — so the voice touch target underneath never
          changes shape or handlers while the finger is still down. */}
      {isRecording ? (
        <View style={styles.listeningOverlay} pointerEvents="none">
          <ListeningState styles={styles} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One bold, colorful action: a big solid-color circle carrying a white icon,
 * with its label printed underneath — the same pattern as the Contacts app's
 * Call/Message/Mail buttons. The circle's shape and handlers never change
 * mid-press, so hold-to-talk keeps working the same way it always has.
 */
function DockIconButton({
  label,
  color,
  styles,
  colors,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  children,
}: {
  label: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
  colors: ColorTokens;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.actionButton}>
      <TouchableOpacity
        activeOpacity={0.75}
        style={[styles.iconChip, { backgroundColor: color }, disabled && styles.iconChipDisabled]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        delayPressIn={0}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={label}>
        {children}
      </TouchableOpacity>
      <Text
        style={[styles.actionLabel, disabled && { color: colors.placeholder }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ListeningState({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ColorTokens;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.14, { duration: 520 }), withTiming(1, { duration: 520 })),
      -1,
      true,
    );

    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.14], [0.28, 0.55]),
  }));

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [1, 1.14], [1, 1.06]) }],
  }));

  return (
    <View style={styles.listening}>
      <View style={styles.listeningMicWrap}>
        <Animated.View style={[styles.listeningGlow, glowStyle]} />
        <Animated.View style={[styles.listeningMic, micStyle]}>
          <Mic color={colors.onBrand} size={20} />
        </Animated.View>
      </View>
      <Waveform color={colors.expense} />
      <Text style={styles.listeningLabel}>{i18n.t('addTransaction.aiRecording')}</Text>
    </View>
  );
}

function ProcessingState({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ColorTokens;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.16, { duration: 620 }), withTiming(1, { duration: 620 })),
      -1,
      true,
    );

    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.16], [0.25, 0.5]),
  }));

  return (
    <View style={styles.processingRow}>
      <View style={styles.processingSpinnerWrap}>
        <Animated.View style={[styles.processingGlow, glowStyle]} />
        <View style={styles.processingSpinner}>
          <ActivityIndicator size="small" color={colors.onBrand} />
        </View>
      </View>
      <Text style={styles.processingLabel} numberOfLines={2}>
        {i18n.t('addTransaction.aiVoiceProcessing')}
      </Text>
    </View>
  );
}

function Waveform({ color }: { color: string }) {
  return (
    <View style={waveStyles.row}>
      {[0, 70, 140, 40, 110].map((delay, index) => (
        <WaveBar key={index} delay={delay} color={color} />
      ))}
    </View>
  );
}

function WaveBar({ delay, color }: { delay: number; color: string }) {
  const height = useSharedValue(8);

  useEffect(() => {
    height.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(22, { duration: 280 }), withTiming(8, { duration: 280 })), -1, true),
    );

    return () => {
      cancelAnimation(height);
    };
  }, [delay, height]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[waveStyles.bar, { backgroundColor: color }, style]} />;
}

const waveStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});

function createStyles(colors: ColorTokens, scheme: ColorScheme) {
  return StyleSheet.create({
    // Same surface, radius and hairline as the type control and form card,
    // so the AI tools read as another form block rather than floating chips.
    wrap: {
      minHeight: 88,
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      overflow: 'hidden',
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-evenly',
    },
    actionButton: {
      alignItems: 'center',
      gap: spacing.xs,
      width: 84,
    },
    // Big, bold and solid — each action is its own saturated color circle,
    // matching the native iOS "quick action" button convention.
    iconChip: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.24,
      shadowRadius: 8,
      elevation: 4,
    },
    iconChipDisabled: {
      opacity: 0.4,
      shadowOpacity: 0,
      elevation: 0,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    iconButton: {
      width: 36,
      height: 36,
      marginBottom: 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: scheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : colors.surfaceGlass,
    },
    composerField: {
      flex: 1,
      maxHeight: 96,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: scheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : colors.surfaceGlass,
    },
    input: {
      maxHeight: 96,
      paddingVertical: spacing.sm,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
    },
    send: {
      width: 36,
      height: 36,
      marginBottom: 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.brand,
    },
    sendDisabled: {
      opacity: 0.35,
    },
    listeningOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    listening: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
    },
    listeningMicWrap: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listeningGlow: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.expense,
    },
    listeningMic: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.expense,
    },
    listeningLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    processing: {
      minHeight: TOUCH_TARGET,
      justifyContent: 'center',
    },
    processingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    processingSpinnerWrap: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    processingGlow: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.brand,
    },
    processingSpinner: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
    },
    processingLabel: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
