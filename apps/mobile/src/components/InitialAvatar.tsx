import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme, type ColorTokens } from '../theming';

type InitialAvatarProps = {
  /** Whatever the caller currently has for a name (or email as a fallback) — first letter is used. */
  name: string;
  size?: number;
};

/**
 * A vibrant, brand-colored circular badge showing the first letter of `name`
 * in bold, high-contrast type — the identity mark until a real profile
 * photo is wired up. Reusable anywhere a user needs a lightweight avatar.
 */
export function InitialAvatar({ name, size = 88 }: InitialAvatarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.badge}>
      <Text style={styles.initial}>{initial}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens, size: number) {
  return StyleSheet.create({
    badge: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    initial: {
      fontSize: size * 0.4,
      fontWeight: '800',
      color: colors.onBrand,
      letterSpacing: -0.5,
    },
  });
}
