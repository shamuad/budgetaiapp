import {
  Category,
  formatAssetLabel,
  formatDate,
  formatCurrency,
  i18n,
  TransactionRow,
  transactionPeriodDate,
  useAssets,
  useCategories,
  useTransactions,
} from '@budgetaiapp/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import TransactionFilterSheet, {
  type TransactionFilterDraft,
} from '../../src/components/TransactionFilterSheet';
import TransactionItem, { transactionAccount } from '../../src/components/TransactionItem';
import { radius, spacing, TOUCH_TARGET } from '../../src/theme';
import { useAppTheme, type ColorTokens } from '../../src/theming';

type TypeFilter = 'all' | 'income' | 'expense' | 'transfer';

const EMPTY_FILTERS: TransactionFilterDraft = { categoryIds: [], dateFrom: null, dateTo: null };

function typeFilterOptions(): { id: TypeFilter; label: string }[] {
  return [
    { id: 'all', label: i18n.t('transactions.filterAll') },
    { id: 'income', label: i18n.t('transactions.filterIncome') },
    { id: 'expense', label: i18n.t('transactions.filterExpense') },
    { id: 'transfer', label: i18n.t('transactions.filterTransfers') },
  ];
}

export default function TransactionsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions, isLoading, error, remove, removeGroup } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const { categories } = useCategories();
  const { assets } = useAssets();
  const { filterAccountId } = useLocalSearchParams<{ filterAccountId?: string }>();
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filters, setFilters] = useState<TransactionFilterDraft>(EMPTY_FILTERS);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string | null>(filterAccountId ?? null);

  // Arriving from the Dashboard's "See All" link scopes the list to that
  // account; arriving via the tab bar carries no param, so this stays null.
  useEffect(() => {
    setAccountFilter(filterAccountId ?? null);
  }, [filterAccountId]);

  const filteredAccount = useMemo(
    () => assets.find((asset) => asset.id === accountFilter) ?? null,
    [assets, accountFilter],
  );

  function clearAccountFilter() {
    setAccountFilter(null);
    router.setParams({ filterAccountId: '' });
  }

  const hasAdvancedFilters =
    filters.categoryIds.length > 0 || filters.dateFrom !== null || filters.dateTo !== null;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) {
        return false;
      }

      if (accountFilter && row.asset_id !== accountFilter && row.to_asset_id !== accountFilter) {
        return false;
      }

      if (filters.categoryIds.length > 0) {
        if (!row.category_id || !filters.categoryIds.includes(row.category_id)) {
          return false;
        }
      }

      if (filters.dateFrom || filters.dateTo) {
        const date = transactionPeriodDate(row);
        if (!date) {
          return false;
        }
        if (filters.dateFrom && date < filters.dateFrom) {
          return false;
        }
        if (filters.dateTo && date > filters.dateTo) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, typeFilter, accountFilter, filters]);

  function renderTransaction({ item }: { item: TransactionRow }) {
    const isIncome = item.type === 'income';
    // A transfer neither earns nor spends, so it carries no sign and names both sides.
    const isTransfer = item.type === 'transfer';
    const groupId = item.installment_group_id;

    return (
      <View style={styles.listRow}>
        <TransactionItem
          flat
          icon={
            isTransfer ? (
              <ArrowRightLeft color={colors.textMuted} size={20} />
            ) : isIncome ? (
              <ArrowDownLeft color={colors.income} size={20} />
            ) : (
              <ArrowUpRight color={colors.expense} size={20} />
            )
          }
          title={item.title}
          subtitle={formatDate(item.date, 'short')}
          account={transactionAccount(item)}
          amount={`${isTransfer ? '' : isIncome ? '+' : '-'}${formatCurrency(item.amount, item.currency)}`}
          positive={isIncome}
          negative={!isIncome && !isTransfer}
          onEdit={() => setEditingTransaction(item)}
          onDelete={() => (groupId ? removeGroup(groupId) : remove(item.id))}
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
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* A plain View above the FlatList (rather than a ListHeaderComponent) never
          scrolls away, keeping the pills and filter button permanently reachable. */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}>
          {typeFilterOptions().map((option) => {
            const isActive = option.id === typeFilter;

            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.7}
                onPress={() => setTypeFilter(option.id)}
                style={[styles.pill, isActive && styles.pillActive]}>
                <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setIsFilterSheetVisible(true)}
          style={styles.filterButton}>
          <SlidersHorizontal color={colors.text} size={18} />
          {hasAdvancedFilters && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      {filteredAccount && (
        <View style={styles.accountChipRow}>
          <View style={styles.accountChip}>
            <Text style={styles.accountChipText} numberOfLines={1}>
              {i18n.t('transactions.filteredByAccount', { name: formatAssetLabel(filteredAccount) })}
            </Text>
            <TouchableOpacity
              onPress={clearAccountFilter}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('transactions.clearFilter')}>
              <X color={colors.textMuted} size={14} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {transactions.length === 0
              ? i18n.t('dashboard.emptyTransactions')
              : i18n.t('transactions.noResults')}
          </Text>
        }
      />

      <AddTransactionModal
        visible={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        transactionToEdit={editingTransaction}
      />

      <TransactionFilterSheet
        visible={isFilterSheetVisible}
        categories={categories as Category[]}
        value={filters}
        onApply={setFilters}
        onClose={() => setIsFilterSheetVisible(false)}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
    },
    listRow: {
      paddingVertical: spacing.md,
    },
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    accountChipRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
    },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
    },
    accountChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pillRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      paddingVertical: spacing.xs,
    },
    // Sleeker than a filled pill: a quiet underline keeps the header
    // sophisticated and minimal instead of a bright block of color.
    pill: {
      paddingBottom: spacing.xs,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    pillActive: {
      borderBottomColor: colors.brand,
    },
    pillLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    pillLabelActive: {
      color: colors.brand,
    },
    filterButton: {
      width: TOUCH_TARGET - 4,
      height: TOUCH_TARGET - 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
    },
    filterBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brand,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    empty: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    error: {
      fontSize: 14,
      color: colors.danger,
    },
  });
}
