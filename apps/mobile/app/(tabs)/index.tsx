import { Coins, Plus, ReceiptText, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { i18n } from '@budgetaiapp/shared';
import AddTransactionModal, { TransactionDraft } from '../../src/components/AddTransactionModal';
import SectionCard from '../../src/components/SectionCard';
import { useTransactions } from '../../src/hooks/useTransactions';

export default function DashboardScreen() {
  const { transactions, totalBalance, isLoading, error, addTransaction } = useTransactions();
  const [isModalVisible, setIsModalVisible] = useState(false);

  async function handleAddTransaction(draft: TransactionDraft) {
    await addTransaction(draft);
    setIsModalVisible(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Wallet color="#C7D2FE" size={18} />
          <Text style={styles.balanceLabel}>{i18n.t('dashboard.totalBalance')}</Text>
        </View>
        <Text style={styles.balanceAmount}>€{totalBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</Text>
      </View>

      <SectionCard title={i18n.t('dashboard.myAssets')} icon={<Coins color="#4F46E5" size={18} />}>
        <Text style={styles.placeholder}>{i18n.t('dashboard.emptyAssets')}</Text>
      </SectionCard>

      <SectionCard
        title={i18n.t('dashboard.recentTransactions')}
        icon={<ReceiptText color="#4F46E5" size={18} />}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#4F46E5" />
        ) : error ? (
          <Text style={[styles.placeholder, { color: '#EF4444' }]}>{error}</Text>
        ) : transactions.length === 0 ? (
          <Text style={styles.placeholder}>{i18n.t('dashboard.emptyTransactions')}</Text>
        ) : (
          <View style={styles.transactionList}>
            {transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>{tx.title}</Text>
                  <Text style={styles.transactionDate}>{tx.date}</Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  tx.type === 'expense' ? styles.expenseAmount : styles.incomeAmount
                ]}>
                  {tx.type === 'expense' ? '-' : '+'}{tx.amount} {tx.currency}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Plus color="#FFFFFF" size={28} />
      </Pressable>

      <AddTransactionModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSubmit={handleAddTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#2563EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  balanceCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C7D2FE',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Yeni Eklenen İşlem Listesi Stilleri
  transactionList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  transactionInfo: {
    gap: 4,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  expenseAmount: {
    color: '#EF4444',
  },
  incomeAmount: {
    color: '#10B981',
  },
});