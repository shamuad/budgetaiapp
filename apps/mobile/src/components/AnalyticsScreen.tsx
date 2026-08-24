import {
  DEFAULT_CURRENCY,
  formatMoney,
  fromISODate,
  getCategoryColor,
  i18n,
  resolveCategoryName,
  toBaseAmount,
  useTransactionsQuery,
  type TransactionRow,
} from '@budgetaiapp/shared';
import { BarChart3, ChartLine } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

import { formatPeriodLabel, getPeriodRange, shiftAnchor } from '../lib/analyticsPeriod';
import { analyticsTimeframeOptions, type AnalyticsTimeframe } from '../lib/labels';
import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import CategoryLedgerRow, { type CategoryLedgerEntry } from './analytics/CategoryLedgerRow';
import DatePager from './analytics/DatePager';
import SegmentedControl from './SegmentedControl';

const CARD_PADDING = spacing.lg;
const DONUT_RADIUS = 96;
const DONUT_INNER_RADIUS = 68;
const YEAR_BAR_WIDTH = 12;
const YEAR_BAR_RADIUS = 4;

// This app runs on the New Architecture, where LayoutAnimation works on
// Android out of the box — the old `UIManager.setLayoutAnimationEnabledExperimental`
// opt-in is a Legacy-Architecture-only no-op there and just logs a warning.

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('month');
  const [anchorDate, setAnchorDate] = useState(new Date());
  // Year view only: lets the stacked income/expense bars swap for a Net
  // Balance trend line, without touching the Month donut or the ledger below.
  const [isYearLineView, setIsYearLineView] = useState(false);

  const { transactions } = useTransactionsQuery();

  const periodRange = useMemo(() => getPeriodRange(timeframe, anchorDate), [timeframe, anchorDate]);
  const periodLabel = useMemo(() => formatPeriodLabel(timeframe, anchorDate), [timeframe, anchorDate]);

  const periodTransactions = useMemo(() => {
    const { start, end } = periodRange;

    return transactions.filter((row) => {
      const date = fromISODate(row.date);
      return date !== null && date >= start && date < end;
    });
  }, [transactions, periodRange]);

  // Spending Breakdown always looks at expenses only, regardless of which
  // chart is showing above it — it answers "where did the money go".
  const ledger: CategoryLedgerEntry[] = useMemo(() => {
    const totals = new Map<
      string,
      { category: TransactionRow['category']; icon: string | null; amount: number }
    >();

    for (const row of periodTransactions) {
      if (row.type !== 'expense') {
        continue;
      }

      const key = row.category_id ?? '__uncategorized__';
      const amount = toBaseAmount(row.amount, row.exchange_rate);
      const existing = totals.get(key);

      if (existing) {
        existing.amount += amount;
      } else {
        totals.set(key, { category: row.category, icon: row.category?.icon ?? null, amount });
      }
    }

    const totalSpent = [...totals.values()].reduce((sum, item) => sum + item.amount, 0);
    const uncategorizedLabel: string = i18n.t('analytics.uncategorized');

    return [...totals.entries()]
      .map(([key, item]) => ({
        key,
        name: item.category ? resolveCategoryName(item.category) : uncategorizedLabel,
        icon: item.icon,
        amount: item.amount,
        color: getCategoryColor(item.category?.name, 'expense'),
        share: totalSpent > 0 ? item.amount / totalSpent : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  const totalSpent = useMemo(() => ledger.reduce((sum, entry) => sum + entry.amount, 0), [ledger]);

  const pieData = useMemo(
    () => ledger.map((entry) => ({ value: entry.amount, color: entry.color })),
    [ledger],
  );

  // Total income minus total expense for the selected period — a snapshot of
  // whether the user is up or down, independent of which chart is showing.
  const netCashFlow = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const row of periodTransactions) {
      if (row.type === 'transfer') {
        continue;
      }

      const amount = toBaseAmount(row.amount, row.exchange_rate);
      if (row.type === 'income') {
        income += amount;
      } else {
        expense += amount;
      }
    }

    return income - expense;
  }, [periodTransactions]);

  // A year zooms out to a monthly income-vs-expense trend instead of a single
  // period's category split — the ledger below still summarizes the whole year.
  // Expense bars are stacked by category (same colors as the ledger below),
  // Income stays a single solid segment beside it.
  const yearlyStackData = useMemo(() => {
    if (timeframe !== 'year') {
      return [];
    }

    const year = anchorDate.getFullYear();
    const monthBuckets = Array.from({ length: 12 }, () => ({
      income: 0,
      expenseByCategory: new Map<string, { category: TransactionRow['category']; amount: number }>(),
    }));

    for (const row of periodTransactions) {
      if (row.type === 'transfer') {
        continue;
      }

      const date = fromISODate(row.date);
      if (!date) {
        continue;
      }

      const amount = toBaseAmount(row.amount, row.exchange_rate);
      const bucket = monthBuckets[date.getMonth()];

      if (row.type === 'income') {
        bucket.income += amount;
        continue;
      }

      const key = row.category_id ?? '__uncategorized__';
      const existing = bucket.expenseByCategory.get(key);

      if (existing) {
        existing.amount += amount;
      } else {
        bucket.expenseByCategory.set(key, { category: row.category, amount });
      }
    }

    const monthFormatter = new Intl.DateTimeFormat(i18n.locale, { month: 'short' });

    return monthBuckets.flatMap((bucket, index) => {
      // Largest category anchors the bottom of the stack, smallest on top.
      const expenseSegments = [...bucket.expenseByCategory.values()]
        .sort((a, b) => b.amount - a.amount)
        .map((item, segmentIndex, all) => ({
          value: item.amount,
          color: getCategoryColor(item.category?.name, 'expense'),
          borderBottomLeftRadius: segmentIndex === 0 ? YEAR_BAR_RADIUS : 0,
          borderBottomRightRadius: segmentIndex === 0 ? YEAR_BAR_RADIUS : 0,
          borderTopLeftRadius: segmentIndex === all.length - 1 ? YEAR_BAR_RADIUS : 0,
          borderTopRightRadius: segmentIndex === all.length - 1 ? YEAR_BAR_RADIUS : 0,
        }));

      // NOTE: `isSecondary` is NOT a "second bar in a group" flag — under the
      // hood it scales that bar against a secondary Y-axis (secondaryStepHeight
      // / secondaryStepValue) that this chart never configures, so the bar's
      // height silently resolves to NaN and renders invisibly. Two visually
      // separate, same-scale bars per month only need to be two consecutive
      // stack entries with `spacing: 0` on the first — no `isSecondary` at all.
      return [
        {
          spacing: 0,
          label: monthFormatter.format(new Date(year, index, 1)),
          labelWidth: YEAR_BAR_WIDTH * 2,
          labelTextStyle: { color: colors.textMuted, fontSize: 10 },
          stacks: [
            {
              value: bucket.income,
              color: colors.income,
              borderTopLeftRadius: YEAR_BAR_RADIUS,
              borderTopRightRadius: YEAR_BAR_RADIUS,
              borderBottomLeftRadius: YEAR_BAR_RADIUS,
              borderBottomRightRadius: YEAR_BAR_RADIUS,
            },
          ],
        },
        {
          stacks:
            expenseSegments.length > 0
              ? expenseSegments
              : [{ value: 0, color: colors.border }],
        },
      ];
    });
  }, [timeframe, anchorDate, periodTransactions, colors]);

  // Alternate Year view: one colored line per spending category, each
  // tracing that category's monthly total — the same expense breakdown as
  // the stacked bars above, told as trends instead of a single snapshot.
  // `react-native-gifted-charts` caps a LineChart at 5 series, so anything
  // past the 4 biggest categories folds into a single "Other" line.
  const MAX_CATEGORY_LINES = 5;

  const yearlyCategoryLineData = useMemo(() => {
    if (timeframe !== 'year') {
      return [] as { name: string; color: string; points: { value: number; label: string }[] }[];
    }

    const year = anchorDate.getFullYear();
    const byCategory = new Map<string, { category: TransactionRow['category']; monthly: number[] }>();

    for (const row of periodTransactions) {
      if (row.type !== 'expense') {
        continue;
      }

      const date = fromISODate(row.date);
      if (!date) {
        continue;
      }

      const key = row.category_id ?? '__uncategorized__';
      const amount = toBaseAmount(row.amount, row.exchange_rate);
      let bucket = byCategory.get(key);

      if (!bucket) {
        bucket = { category: row.category, monthly: Array.from({ length: 12 }, () => 0) };
        byCategory.set(key, bucket);
      }

      bucket.monthly[date.getMonth()] += amount;
    }

    const uncategorizedLabel: string = i18n.t('analytics.uncategorized');
    const ranked = [...byCategory.values()]
      .map((bucket) => ({
        category: bucket.category,
        displayName: bucket.category ? resolveCategoryName(bucket.category) : uncategorizedLabel,
        monthly: bucket.monthly,
        total: bucket.monthly.reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.total - a.total);

    const individualCount = ranked.length <= MAX_CATEGORY_LINES ? ranked.length : MAX_CATEGORY_LINES - 1;
    const individual = ranked.slice(0, individualCount);
    const overflow = ranked.slice(individualCount);

    const buckets = individual.map((item) => ({
      name: item.displayName,
      color: getCategoryColor(item.category?.name, 'expense'),
      monthly: item.monthly,
    }));

    if (overflow.length > 0) {
      const combined = Array.from({ length: 12 }, () => 0);
      for (const item of overflow) {
        item.monthly.forEach((value, index) => {
          combined[index] += value;
        });
      }
      buckets.push({ name: i18n.t('analytics.otherCategories'), color: colors.textMuted, monthly: combined });
    }

    const monthFormatter = new Intl.DateTimeFormat(i18n.locale, { month: 'short' });

    return buckets.map((bucket) => ({
      name: bucket.name,
      color: bucket.color,
      points: bucket.monthly.map((value, index) => ({
        value,
        label: monthFormatter.format(new Date(year, index, 1)),
      })),
    }));
  }, [timeframe, anchorDate, periodTransactions, colors]);

  // Daily/weekly income is episodic (usually paid monthly), so a Net Balance
  // for those windows reads as a scary, misleading loss rather than a useful
  // signal — only Month/Year aggregate enough of the cycle to mean anything.
  const showNetBalance = timeframe === 'month' || timeframe === 'year';

  function handleTimeframeChange(next: AnalyticsTimeframe) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTimeframe(next);
  }

  function goToPeriod(direction: 1 | -1) {
    setAnchorDate((current) => shiftAnchor(timeframe, current, direction));
  }

  const listHeader = (
    <View style={styles.header}>
      <SegmentedControl
        options={analyticsTimeframeOptions()}
        value={timeframe}
        onChange={handleTimeframeChange}
      />

      {showNetBalance && (
        <View style={styles.netBalanceCard}>
          <Text style={styles.netBalanceLabel}>{i18n.t('analytics.netBalance')}</Text>
          <Text
            style={[
              styles.netBalanceAmount,
              { color: netCashFlow >= 0 ? colors.income : colors.expense },
            ]}
            numberOfLines={1}>
            {netCashFlow >= 0 ? '+' : ''}
            {formatMoney(netCashFlow, DEFAULT_CURRENCY)}
          </Text>
        </View>
      )}

      <DatePager label={periodLabel} onPrev={() => goToPeriod(-1)} onNext={() => goToPeriod(1)} />

      <View style={styles.chartCard}>
        {timeframe === 'year' ? (
          <>
            <View style={styles.chartToggleRow}>
              <Text style={styles.chartToggleTitle}>
                {isYearLineView ? i18n.t('analytics.categoryTrends') : i18n.t('analytics.title')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsYearLineView((current) => !current)}
                style={styles.chartToggleButton}
                accessibilityLabel={
                  isYearLineView ? i18n.t('analytics.viewBarChart') : i18n.t('analytics.viewLineChart')
                }>
                {isYearLineView ? (
                  <BarChart3 color={colors.text} size={18} />
                ) : (
                  <ChartLine color={colors.text} size={18} />
                )}
              </TouchableOpacity>
            </View>

            {/* No explicit `width` here: gifted-charts uses it as the canvas
                size, not a viewport, so passing the screen width would
                squeeze all 24 bars into it. Omitting it lets the chart size
                itself to its natural content width and scroll horizontally
                within this card instead of overflowing/breaking. */}
            {isYearLineView ? (
              <LineChart
                data={yearlyCategoryLineData[0]?.points ?? []}
                color={yearlyCategoryLineData[0]?.color}
                dataPointsColor={yearlyCategoryLineData[0]?.color}
                data2={yearlyCategoryLineData[1]?.points}
                color2={yearlyCategoryLineData[1]?.color}
                dataPointsColor2={yearlyCategoryLineData[1]?.color}
                data3={yearlyCategoryLineData[2]?.points}
                color3={yearlyCategoryLineData[2]?.color}
                dataPointsColor3={yearlyCategoryLineData[2]?.color}
                data4={yearlyCategoryLineData[3]?.points}
                color4={yearlyCategoryLineData[3]?.color}
                dataPointsColor4={yearlyCategoryLineData[3]?.color}
                data5={yearlyCategoryLineData[4]?.points}
                color5={yearlyCategoryLineData[4]?.color}
                dataPointsColor5={yearlyCategoryLineData[4]?.color}
                height={180}
                thickness={2.5}
                curved
                dataPointsRadius={3}
                hideRules
                hideYAxisText
                yAxisThickness={0}
                xAxisColor={colors.borderGlass}
                xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                initialSpacing={16}
                endSpacing={16}
                isAnimated
                animationDuration={500}
              />
            ) : (
              <BarChart
                stackData={yearlyStackData}
                height={180}
                barWidth={YEAR_BAR_WIDTH}
                spacing={18}
                initialSpacing={12}
                endSpacing={12}
                noOfSections={4}
                hideRules
                yAxisThickness={0}
                xAxisColor={colors.borderGlass}
                xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                isAnimated
                animationDuration={500}
                showScrollIndicator
              />
            )}

            <View style={styles.legendRow}>
              {isYearLineView ? (
                yearlyCategoryLineData.map((series) => (
                  <LegendDot key={series.name} color={series.color} label={series.name} styles={styles} />
                ))
              ) : (
                <>
                  <LegendDot color={colors.income} label={i18n.t('analytics.income')} styles={styles} />
                  <Text style={styles.legendHint}>{i18n.t('analytics.stackedColorsHint')}</Text>
                </>
              )}
            </View>
          </>
        ) : pieData.length > 0 ? (
          <PieChart
            donut
            data={pieData}
            radius={DONUT_RADIUS}
            innerRadius={DONUT_INNER_RADIUS}
            innerCircleColor={colors.surfaceElevated}
            isAnimated
            animationDuration={600}
            centerLabelComponent={() => (
              <View style={styles.centerLabel}>
                <Text style={styles.centerLabelAmount} numberOfLines={1}>
                  {formatMoney(totalSpent, DEFAULT_CURRENCY)}
                </Text>
                <Text style={styles.centerLabelCaption}>{i18n.t('analytics.totalSpent')}</Text>
              </View>
            )}
          />
        ) : (
          <View style={[styles.emptyDonut, { borderColor: colors.border }]}>
            <Text style={styles.emptyDonutText}>{i18n.t('analytics.noSpending')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>{i18n.t('analytics.spendingBreakdown')}</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={ledger}
      keyExtractor={(entry) => entry.key}
      renderItem={({ item }) => (
        <CategoryLedgerRow entry={item} amountLabel={formatMoney(item.amount, DEFAULT_CURRENCY)} />
      )}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <Text style={styles.emptyListText}>{i18n.t('analytics.noSpending')}</Text>
      }
    />
  );
}

function LegendDot({ color, label, styles }: { color: string; label: string; styles: AnalyticsStyles }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

type AnalyticsStyles = ReturnType<typeof createStyles>;

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
      gap: spacing.md,
    },
    header: {
      gap: spacing.lg,
      marginBottom: spacing.sm,
    },
    netBalanceCard: {
      alignItems: 'center',
      gap: 2,
    },
    netBalanceLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    netBalanceAmount: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    chartCard: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      borderRadius: radius.lg,
      padding: CARD_PADDING,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
    chartToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
      marginBottom: spacing.sm,
    },
    chartToggleTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chartToggleButton: {
      width: TOUCH_TARGET - 4,
      height: TOUCH_TARGET - 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceGlass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
    centerLabel: {
      alignItems: 'center',
      gap: 2,
    },
    centerLabelAmount: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      color: colors.text,
    },
    centerLabelCaption: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    emptyDonut: {
      width: DONUT_RADIUS * 2,
      height: DONUT_RADIUS * 2,
      borderRadius: DONUT_RADIUS,
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyDonutText: {
      textAlign: 'center',
      fontSize: 13,
      color: colors.textMuted,
    },
    emptyListText: {
      textAlign: 'center',
      fontSize: 13,
      color: colors.textMuted,
      paddingVertical: spacing.lg,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    legendSwatch: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    legendHint: {
      fontSize: 11,
      color: colors.textMuted,
      flexShrink: 1,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    },
  });
}
