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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, TOUCH_TARGET } from '../theme';
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

// Each action keeps a single, subtle tint on its icon only — the button
// itself stays a neutral glass chip, so the row reads as one calm, minimal
// instrument cluster rather than three loud, competing pills.
const DOCK_ICON_TINT: Record<ColorScheme, Record<'text' | 'voice' | 'scan', string>> = {
  light: {
    text: '#6366F1',
    voice: '#E11D48',
    scan: '#059669',
  },
  dark: {
    text: '#A78BFA',
    voice: '#FB7185',
    scan: '#5EEAD4',
  },
};

/**
 * Unified AI Hub: a floating glass dock with three icon-only actions (Smart
 * Text, Voice, Scan Receipt) that all delegate to the existing AI/voice
 * functions passed in as props. This component owns no AI state of its own
 * beyond which of its two local UI modes ("hub" icons vs. the text composer)
 * is showing.
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const tints = DOCK_ICON_TINT[scheme];
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

  const bottomPad = Math.max(insets.bottom, spacing.sm);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.dock}>
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
              onPress={() => setMode('text')}
              disabled={isBusy}
              styles={styles}>
              <Sparkles color={tints.text} size={20} strokeWidth={2} />
            </DockIconButton>
            <DockIconButton
              label={i18n.t('addTransaction.voice')}
              disabled={isBusy}
              styles={styles}
              onPressIn={handleVoicePressIn}
              onPressOut={handleVoicePressOut}>
              <Mic color={tints.voice} size={20} strokeWidth={2} />
            </DockIconButton>
            <DockIconButton
              label={i18n.t('addTransaction.scanReceipt')}
              onPress={onScan}
              disabled={isBusy || isRecording}
              styles={styles}>
              <ScanLine color={tints.scan} size={20} strokeWidth={2} />
            </DockIconButton>
          </Animated.View>
        )}

        {/* A non-interactive overlay, never the pill itself, carries the
            listening indicator — so the voice touch target underneath never
            changes shape or handlers while the finger is still down. */}
        {isRecording ? (
          <View style={styles.listeningOverlay} pointerEvents="none">
            <ListeningState styles={styles} colors={colors} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One minimalist, icon-only action: a neutral glass chip (no heavy fill, no
 * label) that carries only a subtly tinted icon and an `accessibilityLabel`
 * for the text the pill used to show. `activeOpacity={1}` plus the pressed
 * dim below keep the voice button's touch target visually and functionally
 * unchanged mid-gesture — hold-to-talk depends on it never swapping shape.
 */
function DockIconButton({
  label,
  styles,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  children,
}: {
  label: string;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      style={[styles.iconChip, disabled && styles.iconChipDisabled]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      delayPressIn={0}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {children}
    </TouchableOpacity>
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
    // No top border, no page-matching fill on the dock itself below — the
    // card's own shadow and radius are what separate it from the form above,
    // so it reads as floating rather than as an attached bottom bar.
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
    },
    // A rounder, capsule-like radius than the rest of the app's cards — this
    // is the one surface meant to feel like a floating action bar rather
    // than a docked panel.
    dock: {
      minHeight: TOUCH_TARGET + 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: 26,
      backgroundColor: scheme === 'dark' ? colors.surfaceElevated : colors.surface,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: scheme === 'dark' ? 0.32 : 0.12,
      shadowRadius: 20,
      elevation: 8,
      overflow: 'hidden',
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xl,
      minHeight: TOUCH_TARGET,
    },
    // Neutral, translucent glass chip — the same `surfaceGlass`/`borderGlass`
    // tokens the composer's cancel button already uses — so only the icon
    // itself carries any color.
    iconChip: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      borderRadius: TOUCH_TARGET / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderGlass,
    },
    iconChipDisabled: {
      opacity: 0.4,
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
      backgroundColor: colors.surfaceGlass,
    },
    input: {
      flex: 1,
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
      backgroundColor: scheme === 'dark' ? colors.surfaceElevated : colors.surface,
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
