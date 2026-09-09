import { getUserAvatarUrl, i18n, useAuthStore } from '@budgetaiapp/shared';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import { InitialAvatar } from './InitialAvatar';
import type { SettingsAnchor } from './OptionsModal';

type TopHeaderProps = {
  hero?: boolean;
  onSettingsPress: (anchor: SettingsAnchor) => void;
};

/**
 * Global chrome above the tab screens: identity on the left, settings
 * on the right. The avatar and greeting both open Profile — photo changes
 * happen on that screen, not from the dashboard header.
 */
export default function TopHeader({ hero = false, onSettingsPress }: TopHeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, hero), [colors, hero]);
  const settingsRef = useRef<View>(null);
  const user = useAuthStore((state) => state.user);
  const avatarUri = getUserAvatarUrl(user);

  const metadataName = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  const displayName = metadataName || user?.email || '';
  const name = firstName(displayName) || i18n.t('profile.namePlaceholder');
  const greeting = hero
    ? i18n.t('dashboardDesign.greeting', { name })
    : i18n.t(`header.${greetingKey()}`, { name });

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <Pressable
          style={styles.identity}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('tabs.profile')}>
          <View style={styles.avatarHit}>
            <InitialAvatar name={name} size={hero ? 48 : 40} uri={avatarUri} />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.greeting} numberOfLines={2}>{greeting}</Text>
            {hero && <Text style={styles.subtitle}>{i18n.t('dashboardDesign.subtitle')}</Text>}
          </View>
        </Pressable>

        <View style={styles.actions}>
          <View ref={settingsRef} collapsable={false}>
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                settingsRef.current?.measureInWindow((x, y, width, height) => {
                  onSettingsPress({ x, y, width, height });
                });
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('settings.title')}>
              <Settings color={hero ? colors.onBrand : colors.text} size={22} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function greetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'greetingMorning';
  }

  if (hour < 18) {
    return 'greetingAfternoon';
  }

  return 'greetingEvening';
}

function firstName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('@')) {
    return trimmed.split('@')[0] ?? '';
  }

  return trimmed.split(/\s+/)[0] ?? '';
}

function createStyles(colors: ColorTokens, hero: boolean) {
  return StyleSheet.create({
    safe: {
      backgroundColor: hero ? 'transparent' : colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: 24,
      paddingTop: spacing.sm,
      paddingBottom: hero ? 24 : spacing.sm,
    },
    identity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
    },
    avatarHit: {
      width: hero ? 48 : TOUCH_TARGET,
      height: hero ? 48 : TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identityText: { flex: 1, gap: 2 },
    greeting: {
      fontSize: hero ? 21 : 15,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: hero ? colors.onBrand : colors.text,
    },
    subtitle: { fontSize: 13, lineHeight: 18, color: colors.onMastheadMuted },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: hero ? 'rgba(255,255,255,0.14)' : colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
  });
}
