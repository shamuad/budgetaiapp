import { i18n, useAuthStore } from '@budgetaiapp/shared';
import Constants from 'expo-constants';
import { Crown, Info } from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InitialAvatar } from './InitialAvatar';
import { useUpdateAvatar } from '../hooks/useUpdateAvatar';
import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme } from '../theming';
import type { ColorTokens } from '../theming';

/** Identity screen: avatar, name, and app version. Theme and log out live on the header gear. */
export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const user = useAuthStore((state) => state.user);
  const { avatarUri, isUploading, updateAvatar } = useUpdateAvatar();

  const metadataName = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  const displayName = metadataName || (user?.email ?? '') || i18n.t('profile.namePlaceholder');

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => void updateAvatar()}
            disabled={isUploading}
            style={styles.avatarRing}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('profile.changeAvatar')}
            accessibilityState={{ busy: isUploading }}>
            <InitialAvatar name={displayName} size={88} uri={avatarUri} loading={isUploading} />
          </TouchableOpacity>

          <Text style={styles.name}>{displayName}</Text>

          <View style={styles.premiumBadge}>
            <Crown color={colors.premium} size={14} fill={colors.premium} />
            <Text style={styles.premiumLabel}>{i18n.t('profile.premium')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('profile.settingsSection')}</Text>

          <View style={styles.glassCard}>
            <SettingsRow
              icon={<Info color={colors.textMuted} size={20} />}
              styles={styles}
              label={i18n.t('profile.version')}
              isLast>
              <Text style={styles.versionValue}>{appVersion}</Text>
            </SettingsRow>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof createStyles>;

type SettingsRowProps = {
  icon: ReactNode;
  styles: Styles;
  label: string;
  hint?: string;
  isLast?: boolean;
  /** Turns the row into a navigable link, e.g. to a sub-screen. */
  onPress?: () => void;
  children: ReactNode;
};

/** One labeled row inside the glass settings card; `children` is the row's control. */
function SettingsRow({ icon, styles, label, hint, isLast, onPress, children }: SettingsRowProps) {
  const content = (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowHeader}>
        {icon}
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          {hint && <Text style={styles.rowHint}>{hint}</Text>}
        </View>
      </View>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },
    identity: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    avatarRing: {
      width: 108,
      height: 108,
      borderRadius: 54,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandSurface,
      borderWidth: 1,
      borderColor: colors.borderGlass,
    },
    name: {
      marginTop: spacing.xs,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: colors.text,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.lg,
      backgroundColor: colors.premiumSurface,
    },
    premiumLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.premium,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    // Semi-transparent surface + hairline border stand in for glass without a blur dependency.
    // Android's `elevation` shadow renders on its own compositing layer that doesn't
    // blend alpha correctly, turning the intended translucent fill into a flat, stark
    // opaque block — so Android falls back to an already-opaque elevated surface.
    glassCard: {
      backgroundColor: Platform.OS === 'android' ? colors.surfaceElevated : colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 2,
    },
    row: {
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      minHeight: TOUCH_TARGET - 12,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    rowHint: {
      fontSize: 13,
      color: colors.textMuted,
    },
    versionValue: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
