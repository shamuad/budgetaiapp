import {
  Asset,
  DEFAULT_CURRENCY,
  formatCurrency,
  getFaviconUrl,
  isRemoteIcon,
  resolveAccountCardAppearance,
  resolveBrand,
} from '@budgetaiapp/shared';
import { Wallet } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { spacing } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import CardSurface from './CardSurface';

/** Fixed card size — exported so the Dashboard can size the trailing "Add Account" tile to match. */
export const ACCOUNT_CARD_WIDTH = 200;
export const ACCOUNT_CARD_HEIGHT = 126;

type AccountCardProps = {
  asset: Asset;
  balance: number;
  isFocused: boolean;
  isDimmed: boolean;
  onPress: () => void;
};

export default function AccountCard({
  asset,
  balance,
  isFocused,
  isDimmed,
  onPress,
}: AccountCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brand = resolveBrand(asset.name);
  const appearance = resolveAccountCardAppearance(asset);
  const faviconUri = isRemoteIcon(asset.icon)
    ? asset.icon!
    : brand
      ? getFaviconUrl(brand.domain)
      : null;
  const [faviconFailed, setFaviconFailed] = useState(false);

  const emphasis = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFaviconFailed(false);
  }, [faviconUri]);

  useEffect(() => {
    Animated.spring(emphasis, {
      toValue: isFocused ? 1 : isDimmed ? -1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [emphasis, isDimmed, isFocused]);

  const scale = emphasis.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.96, 1, 1.04],
    extrapolate: 'clamp',
  });
  const opacity = emphasis.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.45, 1, 1],
    extrapolate: 'clamp',
  });

  const showFavicon = Boolean(faviconUri) && !faviconFailed;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Animated.View
        style={[
          styles.cardWrap,
          { opacity, transform: [{ scale }] },
          isFocused && styles.cardWrapFocused,
        ]}>
        <CardSurface appearance={appearance} style={[styles.card, isFocused && styles.cardFocused]}>
          <View style={styles.sheen} />
          <View style={styles.chip} />

          <View style={styles.topRow}>
            <Text style={styles.institution} numberOfLines={1}>
              {brand?.name ?? asset.name}
            </Text>

            <View style={styles.brandMark}>
              {showFavicon ? (
                <Image
                  source={{ uri: faviconUri! }}
                  style={styles.favicon}
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <Wallet color={colors.onBrand} size={18} strokeWidth={2} />
              )}
            </View>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.label}>Balance</Text>
            <Text
              style={styles.balance}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {formatCurrency(balance, DEFAULT_CURRENCY)}
            </Text>
          </View>
        </CardSurface>
      </Animated.View>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    cardWrap: {
      width: ACCOUNT_CARD_WIDTH,
      height: ACCOUNT_CARD_HEIGHT,
      borderRadius: 18,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 12,
    },
    cardWrapFocused: {
      shadowOpacity: 0.44,
      shadowRadius: 28,
      elevation: 16,
    },
    card: {
      flex: 1,
      borderRadius: 18,
      padding: spacing.lg,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.10)',
    },
    cardFocused: {
      borderColor: 'rgba(255, 255, 255, 0.55)',
    },
    sheen: {
      position: 'absolute',
      top: -48,
      right: -32,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    chip: {
      position: 'absolute',
      top: spacing.lg + 28,
      left: spacing.lg,
      width: 34,
      height: 24,
      borderRadius: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.28)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    institution: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.onBrand,
    },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    favicon: {
      width: 20,
      height: 20,
      borderRadius: 4,
    },
    bottomRow: {
      gap: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.4,
      color: 'rgba(255, 255, 255, 0.72)',
    },
    balance: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      color: colors.onBrand,
    },
  });
}
