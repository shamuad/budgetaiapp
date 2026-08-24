import { i18n } from '@budgetaiapp/shared';
import { Pencil, Trash2 } from 'lucide-react-native';
import { ReactNode, useMemo, useRef } from 'react';
import {
  Alert,
  AlertButton,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type TransactionItemProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  amount: string;
  positive?: boolean;
  /** Trailing detail on the subtitle line, such as the account. Hidden when absent. */
  meta?: string;
  /** Drops the card background, for rows that already sit inside one. */
  flat?: boolean;
  /** Supplying either handler turns the row into a swipeable (iOS) or long-pressable (Android) row. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Overrides the generic delete copy, e.g. to warn that a linked installment plan deletes together. */
  deleteConfirmation?: { title: string; message: string; confirmLabel?: string };
};

export default function TransactionItem({
  icon,
  title,
  subtitle,
  amount,
  positive,
  meta,
  flat,
  onEdit,
  onDelete,
  deleteConfirmation,
}: TransactionItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);
  const isActionable = Boolean(onEdit || onDelete);

  function confirmDelete() {
    Alert.alert(
      deleteConfirmation?.title ?? i18n.t('transactionActions.deleteConfirmTitle'),
      deleteConfirmation?.message ?? i18n.t('transactionActions.deleteConfirmMessage'),
      [
        { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
        {
          text: deleteConfirmation?.confirmLabel ?? i18n.t('transactionActions.delete'),
          style: 'destructive',
          onPress: () => onDelete?.(),
        },
      ],
    );
  }

  function handleSwipeEdit() {
    swipeableRef.current?.close();
    onEdit?.();
  }

  function handleSwipeDelete() {
    swipeableRef.current?.close();
    confirmDelete();
  }

  /** Android surfaces row actions through the platform's own dialog. */
  function showActionsMenu() {
    const buttons: AlertButton[] = [];

    if (onEdit) {
      buttons.push({ text: i18n.t('transactionActions.edit'), onPress: onEdit });
    }

    if (onDelete) {
      buttons.push({
        text: i18n.t('transactionActions.delete'),
        style: 'destructive',
        onPress: confirmDelete,
      });
    }

    buttons.push({ text: i18n.t('addTransaction.cancel'), style: 'cancel' });

    Alert.alert(i18n.t('transactionActions.actionsTitle'), title, buttons);
  }

  const row = (
    // An actionable row must be opaque so it can slide over the revealed buttons.
    <View style={[styles.item, flat && styles.itemFlat, isActionable && styles.itemOpaque]}>
      <View style={styles.iconWrapper}>{icon}</View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {/* One line keeps a long account name from reflowing the row. */}
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
          {meta ? <Text style={styles.meta}> · {meta}</Text> : null}
        </Text>
      </View>
      <Text style={[styles.amount, positive && styles.amountPositive]}>{amount}</Text>
    </View>
  );

  if (!isActionable) {
    return row;
  }

  // iOS expects a swipe to reveal row actions.
  if (Platform.OS === 'ios') {
    return (
      <Swipeable
        ref={swipeableRef}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actions}>
            {onEdit ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.action, styles.actionEdit]}
                onPress={handleSwipeEdit}>
                <Pencil color={colors.onBrand} size={18} />
                <Text style={styles.actionText}>{i18n.t('transactionActions.edit')}</Text>
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.action, styles.actionDelete]}
                onPress={handleSwipeDelete}>
                <Trash2 color={colors.onBrand} size={18} />
                <Text style={styles.actionText}>{i18n.t('transactionActions.delete')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}>
        {row}
      </Swipeable>
    );
  }

  // Android expects a long press to open a menu. Deliberately outside Swipeable,
  // which would otherwise claim the touch before the long press can fire.
  return (
    <Pressable
      onLongPress={showActionsMenu}
      delayLongPress={300}
      android_ripple={{ color: colors.border }}>
      {row}
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    itemFlat: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      padding: 0,
    },
    // Matches the card behind it, so the row looks unchanged while staying opaque.
    itemOpaque: {
      backgroundColor: colors.surfaceElevated,
    },
    iconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandSurface,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    // Nested in the subtitle, so it only needs to differ in weight.
    meta: {
      fontWeight: '500',
    },
    amount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    amountPositive: {
      color: colors.income,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    action: {
      width: 76,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: TOUCH_TARGET,
    },
    actionEdit: {
      backgroundColor: colors.tint,
    },
    actionDelete: {
      backgroundColor: colors.danger,
      borderTopRightRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBrand,
    },
  });
}
