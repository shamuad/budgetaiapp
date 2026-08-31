import { getUserAvatarUrl, i18n, useAuthStore } from '@budgetaiapp/shared';
import { router } from 'expo-router';
import { Plus, Settings } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import { InitialAvatar } from './InitialAvatar';
import type { SettingsAnchor } from './OptionsModal';

type TopHeaderProps = {
  onAddPress: () => void;
  onSettingsPress: (anchor: SettingsAnchor) => void;
};

/**
 * Global chrome above the tab screens: identity on the left, add + settings
 * on the right. The avatar and greeting both open Profile — photo changes
 * happen on that screen, not from the dashboard header.
 */
export default function TopHeader({ onAddPress, onSettingsPress }: TopHeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const settingsRef = useRef<View>(null);
  const user = useAuthStore((state) => state.user);
  const avatarUri = getUserAvatarUrl(user);

  const metadataName = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  const displayName = metadataName || user?.email || '';
  const name = firstName(displayName) || i18n.t('profile.namePlaceholder');
  const greeting = i18n.t(`header.${greetingKey()}`, { name });

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <Pressable
          style={styles.identity}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('tabs.profile')}>
          <View style={styles.avatarHit}>
            <InitialAvatar name={name} size={40} uri={avatarUri} />
          </View>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            style={styles.addButton}
            onPress={onAddPress}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('addTransaction.title')}>
            <Plus color={colors.onBrand} size={24} strokeWidth={2.5} />
          </Pressable>
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
              <Settings color={colors.text} size={20} strokeWidth={2} />
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

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: {
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    identity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
    },
    avatarHit: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
    greeting: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      letterSpacing: -0.2,
      color: colors.textMuted,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    addButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.brand,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    iconButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
    },
  });
}
