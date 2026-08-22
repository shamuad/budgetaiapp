import {
  Asset,
  DEFAULT_CURRENCY,
  formatMoney,
  getAccountCardColor,
  getFaviconUrl,
  isRemoteIcon,
  resolveBrand,
} from '@budgetaiapp/shared';
import { Wallet } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../theme';

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
  const brand = resolveBrand(asset.name);
  const backgroundColor = getAccountCardColor(asset);
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
          styles.card,
          { backgroundColor, opacity, transform: [{ scale }] },
          isFocused && styles.cardFocused,
        ]}>
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
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {formatMoney(balance, DEFAULT_CURRENCY)}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    height: 126,
    borderRadius: 18,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  cardFocused: {
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 12,
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
