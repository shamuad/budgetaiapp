import { i18n } from '@budgetaiapp/shared';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BarChart3, Home, Plus, ReceiptText } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { assistantIconXml } from '../assets/assistantIcon';
import { useAppTheme } from '../theming';

/** Five equal cells; the add action stays entirely inside the safe-area-aware bar. */
export default function DashboardTabBar({ state, navigation, onAdd }: BottomTabBarProps & { onAdd: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabs = [
    { route: 'index', label: i18n.t('tabs.home'), Icon: Home },
    { route: 'analytics', label: i18n.t('tabs.analytics'), Icon: BarChart3 },
    { route: 'add', label: i18n.t('dashboardDesign.add'), Icon: Plus },
    { route: 'transactions', label: i18n.t('tabs.transactions'), Icon: ReceiptText },
    { route: 'assistant', label: i18n.t('dashboardDesign.assistant'), Icon: null },
  ];
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12), paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}>
      {tabs.map(({ route, label, Icon }) => {
        const selected = state.routes[state.index]?.name === route;
        const planned = route === 'assistant';
        const add = route === 'add';
        const color = selected || add ? colors.tint : colors.textMuted;
        return (
          <Pressable key={route} style={styles.item} disabled={planned}
            accessibilityRole={add ? 'button' : 'tab'}
            accessibilityLabel={planned ? i18n.t('dashboardDesign.planned') : add ? i18n.t('addTransaction.title') : label}
            accessibilityState={{ selected, disabled: planned }}
            onPress={() => {
              if (add) return onAdd();
              const target = state.routes.find(item => item.name === route);
              if (!target) return;
              const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route, { filterAccountId: '', dashboardMonth: undefined });
            }}
            onLongPress={() => {
              const target = state.routes.find(item => item.name === route);
              if (target) navigation.emit({ type: 'tabLongPress', target: target.key });
            }}>
            <View style={[styles.iconBox, add && { backgroundColor: colors.brand, borderRadius: 22 }]}>
              {Icon ? <Icon size={add ? 26 : 22} strokeWidth={selected ? 2.4 : 2} color={add ? colors.onBrand : color} />
                : <SvgXml xml={assistantIconXml.replaceAll('#7B8190', colors.textMuted)} width={22} height={22} />}
            </View>
            <Text numberOfLines={2} style={[styles.label, { color, fontWeight: selected || add ? '600' : '500' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', minHeight: 64, gap: 2 },
  iconBox: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, lineHeight: 14, textAlign: 'center', paddingHorizontal: 1 },
});
