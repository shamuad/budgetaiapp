import {
  DEFAULT_CURRENCY,
  formatAssetLabel,
  formatDate,
  formatCurrency,
  i18n,
  TransactionRow,
  useAppStore,
  useAssets,
  useTransactions,
} from '@budgetaiapp/shared';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import AccountCard from '../../src/components/AccountCard';
import TransactionItem, { transactionAccount } from '../../src/components/TransactionItem';
import { spacing } from '../../src/theme';
import { useAppTheme, type ColorTokens } from '../../src/theming';

/** The dashboard is a summary, so the full history stays on the transactions tab. */
const RECENT_LIMIT = 5;

/** The category emoji, falling back to a direction arrow for uncategorised rows. */
function TransactionIcon({
  transaction,
  colors,
}: {
  transaction: TransactionRow;
  colors: ColorTokens;
}) {
  if (transaction.category?.icon) {
    return <Text style={{ fontSize: 20 }}>{transaction.category.icon}</Text>;
  }

  if (transaction.type === 'transfer') {
    return <ArrowRightLeft color={colors.textMuted} size={20} />;
  }

  return transaction.type === 'income' ? (
    <ArrowDownLeft color={colors.income} size={20} />
  ) : (
    <ArrowUpRight color={colors.expense} size={20} />
  );
}

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions, balanceByAsset, isLoading, error, remove, removeGroup } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const { assets } = useAssets();
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const toggleSelectedAsset = useAppStore((state) => state.toggleSelectedAsset);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  // Already sorted newest first by the API, so the head of the list is the latest.
  // A transfer belongs to both accounts it touches, so it shows on either one.
  const recent = useMemo(() => {
    const scoped = selectedAssetId
      ? transactions.filter(
          (transaction) =>
            transaction.asset_id === selectedAssetId ||
            transaction.to_asset_id === selectedAssetId,
        )
      : transactions;

    return scoped.slice(0, RECENT_LIMIT);
  }, [selectedAssetId, transactions]);

  const focusedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  // Headline always matches the cards: one account when focused, otherwise
  // the sum of every account currently on the dashboard. Using net cash
  // flow here drifted from the cards whenever a transfer (or an income
  // booked to an account that is not listed) was in the ledger.
  const headlineBalance = focusedAsset
    ? (balanceByAsset.get(focusedAsset.id) ?? 0)
    : assets.reduce((sum, asset) => sum + (balanceByAsset.get(asset.id) ?? 0), 0);

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
        <Animated.View style={[styles.hero, { opacity: heroFade }]}>
          <Text style={styles.heroLabel} numberOfLines={1}>
            {focusedAsset ? formatAssetLabel(focusedAsset) : i18n.t('dashboard.totalBalance')}
          </Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {formatCurrency(headlineBalance, DEFAULT_CURRENCY)}
          </Text>
        </Animated.View>

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
            <View>
              {recent.map((transaction, index) => {
                const isIncome = transaction.type === 'income';
                // A transfer neither earns nor spends, so it carries no sign.
                const isTransfer = transaction.type === 'transfer';
                const groupId = transaction.installment_group_id;
                const isLast = index === recent.length - 1;

                return (
                  <View key={transaction.id} style={[styles.listRow, !isLast && styles.listRowBorder]}>
                    <TransactionItem
                      flat
                      icon={<TransactionIcon transaction={transaction} colors={colors} />}
                      title={transaction.title}
                      subtitle={formatDate(transaction.date, 'short')}
                      account={transactionAccount(transaction)}
                      amount={`${isTransfer ? '' : isIncome ? '+' : '-'}${formatCurrency(transaction.amount, transaction.currency)}`}
                      positive={isIncome}
                      onEdit={() => openEditor(transaction)}
                      onDelete={() => (groupId ? removeGroup(groupId) : remove(transaction.id))}
                      deleteConfirmation={
                        groupId
                          ? {
                              title: i18n.t('transactionActions.installmentDeleteTitle'),
                              message: i18n.t('transactionActions.installmentDeleteMessage'),
                              confirmLabel: i18n.t('transactionActions.deleteAll'),
                            }
                          : undefined
                      }
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <AddTransactionModal
        visible={isModalVisible}
        onClose={closeModal}
        transactionToEdit={editingTransaction}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },
    hero: {
      gap: spacing.xs,
    },
    // Deliberately not uppercased: native casing turns the Turkish "Bakiye" into
    // "BAKIYE" rather than "BAKİYE".
    heroLabel: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textMuted,
    },
    heroAmount: {
      fontSize: 44,
      fontWeight: '800',
      // Tight tracking keeps a long figure from looking loose at this size.
      letterSpacing: -1.6,
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
    listRow: {
      paddingVertical: spacing.md,
    },
    listRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    placeholder: {
      fontSize: 14,
      color: colors.textMuted,
    },
    error: {
      fontSize: 14,
      color: colors.danger,
    },
  });
}
