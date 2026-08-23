import {
  formatAssetLabel,
  formatDate,
  formatMoney,
  formatTransferLabel,
  i18n,
  TransactionRow,
  useTransactions,
} from '@budgetaiapp/shared';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import TransactionItem from '../../src/components/TransactionItem';
import { spacing } from '../../src/theme';
import { useAppTheme, type ColorTokens } from '../../src/theming';

export default function TransactionsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions, isLoading, error, remove } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);

  function renderTransaction({ item }: { item: TransactionRow }) {
    const isIncome = item.type === 'income';
    // A transfer neither earns nor spends, so it carries no sign and names both sides.
    const isTransfer = item.type === 'transfer';

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
        meta={
          isTransfer
            ? formatTransferLabel(item.asset, item.to_asset, item.asset_symbol)
            : formatAssetLabel(item.asset)
        }
        amount={`${isTransfer ? '' : isIncome ? '+' : '-'}${formatMoney(item.amount, item.currency)}`}
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
