import { getSupabase, i18n } from '@budgetaiapp/shared';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
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

/**
 * Collects the account email and asks Supabase to send a recovery link.
 * `redirectTo` is this app's own deep link, so opening the email on this
 * device reopens the app straight on `update-password` — see `AuthProvider`.
 */
export default function ForgotPasswordScreen() {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSendResetLink() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage(i18n.t('auth.missingEmail'));
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: Linking.createURL('/update-password'),
      });

      if (error) {
        throw error;
      }

      setInfoMessage(i18n.t('auth.resetLinkSent', { email: trimmedEmail }));
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
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
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('auth.backToLogin')}>
              <ArrowLeft color={colors.text} size={20} />
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <Text style={styles.title}>{i18n.t('auth.forgotPasswordTitle')}</Text>
            <Text style={styles.subtitle}>{i18n.t('auth.forgotPasswordSubtitle')}</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {infoMessage ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>{infoMessage}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{i18n.t('auth.emailLabel')}</Text>
            <View style={styles.inputRow}>
              <Mail color={colors.textMuted} size={18} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={i18n.t('auth.emailPlaceholder')}
                placeholderTextColor={colors.placeholder}
                keyboardAppearance={scheme}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                editable={!isSubmitting}
                onSubmitEditing={() => void handleSendResetLink()}
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.submit, isSubmitting && styles.submitDisabled]}
            onPress={() => void handleSendResetLink()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('auth.sendResetLink')}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={styles.submitLabel}>{i18n.t('auth.sendResetLink')}</Text>
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
    backButton: {
      position: 'absolute',
      top: spacing.xl,
      left: spacing.xl,
      width: TOUCH_TARGET - 8,
      height: TOUCH_TARGET - 8,
      borderRadius: (TOUCH_TARGET - 8) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
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
    infoBanner: {
      borderRadius: radius.md,
      backgroundColor: colors.brandSurface,
      padding: spacing.md,
    },
    infoText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brand,
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
