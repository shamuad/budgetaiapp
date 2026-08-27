import {
  BUDGET_GROUP_TARGET_SHARE,
  BUDGET_GROUP_TONE,
  BudgetBreakdown,
  budgetGroupLabel,
  BudgetGroup,
  DEFAULT_CURRENCY,
  formatMoney,
  i18n,
} from '@budgetaiapp/shared';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';

type BudgetBreakdownCardProps = {
  breakdown: BudgetBreakdown;
};

type CardStyles = ReturnType<typeof createStyles>;

const ROW_GROUPS: BudgetGroup[] = ['needs', 'wants', 'savings'];

/**
 * The 50/30/20 picture for the selected period: actual share of income spent
 * on Needs and Wants, and saved (via transfers into an investment account —
 * see `calculateBudgetBreakdown`), each against its target.
 */
export default function BudgetBreakdownCard({ breakdown }: BudgetBreakdownCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{i18n.t('analytics.budgetBreakdownTitle')}</Text>

      {breakdown.income <= 0 ? (
        <Text style={styles.emptyText}>{i18n.t('analytics.budgetNoIncome')}</Text>
      ) : (
        <View style={styles.rows}>
          {ROW_GROUPS.map((group) => (
            <BudgetGroupRow
              key={group}
              group={group}
              amount={breakdown[group]}
              share={breakdown[`${group}Share`]}
              styles={styles}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function BudgetGroupRow({
  group,
  amount,
  share,
  styles,
}: {
  group: BudgetGroup;
  amount: number;
  share: number;
  styles: CardStyles;
}) {
  const width = useRef(new Animated.Value(0)).current;
  const tone = BUDGET_GROUP_TONE[group];
  const targetPercent = Math.round(BUDGET_GROUP_TARGET_SHARE[group] * 100);
  const actualPercent = Math.round(share * 100);

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.min(Math.max(share, 0), 1) * 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [share, width]);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowLabelGroup}>
          <View style={[styles.dot, { backgroundColor: tone }]} />
          <Text style={styles.rowLabel}>{budgetGroupLabel(group)}</Text>
        </View>
        <Text style={[styles.rowPercent, { color: tone }]}>{actualPercent}%</Text>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: tone,
              width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
        {/* Marks where the 50/30/20 target sits along the same track. */}
        <View style={[styles.targetMarker, { left: `${Math.min(targetPercent, 100)}%` }]} />
      </View>

      <View style={styles.rowFooter}>
        <Text style={styles.rowAmount}>{formatMoney(amount, DEFAULT_CURRENCY)}</Text>
        <Text style={styles.rowTarget}>{i18n.t('analytics.budgetTarget', { percent: targetPercent })}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.sm,
    },
    rows: {
      gap: spacing.md,
    },
    row: {
      gap: spacing.xs,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    rowLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    rowPercent: {
      fontSize: 13,
      fontWeight: '700',
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'visible',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    targetMarker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 10,
      borderRadius: 1,
      backgroundColor: colors.text,
      opacity: 0.4,
    },
    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowAmount: {
      fontSize: 12,
      color: colors.textMuted,
    },
    rowTarget: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
