import { getSupabase, i18n, useAuthStore } from '@budgetaiapp/shared';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, TOUCH_TARGET } from '../../src/theme';
import { useAppTheme, type ColorTokens } from '../../src/theming';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Where a Supabase recovery deep link lands. The link has already established
 * a session by the time this renders — all that's left is choosing the new
 * password.
 */
export default function UpdatePasswordScreen() {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setIsPasswordRecovery = useAuthStore((state) => state.setIsPasswordRecovery);

  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(i18n.t('auth.passwordTooShort'));
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await getSupabase().auth.updateUser({ password });

      if (error) {
        throw error;
      }

      // Releases the guard's hold on the `(auth)` group: with the reset done
      // and a live session in place, the root layout swaps to the tabs.
      setIsPasswordRecovery(false);
    } catch (error) {
      setErrorMessage((error as Error).message);
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{i18n.t('auth.newPasswordTitle')}</Text>
            <Text style={styles.subtitle}>{i18n.t('auth.newPasswordSubtitle')}</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{i18n.t('auth.newPasswordLabel')}</Text>
            <View style={styles.inputRow}>
              <Lock color={colors.textMuted} size={18} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={i18n.t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.placeholder}
                keyboardAppearance={scheme}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                secureTextEntry={!isPasswordVisible}
                returnKeyType="done"
                editable={!isSubmitting}
                onSubmitEditing={() => void handleSave()}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsPasswordVisible((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={
                  isPasswordVisible ? i18n.t('auth.hidePassword') : i18n.t('auth.showPassword')
                }>
                {isPasswordVisible ? (
                  <EyeOff color={colors.textMuted} size={18} />
                ) : (
                  <Eye color={colors.textMuted} size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.submit, isSubmitting && styles.submitDisabled]}
            onPress={() => void handleSave()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('auth.savePassword')}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={styles.submitLabel}>{i18n.t('auth.savePassword')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.lg,
    },
    header: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 21,
    },
    errorBanner: {
      borderRadius: radius.md,
      backgroundColor: colors.dangerSurface,
      padding: spacing.md,
    },
    errorText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.dangerText,
      textAlign: 'center',
    },
    field: {
      gap: spacing.xs,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TOUCH_TARGET + 8,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: spacing.sm,
    },
    submit: {
      minHeight: TOUCH_TARGET + 8,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      marginTop: spacing.xs,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 3,
    },
    submitDisabled: {
      opacity: 0.7,
    },
    submitLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onBrand,
    },
  });
}
