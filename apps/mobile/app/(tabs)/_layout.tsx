import { i18n } from '@budgetaiapp/shared';
import { Tabs } from 'expo-router';
import { ChartPie, Home, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import OptionsModal, { type SettingsAnchor } from '../../src/components/OptionsModal';
import TopHeader from '../../src/components/TopHeader';
import { useAppTheme, type ColorTokens } from '../../src/theming';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);

  return (
    <View style={styles.shell}>
      <TopHeader
        onAddPress={() => setIsAddVisible(true)}
        onSettingsPress={(anchor) => {
          setSettingsAnchor(anchor);
          setIsOptionsVisible(true);
        }}
      />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: styles.tabBar,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: i18n.t('tabs.home'),
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: i18n.t('tabs.analytics'),
            tabBarIcon: ({ color, size }) => <ChartPie color={color} size={size} />,
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

      <AddTransactionModal visible={isAddVisible} onClose={() => setIsAddVisible(false)} />
      <OptionsModal
        visible={isOptionsVisible}
        anchor={settingsAnchor}
        onClose={() => setIsOptionsVisible(false)}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabBar: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabItem: {
      paddingTop: 4,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
  });
}
