import { Tabs } from 'expo-router';
import { LayoutDashboard, ReceiptText } from 'lucide-react-native';

import { i18n } from '@budgetaiapp/shared';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: i18n.t('tabs.transactions'),
          tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
