import { DEFAULT_CURRENCY, formatCurrency, i18n, resolveCategoryName, summarizeDashboard } from '@budgetaiapp/shared';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theming';

type Props = { summary: ReturnType<typeof summarizeDashboard>; scope: string; loading: boolean; error?: string | null; onAnalysis: () => void };
export default function DashboardSummary({ summary, scope, loading, error, onAnalysis }: Props) {
  const { colors } = useAppTheme();
  const surface = { backgroundColor: colors.surface, borderColor: colors.border };
  const entries = summary.topCategories.map((entry, index) => ({
    key: entry.key,
    name: entry.category ? resolveCategoryName(entry.category) : i18n.t('analytics.uncategorized'),
    amount: entry.amount,
    color: index === 0 ? colors.chartPrimary : colors.chartSecondary,
  }));
  if (summary.otherAmount > 0) entries.push({ key: '__other__', name: i18n.t('dashboardDesign.other'), amount: summary.otherAmount, color: colors.chartOther });
  const figures = [
    { key: 'income', amount: summary.income, color: colors.income },
    { key: 'expense', amount: summary.expense, color: colors.expense },
    { key: 'net', amount: summary.net, color: colors.text },
  ];
  return (
    <View style={styles.wrap}>
      <View style={[styles.monthly, surface]} accessibilityLabel={i18n.t('dashboardDesign.monthly')}>
        {figures.map(item => <View key={item.key} style={styles.figure}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{i18n.t(`dashboardDesign.${item.key}`)}</Text>
          <Text style={[styles.amount, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {loading || error ? '—' : `${item.key === 'net' && item.amount > 0 ? '+' : ''}${formatCurrency(item.amount, DEFAULT_CURRENCY)}`}
          </Text>
        </View>)}
      </View>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>{i18n.t('dashboardDesign.spending')}</Text>
        <Pressable onPress={onAnalysis} accessibilityRole="button" style={styles.link}>
          <Text style={{ color: colors.tint, fontSize: 13 }}>{i18n.t('dashboardDesign.analysis')}</Text>
          <ChevronRight color={colors.tint} size={15} />
        </Pressable>
      </View>
      <View style={[styles.spending, surface]}>
        <View style={styles.row}>
          <Text style={[styles.scope, { color: colors.textMuted }]} numberOfLines={2}>{i18n.t('dashboardDesign.month')} · {scope}</Text>
          <Text style={[styles.total, { color: colors.text }]}>{loading || error ? '—' : formatCurrency(summary.expense, DEFAULT_CURRENCY)}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.tint} /> : error ? <Text style={{ color: colors.expense }}>{error}</Text> : summary.expense <= 0 ?
          <Text style={[styles.empty, { color: colors.textMuted }]}>{i18n.t('dashboardDesign.empty')}</Text> : <>
            <View style={styles.bar} accessible={false}>
              {entries.map(entry => <View key={entry.key} style={{ flex: entry.amount / summary.expense, backgroundColor: entry.color }} />)}
            </View>
            {entries.map(entry => <View key={entry.key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: entry.color }]} />
              <Text style={[styles.category, { color: colors.text }]} numberOfLines={1}>{entry.name}</Text>
              <Text style={{ color: colors.text, fontSize: 13 }}>{formatCurrency(entry.amount, DEFAULT_CURRENCY)}</Text>
            </View>)}
          </>}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 12 },
  monthly: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  figure: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontSize: 12, textAlign: 'center' },
  amount: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  title: { fontSize: 18, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  spending: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scope: { flex: 1, fontSize: 12 },
  total: { fontSize: 15, fontWeight: '600' },
  bar: { height: 8, flexDirection: 'row', gap: 3, borderRadius: 4, overflow: 'hidden' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  category: { flex: 1, fontSize: 13 },
  empty: { fontSize: 13, paddingVertical: 12 },
});
