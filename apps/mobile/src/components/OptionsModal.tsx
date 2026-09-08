import {
  i18n,
  ThemePreference,
  useAuthStore,
  useDeleteAllTransactionsMutation,
  useTransactionsQuery,
} from '@budgetaiapp/shared';
import { ChevronRight, Folder, Wallet, X } from 'lucide-react-native';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import ManageAccountsModal from './manage/ManageAccountsModal';
import ManageCategoriesModal from './manage/ManageCategoriesModal';
import SegmentedControl from './SegmentedControl';

export type SettingsAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  anchor: SettingsAnchor | null;
};

const THEME_OPTIONS: { id: ThemePreference; label: () => string }[] = [
  { id: 'auto', label: () => i18n.t('profile.themeAuto') },
  { id: 'light', label: () => i18n.t('profile.themeLight') },
  { id: 'dark', label: () => i18n.t('profile.themeDark') },
];

const FIGMA_SHEET_HEIGHT = 560;

/**
 * Dashboard settings sheet from Figma node 36:3. The header gear remains the
 * entry point; management destinations are presented over the sheet and
 * return here when dismissed.
 */
export default function OptionsModal({ visible, onClose }: OptionsModalProps) {
  const { colors, preference, setPreference } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions } = useTransactionsQuery();
  const clearDataMutation = useDeleteAllTransactionsMutation();
  const signOut = useAuthStore((state) => state.signOut);
  const [destination, setDestination] = useState<'accounts' | 'categories' | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const progress = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const count = transactions.length;
  const menuVisible = visible && destination === null;
  const sheetHeight = Math.min(FIGMA_SHEET_HEIGHT, windowHeight - spacing.sm);

  useEffect(() => {
    progress.value = withTiming(menuVisible ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [menuVisible, progress]);

  useEffect(() => {
    if (!visible) {
      setDestination(null);
    }
  }, [visible]);

  const close = () => {
    setDestination(null);
    onClose();
  };

  const confirmClearData = () => {
    Alert.alert(i18n.t('settings.clearTitle'), i18n.t('settings.clearMessage', { count }), [
      { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
      {
        text: i18n.t('settings.clearConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearDataMutation.mutateAsync();
            close();
          } catch (error) {
            Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(i18n.t('profile.logoutTitle'), i18n.t('profile.logoutMessage'), [
      { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
      {
        text: i18n.t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);

          try {
            close();
            await signOut();
          } catch (error) {
            setIsSigningOut(false);
            Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
          }
        },
      },
    ]);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [56, 0]) }],
  }));

  return (
    <>
      <Modal
        visible={menuVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={close}>
        <View style={styles.overlay} accessibilityViewIsModal>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('addTransaction.cancel')}
          />

          <Animated.View
            style={[
              styles.sheet,
              { height: sheetHeight, paddingBottom: Math.max(24, insets.bottom) },
              sheetStyle,
            ]}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {i18n.t('settings.title')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={close}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('addTransaction.cancel')}>
                <X color={colors.text} size={22} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>{i18n.t('settings.appearanceSection')}</Text>
            <SegmentedControl
              options={THEME_OPTIONS.map(({ id, label }) => ({ id, label: label() }))}
              value={preference}
              onChange={setPreference}
              style={styles.themeControl}
            />

            <Text style={styles.sectionLabel}>{i18n.t('settings.managementSection')}</Text>
            <View style={styles.group}>
              <OptionRow
                styles={styles}
                icon={<Wallet color={colors.tint} size={20} strokeWidth={1.8} />}
                label={i18n.t('settings.manageAccounts')}
                onPress={() => setDestination('accounts')}
                showChevron
              />
              <OptionRow
                styles={styles}
                icon={<Folder color={colors.tint} size={20} strokeWidth={1.8} />}
                label={i18n.t('settings.manageCategories')}
                onPress={() => setDestination('categories')}
                showChevron
                isLast
              />
            </View>

            <Text style={styles.sectionLabel}>{i18n.t('settings.sessionDataSection')}</Text>
            <View style={styles.group}>
              <OptionRow
                styles={styles}
                icon={isSigningOut ? <ActivityIndicator size="small" color={colors.text} /> : undefined}
                label={i18n.t('profile.logout')}
                onPress={handleLogout}
                isDisabled={isSigningOut}
              />
              <OptionRow
                styles={styles}
                label={i18n.t('settings.clearData')}
                onPress={confirmClearData}
                isDestructive
                isDisabled={count === 0}
                isLast
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ManageAccountsModal
        visible={destination === 'accounts'}
        onClose={() => setDestination(null)}
      />
      <ManageCategoriesModal
        visible={destination === 'categories'}
        onClose={() => setDestination(null)}
      />
    </>
  );
}

type SheetStyles = ReturnType<typeof createStyles>;

type OptionRowProps = {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  styles: SheetStyles;
  isDestructive?: boolean;
  isDisabled?: boolean;
  isLast?: boolean;
  showChevron?: boolean;
};

function OptionRow({
  icon,
  label,
  onPress,
  styles,
  isDestructive,
  isDisabled,
  isLast,
  showChevron,
}: OptionRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.row, !isLast && styles.rowDivider, isDisabled && styles.rowDisabled]}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.rowLabel,
          !icon && styles.rowLabelWithoutIcon,
          isDestructive && styles.rowLabelDestructive,
        ]}>
        {label}
      </Text>
      {showChevron ? <ChevronRight color={styles.chevronColor.color} size={18} strokeWidth={1.8} /> : null}
    </TouchableOpacity>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      backgroundColor: colors.overlay,
    },
    sheet: {
      width: '100%',
      overflow: 'hidden',
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.xl,
      gap: 20,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: colors.borderGlass,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 20,
    },
    header: {
      height: TOUCH_TARGET,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.border,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.35,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    themeControl: {
      minHeight: 48,
      marginTop: -1,
      backgroundColor: colors.brandSurface,
      borderWidth: 0,
    },
    group: {
      overflow: 'hidden',
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
    row: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowDisabled: {
      opacity: 0.4,
    },
    rowIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    rowLabelWithoutIcon: {
      paddingLeft: 0,
    },
    rowLabelDestructive: {
      color: colors.dangerText,
    },
    chevronColor: {
      color: colors.textMuted,
    },
  });
}
