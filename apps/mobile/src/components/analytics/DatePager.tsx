import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';

type DatePagerProps = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
};

/** Horizontal drag distance that counts as a deliberate swipe rather than a scroll wobble. */
const SWIPE_THRESHOLD = 40;

/**
 * "< August 2026 >" — pages between periods via arrow taps or a left/right
 * swipe. Built on plain `PanResponder`/`Animated` rather than gesture-handler
 * worklets, so it never risks the reanimated/worklet pitfalls this app has
 * already hit elsewhere.
 */
export default function DatePager({ label, onPrev, onNext, nextDisabled = false }: DatePagerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fade = useRef(new Animated.Value(1)).current;
  const nextDisabledRef = useRef(nextDisabled);
  nextDisabledRef.current = nextDisabled;

  function animateChange() {
    fade.setValue(0.3);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }

  function goPrev() {
    animateChange();
    onPrev();
  }

  function goNext() {
    if (nextDisabledRef.current) {
      return;
    }
    animateChange();
    onNext();
  }

  const panResponder = useRef(
    PanResponder.create({
      // Only claims the gesture once it's clearly horizontal, so vertical
      // scrolling in a surrounding list is never intercepted.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) {
          goNext();
        } else if (gesture.dx >= SWIPE_THRESHOLD) {
          goPrev();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.row} {...panResponder.panHandlers}>
      <TouchableOpacity onPress={goPrev} style={styles.arrowButton} hitSlop={10} activeOpacity={0.6}>
        <ChevronLeft color={colors.textMuted} size={20} />
      </TouchableOpacity>
      <Animated.Text style={[styles.label, { opacity: fade, color: colors.text }]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <TouchableOpacity
        onPress={goNext}
        disabled={nextDisabled}
        style={styles.arrowButton}
        hitSlop={10}
        activeOpacity={0.6}>
        <ChevronRight color={nextDisabled ? colors.placeholderFaint : colors.textMuted} size={20} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    arrowButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
    },
    label: {
      minWidth: 170,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
}
