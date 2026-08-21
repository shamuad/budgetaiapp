import {
  formatAssetLabel,
  formatDate,
  formatMoney,
  i18n,
  TransactionRow,
  useTransactions,
} from '@budgetaiapp/shared';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import TransactionItem from '../../src/components/TransactionItem';
import { colors, spacing } from '../../src/theme';

export default function TransactionsScreen() {
  const { transactions, isLoading, error, remove } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);

  function renderTransaction({ item }: { item: TransactionRow }) {
    const isIncome = item.type === 'income';

    return (
      <TransactionItem
        icon={
          isIncome ? (
            <ArrowDownLeft color={colors.income} size={20} />
          ) : (
            <ArrowUpRight color={colors.expense} size={20} />
          )
        }
        title={item.title}
        subtitle={formatDate(item.date, 'short')}
        meta={formatAssetLabel(item.asset)}
        amount={`${isIncome ? '+' : '-'}${formatMoney(item.amount, item.currency)}`}
        positive={isIncome}
        onEdit={() => setEditingTransaction(item)}
        onDelete={() => remove(item.id)}
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
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        ListEmptyComponent={
          <Text style={styles.empty}>{i18n.t('dashboard.emptyTransactions')}</Text>
        }
      />

      <AddTransactionModal
        visible={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        transactionToEdit={editingTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
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
