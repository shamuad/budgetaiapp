import { deleteAllTransactions, i18n } from '@budgetaiapp/shared';
import { ChevronRight, Folder, Trash2, Wallet } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTransactions } from '../context/TransactionsContext';
import { colors, radius, spacing, TOUCH_TARGET } from '../theme';
import ManageAccountsModal from './manage/ManageAccountsModal';
import ManageCategoriesModal from './manage/ManageCategoriesModal';

type OptionsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Settings surface reached from the dashboard gear.
 * The management screens open on top of this sheet rather than replacing it, so
 * only one modal is ever presented at a time and closing one steps back here.
 */
export default function OptionsModal({ visible, onClose }: OptionsModalProps) {
  const { transactions, refetch } = useTransactions();
  const [destination, setDestination] = useState<'accounts' | 'categories' | null>(null);

  const count = transactions.length;

  /** Leaves the sheet on its top level, so reopening never lands mid-drilldown. */
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
            await deleteAllTransactions();
            await refetch();
            // Step back so the emptied dashboard is visible straight away.
            close();
          } catch (error) {
            Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <SafeAreaProvider>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Swallows taps so pressing the sheet itself never dismisses it. */}
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={['bottom']} style={styles.sheet}>
              <View style={styles.grabber} />
              <Text style={styles.title}>{i18n.t('settings.title')}</Text>

              <View style={styles.card}>
                <OptionRow
                  icon={<Wallet color={colors.tint} size={20} />}
                  label={i18n.t('settings.manageAccounts')}
                  onPress={() => setDestination('accounts')}
                />
                <OptionRow
                  icon={<Folder color={colors.tint} size={20} />}
                  label={i18n.t('settings.manageCategories')}
                  onPress={() => setDestination('categories')}
                />
                <OptionRow
                  icon={<Trash2 color={colors.danger} size={20} />}
                  label={i18n.t('settings.clearData')}
                  onPress={confirmClearData}
                  isDestructive
                  isDisabled={count === 0}
                  isLast
                />
              </View>

              <TouchableOpacity activeOpacity={0.7} onPress={close} style={styles.cancel}>
                <Text style={styles.cancelText}>{i18n.t('addTransaction.cancel')}</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </Pressable>
        </Pressable>

        <ManageAccountsModal
          visible={destination === 'accounts'}
          onClose={() => setDestination(null)}
        />
        <ManageCategoriesModal
          visible={destination === 'categories'}
          onClose={() => setDestination(null)}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

type OptionRowProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  isDisabled?: boolean;
  isLast?: boolean;
};

function OptionRow({ icon, label, onPress, isDestructive, isDisabled, isLast }: OptionRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.row, isLast && styles.rowLast, isDisabled && styles.rowDisabled]}>
      {icon}
      <Text style={[styles.rowLabel, isDestructive && styles.rowLabelDestructive]}>{label}</Text>
      {!isDestructive && <ChevronRight color={colors.chevron} size={18} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    marginTop: spacing.sm,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 8,
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
    fontSize: 16,
    color: colors.text,
  },
  rowLabelDestructive: {
    color: colors.dangerText,
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET + 8,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.tint,
  },
});
