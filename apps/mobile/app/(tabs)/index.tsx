import {
  Asset,
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
import OptionsModal from '../../src/components/OptionsModal';
import TransactionItem from '../../src/components/TransactionItem';
import { accountTone, colors, radius, spacing } from '../../src/theme';

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

function toneFor(type: Asset['type']) {
  return type && type in accountTone
    ? accountTone[type as keyof typeof accountTone]
    : accountTone.default;
}

type AccountCardProps = {
  asset: Asset;
  balance: number;
  isFocused: boolean;
  isDimmed: boolean;
  onPress: () => void;
};

function AccountCard({ asset, balance, isFocused, isDimmed, onPress }: AccountCardProps) {
  // One driver for both cues: -1 pushed back, 0 resting, 1 focused.
  const emphasis = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(emphasis, {
      toValue: isFocused ? 1 : isDimmed ? -1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [emphasis, isDimmed, isFocused]);

  // Clamped so the spring's overshoot cannot push opacity past 1.
  const scale = emphasis.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.96, 1, 1.03],
    extrapolate: 'clamp',
  });
  const opacity = emphasis.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.45, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Animated.View
        style={[
          styles.accountCard,
          { backgroundColor: toneFor(asset.type) },
          isFocused && styles.accountCardFocused,
          { opacity, transform: [{ scale }] },
        ]}>
        {/* Off-canvas highlight that gives the card a moulded, physical finish. */}
        <View style={styles.accountSheen} />
        <Text style={styles.accountIcon}>{asset.icon}</Text>
        <View>
          <Text style={styles.accountName} numberOfLines={1}>
            {asset.name}
          </Text>
          <Text style={styles.accountBalance} numberOfLines={1}>
            {formatMoney(balance, DEFAULT_CURRENCY)}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
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
  accountCard: {
    width: 168,
    height: 112,
    borderRadius: 20,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
    // Always reserved so switching the colour on focus cannot shift the layout.
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  accountCardFocused: {
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  accountSheen: {
    position: 'absolute',
    top: -34,
    right: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  accountIcon: {
    fontSize: 22,
  },
  accountName: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  accountBalance: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onBrand,
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
