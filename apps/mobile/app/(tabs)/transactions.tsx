import { ArrowDownLeft, ArrowUpRight, Bitcoin, TrendingUp } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { i18n } from '@budgetaiapp/shared';

import TransactionItem from '../../src/components/TransactionItem';

const assets = [
  { id: 'voo', name: 'S&P 500 ETF', holding: '12 VOO', value: '$5,842.30' },
  { id: 'btc', name: 'Bitcoin', holding: '0.15 BTC', value: '$6,120.00' },
  { id: 'aapl', name: 'Apple Inc.', holding: '8 AAPL', value: '$1,704.00' },
];

const activities = [
  { id: 'a1', type: 'deposit', date: '2026-08-12', amount: '+$500.00' },
  { id: 'a2', type: 'deposit', date: '2026-08-05', amount: '+$1,200.00' },
  { id: 'a3', type: 'withdrawal', date: '2026-07-28', amount: '-$300.00' },
] as const;

type Activity = (typeof activities)[number];

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(i18n.locale, { day: 'numeric', month: 'short' });
}

function renderActivity({ item }: { item: Activity }) {
  const isDeposit = item.type === 'deposit';

  return (
    <TransactionItem
      icon={
        isDeposit ? (
          <ArrowDownLeft color="#059669" size={20} />
        ) : (
          <ArrowUpRight color="#DC2626" size={20} />
        )
      }
      title={i18n.t(`transactions.${item.type}`)}
      subtitle={formatDate(item.date)}
      amount={item.amount}
      positive={isDeposit}
    />
  );
}

export default function TransactionsScreen() {
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={activities}
      keyExtractor={(item) => item.id}
      renderItem={renderActivity}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>{i18n.t('transactions.portfolio')}</Text>
          {assets.map((asset) => (
            <TransactionItem
              key={asset.id}
              icon={
                asset.id === 'btc' ? (
                  <Bitcoin color="#4F46E5" size={20} />
                ) : (
                  <TrendingUp color="#4F46E5" size={20} />
                )
              }
              title={asset.name}
              subtitle={asset.holding}
              amount={asset.value}
            />
          ))}
          <Text style={styles.sectionTitle}>{i18n.t('transactions.recentActivity')}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
