import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

type SegmentedControlProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** iOS-style segmented control shared by the category, account and type switchers. */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
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
            <Text style={[styles.label, isActive && styles.labelActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
