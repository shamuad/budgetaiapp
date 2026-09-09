import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type SegmentedControlProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** D2 filled selection shared by settings, categories, accounts and transaction types. */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const wrapOptions = options.length > 3;

  return (
    <View style={[styles.track, wrapOptions && styles.trackWrapped, style]}>
      {options.map((option) => {
        const isActive = option.id === value;

        return (
          <TouchableOpacity
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            activeOpacity={0.7}
            onPress={() => onChange(option.id)}
            style={[styles.segment, wrapOptions && styles.segmentWrapped, isActive && styles.segmentActive]}>
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={2}>
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
      gap: 4,
      padding: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
    trackWrapped: {
      flexWrap: 'wrap',
    },
    segmentWrapped: {
      flex: 0,
      flexGrow: 1,
      flexBasis: '47%',
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TOUCH_TARGET,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: 11,
    },
    segmentActive: {
      backgroundColor: colors.brand,
    },
    label: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.onBrand,
    },
  });
}
