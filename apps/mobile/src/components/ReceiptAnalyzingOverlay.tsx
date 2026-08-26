import { i18n } from '@budgetaiapp/shared';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type ReceiptAnalyzingOverlayProps = {
  /** Defaults to the receipt-scan copy; pass a different string for other AI flows (e.g. voice). */
  title?: string;
};

/** A themed skeleton shown over the form while the AI fills it in (receipt scan or voice). */
export default function ReceiptAnalyzingOverlay({ title }: ReceiptAnalyzingOverlayProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.45, { duration: 700 })),
      -1,
      true,
    );
  }, [pulse]);

  const shimmer = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.title}>{title ?? i18n.t('addTransaction.analyzingReceipt')}</Text>
        <Animated.View style={[styles.block, styles.blockWide, shimmer]} />
        <Animated.View style={[styles.block, styles.blockHero, shimmer]} />
        <View style={styles.row}>
          <Animated.View style={[styles.block, styles.blockHalf, shimmer]} />
          <Animated.View style={[styles.block, styles.blockHalf, shimmer]} />
        </View>
        <Animated.View style={[styles.block, styles.blockLine, shimmer]} />
        <Animated.View style={[styles.block, styles.blockLineShort, shimmer]} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.overlay,
    },
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 10,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
      textAlign: 'center',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    block: {
      borderRadius: radius.md,
      backgroundColor: colors.border,
    },
    blockWide: {
      height: 14,
      width: '42%',
      alignSelf: 'center',
    },
    blockHero: {
      height: 56,
      width: '70%',
      alignSelf: 'center',
    },
    blockHalf: {
      flex: 1,
      height: 44,
    },
    blockLine: {
      height: 16,
      width: '100%',
    },
    blockLineShort: {
      height: 16,
      width: '64%',
    },
  });
}
