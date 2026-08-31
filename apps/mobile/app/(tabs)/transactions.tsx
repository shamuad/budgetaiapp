import {
  Category,
  formatDate,
  formatCurrency,
  i18n,
  TransactionRow,
  transactionPeriodDate,
  useCategories,
  useTransactions,
} from '@budgetaiapp/shared';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
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
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filters, setFilters] = useState<TransactionFilterDraft>(EMPTY_FILTERS);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const hasAdvancedFilters =
    filters.categoryIds.length > 0 || filters.dateFrom !== null || filters.dateTo !== null;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) {
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
  }, [transactions, typeFilter, filters]);

  function renderTransaction({ item }: { item: TransactionRow }) {
    const isIncome = item.type === 'income';
    // A transfer neither earns nor spends, so it carries no sign and names both sides.
    const isTransfer = item.type === 'transfer';
    const groupId = item.installment_group_id;

    return (
      <TransactionItem
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

      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
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
      gap: spacing.md,
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
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    pill: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
    },
    pillActive: {
      backgroundColor: colors.brand,
    },
    pillLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    pillLabelActive: {
      color: colors.onBrand,
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
