import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TransactionItemProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  amount: string;
  positive?: boolean;
};

export default function TransactionItem({
  icon,
  title,
  subtitle,
  amount,
  positive,
}: TransactionItemProps) {
  return (
    <View style={styles.item}>
      <View style={styles.iconWrapper}>{icon}</View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.amount, positive && styles.amountPositive]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  amountPositive: {
    color: '#059669',
  },
});
