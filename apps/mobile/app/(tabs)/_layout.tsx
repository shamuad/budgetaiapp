import { i18n } from '@budgetaiapp/shared';
import { Tabs, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import DashboardTabBar from '../../src/components/DashboardTabBar';
import OptionsModal, { type SettingsAnchor } from '../../src/components/OptionsModal';
import { TabActionsContext } from '../../src/components/TabActions';
import TopHeader from '../../src/components/TopHeader';
import { useAppTheme } from '../../src/theming';

export default function TabsLayout() {
  const { colors, scheme } = useAppTheme();
  const pathname = usePathname();
  const isDashboard = pathname === '/' || pathname === '/index';
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<SettingsAnchor | null>(null);
  const actions = useMemo(() => ({ openSettings: (anchor: SettingsAnchor) => {
    setSettingsAnchor(anchor);
    setIsOptionsVisible(true);
  } }), []);

  return (
    <TabActionsContext.Provider value={actions}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDashboard && !isAddVisible && !isOptionsVisible ? 'light' : scheme === 'dark' ? 'light' : 'dark'} />
        {!isDashboard && <TopHeader onSettingsPress={actions.openSettings} />}
        <Tabs screenOptions={{ headerShown: false }}
          tabBar={props => <DashboardTabBar {...props} onAdd={() => setIsAddVisible(true)} />}>
          <Tabs.Screen name="index" options={{ title: i18n.t('tabs.home') }} />
          <Tabs.Screen name="analytics" options={{ title: i18n.t('tabs.analytics') }} />
          <Tabs.Screen name="transactions" options={{ title: i18n.t('tabs.transactions') }} />
        </Tabs>
        <AddTransactionModal visible={isAddVisible} onClose={() => setIsAddVisible(false)} />
        <OptionsModal visible={isOptionsVisible} anchor={settingsAnchor} onClose={() => setIsOptionsVisible(false)} />
      </View>
    </TabActionsContext.Provider>
  );
}
