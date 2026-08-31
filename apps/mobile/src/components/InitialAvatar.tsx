import { useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { useAppTheme, type ColorTokens } from '../theming';

type InitialAvatarProps = {
  /** Whatever the caller currently has for a name (or email as a fallback) — first letter is used. */
  name: string;
  size?: number;
  /** When set, the photo replaces the initial. */
  uri?: string | null;
  /** Semi-transparent overlay + spinner while a new photo is uploading. */
  loading?: boolean;
};

/**
 * Circular identity mark: a brand-colored initial, or the user's profile photo
 * once one has been uploaded. The loading overlay sits on top of either state.
 */
export function InitialAvatar({ name, size = 88, uri, loading = false }: InitialAvatarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={styles.initial}>{initial}</Text>
        )}
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.onBrand} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens, size: number) {
  return StyleSheet.create({
    wrap: {
      width: size,
      height: size,
      borderRadius: size / 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: size < 48 ? 2 : 6 },
      shadowOpacity: size < 48 ? 0.1 : 0.16,
      shadowRadius: size < 48 ? 6 : 12,
      elevation: size < 48 ? 2 : 4,
    },
    badge: {
      flex: 1,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.brand,
    },
    image: {
      ...StyleSheet.absoluteFill,
      width: size,
      height: size,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay,
    },
    initial: {
      fontSize: size * 0.4,
      fontWeight: '800',
      color: colors.onBrand,
      letterSpacing: -0.5,
    },
  });
}
