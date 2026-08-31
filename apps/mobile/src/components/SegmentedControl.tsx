import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { radius, spacing } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type SegmentedControlProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Tint of the active segment's label, e.g. red for an expense. */
  activeColor?: string;
};

/** iOS-style segmented control shared by the category, account and type switchers. */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  activeColor,
}: SegmentedControlProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const isActive = option.id === value;

        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.7}
            onPress={() => onChange(option.id)}
            style={[styles.segment, isActive && styles.segmentActive]}>
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
                isActive && activeColor ? { color: activeColor } : null,
              ]}
              numberOfLines={1}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    // Same surface, radius and hairline border as the form card below it, so
    // the two read as one consistent container language rather than two
    // differently-styled boxes stacked on top of each other.
    track: {
      flexDirection: 'row',
      gap: 4,
      padding: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
    },
    // A distinct, elevated card rather than a flat fill — the soft shadow is
    // what makes the active segment feel like it physically sits above the
    // track, the way the native iOS segmented control snaps into place.
    segmentActive: {
      backgroundColor: colors.surfaceElevated,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.text,
    },
  });
}
