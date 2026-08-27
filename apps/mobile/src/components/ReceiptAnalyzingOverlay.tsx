import { i18n } from '@budgetaiapp/shared';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInDown,
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { spacing } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type ReceiptAnalyzingOverlayProps = {
  /** Defaults to the receipt-scan copy; pass a different string for other AI flows (e.g. voice). */
  title?: string;
};

/**
 * A floating status pill shown while the AI fills the form in (receipt scan or
 * voice). Deliberately non-blocking: it sits above the form with
 * `pointerEvents="none"`, so the user can keep typing or correcting fields
 * while the model is still thinking, and whatever the AI answers with simply
 * lands around them.
 */
export default function ReceiptAnalyzingOverlay({ title }: ReceiptAnalyzingOverlayProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      true,
    );

    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  // The sparkle breathes rather than spins: a slow scale and opacity swell
  // reads as "working" without dragging the eye away from the form.
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.08]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.75, 1]),
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        entering={FadeInDown.duration(260)}
        exiting={FadeOutDown.duration(180)}
        style={styles.pill}>
        <Animated.View style={sparkleStyle}>
          <Sparkles color={colors.tint} size={16} />
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {title ?? i18n.t('addTransaction.analyzingReceipt')}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: 0,
      bottom: spacing.lg,
      left: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '100%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 8,
    },
    label: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.1,
      color: colors.text,
    },
  });
}
