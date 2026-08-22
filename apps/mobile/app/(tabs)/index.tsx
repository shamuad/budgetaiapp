import {
  DEFAULT_CURRENCY,
  formatAssetLabel,
  formatDate,
  formatMoney,
  i18n,
  toBaseAmount,
  TransactionRow,
  useAppStore,
  useAssets,
  useTransactions,
} from '@budgetaiapp/shared';
import { ArrowDownLeft, ArrowUpRight, Plus, Settings } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import AccountCard from '../../src/components/AccountCard';
import OptionsModal from '../../src/components/OptionsModal';
import TransactionItem from '../../src/components/TransactionItem';
import { colors, radius, spacing } from '../../src/theme';

/** The dashboard is a summary, so the full history stays on the transactions tab. */
const RECENT_LIMIT = 5;

/** The category emoji, falling back to a direction arrow for uncategorised rows. */
function TransactionIcon({ transaction }: { transaction: TransactionRow }) {
  if (transaction.category?.icon) {
    return <Text style={styles.transactionIcon}>{transaction.category.icon}</Text>;
  }

  return transaction.type === 'income' ? (
    <ArrowDownLeft color={colors.income} size={20} />
  ) : (
    <ArrowUpRight color={colors.expense} size={20} />
  );
}

export default function DashboardScreen() {
  const { transactions, totalBalance, isLoading, error, remove } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const { assets } = useAssets();
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const toggleSelectedAsset = useAppStore((state) => state.toggleSelectedAsset);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const heroFade = useRef(new Animated.Value(1)).current;

  // Fades the headline back in whenever focus moves, so the figure swaps softly
  // instead of snapping to a new number.
  useEffect(() => {
    heroFade.setValue(0);
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [heroFade, selectedAssetId]);

  /** Net recorded movement per account, in the base currency, same maths as the total. */
  const balanceByAsset = useMemo(() => {
    const totals = new Map<string, number>();

    for (const transaction of transactions) {
      if (!transaction.asset_id) {
        continue;
      }

      const base = toBaseAmount(transaction.amount, transaction.exchange_rate);
      const signed = transaction.type === 'expense' ? -base : base;

      totals.set(transaction.asset_id, (totals.get(transaction.asset_id) ?? 0) + signed);
    }

    return totals;
  }, [transactions]);

  // Already sorted newest first by the API, so the head of the list is the latest.
  const recent = useMemo(() => {
    const scoped = selectedAssetId
      ? transactions.filter((transaction) => transaction.asset_id === selectedAssetId)
      : transactions;

    return scoped.slice(0, RECENT_LIMIT);
  }, [selectedAssetId, transactions]);

  const focusedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const headlineBalance = focusedAsset
    ? (balanceByAsset.get(focusedAsset.id) ?? 0)
    : totalBalance;

  function toggleAsset(assetId: string) {
    toggleSelectedAsset(assetId);
  }

  function openEditor(transaction: TransactionRow) {
    setEditingTransaction(transaction);
    setIsModalVisible(true);
  }

  function closeModal() {
    setIsModalVisible(false);
    setEditingTransaction(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <Animated.View style={[styles.hero, { opacity: heroFade }]}>
            <Text style={styles.heroLabel} numberOfLines={1}>
              {focusedAsset ? formatAssetLabel(focusedAsset) : i18n.t('dashboard.totalBalance')}
            </Text>
            <Text
              style={styles.heroAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}>
              {formatMoney(headlineBalance, DEFAULT_CURRENCY)}
            </Text>
          </Animated.View>

          <Pressable
            style={styles.gear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('settings.title')}
            onPress={() => setIsOptionsVisible(true)}>
            <Settings color={colors.text} size={20} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('dashboard.myAssets')}</Text>
          {assets.length === 0 ? (
            <Text style={styles.placeholder}>{i18n.t('dashboard.emptyAssets')}</Text>
          ) : (
            // Negative margin lets the cards run to both screen edges while the
            // first one stays aligned with the page gutter.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.accountScroll}
              contentContainerStyle={styles.accountScrollContent}>
              {assets.map((asset) => (
                <AccountCard
                  key={asset.id}
                  asset={asset}
                  balance={balanceByAsset.get(asset.id) ?? 0}
                  isFocused={selectedAssetId === asset.id}
                  isDimmed={selectedAssetId !== null && selectedAssetId !== asset.id}
                  onPress={() => toggleAsset(asset.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('dashboard.recentActivity')}</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : recent.length === 0 ? (
            <Text style={styles.placeholder}>{i18n.t('dashboard.emptyTransactions')}</Text>
          ) : (
            <View style={styles.list}>
              {recent.map((transaction, index) => {
                const isIncome = transaction.type === 'income';

                return (
                  <View key={transaction.id}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <View style={styles.listRow}>
                      <TransactionItem
                        flat
                        icon={<TransactionIcon transaction={transaction} />}
                        title={transaction.title}
                        subtitle={formatDate(transaction.date, 'short')}
                        meta={formatAssetLabel(transaction.asset)}
                        amount={`${isIncome ? '+' : '-'}${formatMoney(transaction.amount, transaction.currency)}`}
                        positive={isIncome}
                        onEdit={() => openEditor(transaction)}
                        onDelete={() => remove(transaction.id)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Plus color={colors.onBrand} size={28} />
      </Pressable>

      <AddTransactionModal
        visible={isModalVisible}
        onClose={closeModal}
        transactionToEdit={editingTransaction}
      />

      <OptionsModal visible={isOptionsVisible} onClose={() => setIsOptionsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 96,
    gap: spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  hero: {
    flex: 1,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  gear: {
    width: 36,
    height: 36,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  // Deliberately not uppercased: native casing turns the Turkish "Bakiye" into
  // "BAKIYE" rather than "BAKİYE".
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '700',
    // Tight tracking keeps a long figure from looking loose at this size.
    letterSpacing: -1.2,
    color: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  accountScroll: {
    marginHorizontal: -spacing.lg,
  },
  accountScrollContent: {
    paddingHorizontal: spacing.lg,
    // Room for the focused card to scale up without being clipped.
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    // Clips the swipe actions to the grouped list's rounded corners.
    overflow: 'hidden',
  },
  listRow: {
    paddingVertical: spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  placeholder: {
    fontSize: 14,
    color: colors.textMuted,
  },
  transactionIcon: {
    fontSize: 20,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
