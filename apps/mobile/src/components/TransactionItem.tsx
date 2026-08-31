import {
  getFaviconUrl,
  i18n,
  isRemoteIcon,
  resolveBrand,
} from '@budgetaiapp/shared';
import { Trash2, Wallet } from 'lucide-react-native';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { radius, spacing } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

export type TransactionAccount = {
  name: string;
  icon: string | null;
};

type TransactionItemProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  amount: string;
  positive?: boolean;
  /** Account shown under the amount, with its bank mark. Hidden when absent. */
  account?: TransactionAccount | null;
  /** Drops the card background, for rows that already sit inside one. */
  flat?: boolean;
  /** Tap opens the editor. */
  onEdit?: () => void;
  /** Left-swipe reveals a single Delete action. */
  onDelete?: () => void;
  /** Overrides the generic delete copy, e.g. to warn that a linked installment plan deletes together. */
  deleteConfirmation?: { title: string; message: string; confirmLabel?: string };
};

/** Name + icon for the trailing account chip — source account, or both sides of a transfer. */
export function transactionAccount(row: {
  type: string;
  asset: { name: string; icon: string | null } | null;
  to_asset: { name: string; icon: string | null } | null;
  asset_symbol: string | null;
}): TransactionAccount | null {
  if (row.type === 'transfer') {
    const route = [row.asset?.name, row.to_asset?.name].filter(Boolean).join(' → ');
    const name = row.asset_symbol
      ? route
        ? `${route} · ${row.asset_symbol}`
        : row.asset_symbol
      : route;

    if (!name) {
      return null;
    }

    return { name, icon: row.asset?.icon ?? row.to_asset?.icon ?? null };
  }

  if (!row.asset) {
    return null;
  }

  return { name: row.asset.name, icon: row.asset.icon };
}

export default function TransactionItem({
  icon,
  title,
  subtitle,
  amount,
  positive,
  account,
  flat,
  onEdit,
  onDelete,
  deleteConfirmation,
}: TransactionItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);
  const isSwipeOpen = useRef(false);
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

  function handleSwipeDelete() {
    swipeableRef.current?.close();
    confirmDelete();
  }

  /** A tap on an open swipe closes it; otherwise it opens the editor. */
  function handlePress() {
    if (isSwipeOpen.current) {
      swipeableRef.current?.close();
      return;
    }

    onEdit?.();
  }

  const row = (
    // RN Pressable for tap-to-edit. Horizontal pans stay with Swipeable
    // (`activeOffsetX`); a nested GH touchable as the action was collapsing
    // to the icon's height and eating hits.
    <Pressable
      onPress={handlePress}
      disabled={!onEdit && !onDelete}
      accessibilityRole={onEdit ? 'button' : 'none'}
      accessibilityLabel={onEdit ? i18n.t('transactionActions.edit') : undefined}>
      <View
        style={[
          styles.item,
          flat && styles.itemFlat,
          isActionable && (flat ? styles.itemOpaqueOnCanvas : styles.itemOpaque),
        ]}>
        <View style={styles.iconWrapper}>{icon}</View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.trailing}>
          <Text style={[styles.amount, positive && styles.amountPositive]} numberOfLines={1}>
            {amount}
          </Text>
          {account ? (
            <View style={styles.accountRow}>
              <AccountGlyph name={account.name} icon={account.icon} colors={colors} styles={styles} />
              <Text style={styles.accountName} numberOfLines={1}>
                {account.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  if (!onDelete) {
    return row;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableOpen={() => {
        isSwipeOpen.current = true;
      }}
      onSwipeableClose={() => {
        isSwipeOpen.current = false;
      }}
      renderRightActions={() => (
        <RectButton
          style={[styles.actionDelete, flat && styles.actionDeleteHome]}
          onPress={handleSwipeDelete}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('transactionActions.delete')}>
          <Trash2 color={colors.onBrand} size={20} />
        </RectButton>
      )}>
      {row}
    </Swipeable>
  );
}

function AccountGlyph({
  name,
  icon,
  colors,
  styles,
}: {
  name: string;
  icon: string | null;
  colors: ColorTokens;
  styles: ReturnType<typeof createStyles>;
}) {
  const brand = resolveBrand(name);
  const uri = isRemoteIcon(icon) ? icon! : brand ? getFaviconUrl(brand.domain, 32) : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return <Image source={{ uri }} style={styles.accountGlyph} onError={() => setFailed(true)} />;
  }

  if (icon && !isRemoteIcon(icon)) {
    return (
      <Text style={styles.accountEmoji} numberOfLines={1}>
        {icon}
      </Text>
    );
  }

  return <Wallet color={colors.textMuted} size={12} strokeWidth={2} />;
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
    // Flat rows sit on the screen canvas — still opaque so swipe actions can slide under.
    itemOpaqueOnCanvas: {
      backgroundColor: colors.background,
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
      minWidth: 0,
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
    trailing: {
      alignItems: 'flex-end',
      gap: 2,
      flexShrink: 0,
      maxWidth: '48%',
    },
    amount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'right',
    },
    amountPositive: {
      color: colors.income,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      maxWidth: '100%',
    },
    accountGlyph: {
      width: 14,
      height: 14,
      borderRadius: 3,
    },
    accountEmoji: {
      fontSize: 11,
      lineHeight: 14,
    },
    accountName: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      textAlign: 'right',
    },
    actionDelete: {
      width: 80,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
    },
    // Home rows sit flush on the canvas — a hairline gap keeps the amount
    // from touching the delete strip.
    actionDeleteHome: {
      marginLeft: 1,
    },
  });
}
