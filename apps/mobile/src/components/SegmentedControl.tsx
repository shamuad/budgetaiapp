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
    track: {
      flexDirection: 'row',
      gap: 2,
      padding: 2,
      backgroundColor: colors.border,
      borderRadius: radius.md,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
    },
    segmentActive: {
      backgroundColor: colors.surface,
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
