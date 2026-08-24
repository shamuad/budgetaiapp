import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';

export type CategoryLedgerEntry = {
  key: string;
  name: string;
  icon: string | null;
  color: string;
  amount: number;
  /** 0–1 share of the period's total spending. */
  share: number;
};

type CategoryLedgerRowProps = {
  entry: CategoryLedgerEntry;
  amountLabel: string;
};

/** One "Spending Breakdown" row: icon, name, amount, and a thin share-of-total progress bar. */
export default function CategoryLedgerRow({ entry, amountLabel }: CategoryLedgerRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(entry.share, 0.02) * 100,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [entry.share, width]);

  return (
    <View style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: `${entry.color}26` }]}>
        <Text style={styles.iconText}>{entry.icon ?? '🏷️'}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.amount}>{amountLabel}</Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: entry.color,
                width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 18,
    },
    details: {
      flex: 1,
      gap: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    amount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    track: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
  });
}
