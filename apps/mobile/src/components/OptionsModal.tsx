import {
  i18n,
  ThemePreference,
  useAuthStore,
  useDeleteAllTransactionsMutation,
  useTransactionsQuery,
} from '@budgetaiapp/shared';
import { Folder, LogOut, Trash2, Wallet } from 'lucide-react-native';
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

import { radius, spacing, TOUCH_TARGET } from '../theme';
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

const POPOVER_WIDTH = 232;
const POPOVER_GAP = 6;

/**
 * Settings popover anchored under the header gear. Manage screens open on
 * top of it; dismissing the overlay always returns to a closed gear.
 */
export default function OptionsModal({ visible, onClose, anchor }: OptionsModalProps) {
  const { colors, preference, setPreference } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions } = useTransactionsQuery();
  const clearDataMutation = useDeleteAllTransactionsMutation();
  const signOut = useAuthStore((state) => state.signOut);
  const [destination, setDestination] = useState<'accounts' | 'categories' | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const progress = useSharedValue(0);

  const count = transactions.length;
  const menuVisible = visible && destination === null;

  useEffect(() => {
    progress.value = withTiming(menuVisible ? 1 : 0, {
      duration: 160,
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

  const { width: windowWidth } = useWindowDimensions();
  const placement = placePopover(anchor, windowWidth);
  const popoverStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-6, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
    ],
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
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('addTransaction.cancel')}
          />

          <Animated.View style={[styles.popover, placement, popoverStyle]}>
            <Text style={styles.themeLabel}>{i18n.t('profile.appTheme')}</Text>
            <SegmentedControl
              options={THEME_OPTIONS.map(({ id, label }) => ({ id, label: label() }))}
              value={preference}
              onChange={setPreference}
              style={styles.themeControl}
            />

            <OptionRow
              styles={styles}
              icon={<Wallet color={colors.tint} size={18} />}
              label={i18n.t('settings.manageAccounts')}
              onPress={() => setDestination('accounts')}
            />
            <OptionRow
              styles={styles}
              icon={<Folder color={colors.tint} size={18} />}
              label={i18n.t('settings.manageCategories')}
              onPress={() => setDestination('categories')}
            />

            <OptionRow
              styles={styles}
              icon={<Trash2 color={colors.danger} size={18} />}
              label={i18n.t('settings.clearData')}
              onPress={confirmClearData}
              isDestructive
              isDisabled={count === 0}
            />
            <OptionRow
              styles={styles}
              icon={
                isSigningOut ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <LogOut color={colors.danger} size={18} />
                )
              }
              label={i18n.t('profile.logout')}
              onPress={handleLogout}
              isDestructive
              isDisabled={isSigningOut}
              isLast
            />
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

function placePopover(anchor: SettingsAnchor | null, windowWidth: number) {
  const maxLeft = windowWidth - POPOVER_WIDTH - spacing.lg;
  const alignedLeft = anchor ? anchor.x + anchor.width - POPOVER_WIDTH : maxLeft;
  const left = Math.min(Math.max(spacing.lg, alignedLeft), maxLeft);
  const top = anchor ? anchor.y + anchor.height + POPOVER_GAP : 72;

  return { top, left, width: POPOVER_WIDTH };
}

type SheetStyles = ReturnType<typeof createStyles>;

type OptionRowProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  styles: SheetStyles;
  isDestructive?: boolean;
  isDisabled?: boolean;
  isLast?: boolean;
};

function OptionRow({
  icon,
  label,
  onPress,
  styles,
  isDestructive,
  isDisabled,
  isLast,
}: OptionRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.row, isLast && styles.rowLast, isDisabled && styles.rowDisabled]}>
      {icon}
      <Text style={[styles.rowLabel, isDestructive && styles.rowLabelDestructive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
    },
    popover: {
      position: 'absolute',
      transformOrigin: 'top right',
      overflow: 'hidden',
      paddingTop: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 16,
    },
    themeLabel: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    themeControl: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowDisabled: {
      opacity: 0.4,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    rowLabelDestructive: {
      color: colors.dangerText,
    },
  });
}
