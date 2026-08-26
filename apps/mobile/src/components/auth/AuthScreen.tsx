import { getSupabase, i18n } from '@budgetaiapp/shared';
import { Link } from 'expo-router';
import { Apple, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';

type AuthMode = 'login' | 'signup';

type AuthScreenProps = {
  mode: AuthMode;
};

/**
 * Shared login/signup UI and Supabase wiring. A successful sign-in or
 * confirmed sign-up flips `useAuthStore` via `onAuthStateChange`, and the
 * root layout's `Stack.Protected` guard swaps to the tabs on its own —
 * this screen never navigates there itself.
 */
export default function AuthScreen({ mode }: AuthScreenProps) {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLogin = mode === 'login';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!isLogin && !trimmedName) {
      setErrorMessage(i18n.t('auth.missingName'));
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage(i18n.t('auth.missingEmail'));
      return;
    }

    if (!password) {
      setErrorMessage(i18n.t('auth.missingPassword'));
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name: trimmedName } },
        });

        if (error) {
          throw error;
        }

        // No session back means the project requires email confirmation
        // before Supabase will issue one.
        if (!data.session) {
          setInfoMessage(i18n.t('auth.signupSuccessMessage', { email: trimmedEmail }));
        }
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSocialPlaceholder(provider: string) {
    setErrorMessage(null);
    setInfoMessage(null);
    Alert.alert(i18n.t('auth.comingSoonTitle'), i18n.t('auth.comingSoonMessage', { provider }));
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
          <View style={styles.brand}>
            <View style={styles.logoRing}>
              <View style={styles.logo}>
                <Text style={styles.logoGlyph}>$</Text>
              </View>
            </View>
            <Text style={styles.title}>
              {isLogin ? i18n.t('auth.loginTitle') : i18n.t('auth.signupTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? i18n.t('auth.loginSubtitle') : i18n.t('auth.signupSubtitle')}
            </Text>
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

          <View style={styles.form}>
            {!isLogin ? (
              <View style={styles.field}>
                <Text style={styles.label}>{i18n.t('auth.nameLabel')}</Text>
                <View style={styles.inputRow}>
                  <User color={colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={i18n.t('auth.namePlaceholder')}
                    placeholderTextColor={colors.placeholder}
                    keyboardAppearance={scheme}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    editable={!isSubmitting}
                  />
                </View>
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
                  returnKeyType="next"
                  editable={!isSubmitting}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{i18n.t('auth.passwordLabel')}</Text>
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
                  autoComplete={isLogin ? 'password' : 'new-password'}
                  textContentType={isLogin ? 'password' : 'newPassword'}
                  secureTextEntry={!isPasswordVisible}
                  returnKeyType="done"
                  editable={!isSubmitting}
                  onSubmitEditing={() => void handleSubmit()}
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

            {isLogin ? (
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={isSubmitting}
                  style={styles.forgotPasswordLink}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('auth.forgotPassword')}>
                  <Text style={styles.forgotPasswordText}>{i18n.t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              </Link>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submit, isSubmitting && styles.submitDisabled]}
              onPress={() => void handleSubmit()}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={isLogin ? i18n.t('auth.signIn') : i18n.t('auth.signUp')}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={styles.submitLabel}>
                  {isLogin ? i18n.t('auth.signIn') : i18n.t('auth.signUp')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{i18n.t('auth.orContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialColumn}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.socialButton}
              onPress={() => handleSocialPlaceholder('Apple')}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('auth.continueWithApple')}>
              <Apple color={colors.text} size={18} fill={colors.text} />
              <Text style={styles.socialLabel}>{i18n.t('auth.continueWithApple')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.socialButton}
              onPress={() => handleSocialPlaceholder('Google')}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('auth.continueWithGoogle')}>
              <Text style={styles.googleGlyph}>G</Text>
              <Text style={styles.socialLabel}>{i18n.t('auth.continueWithGoogle')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isLogin ? i18n.t('auth.noAccount') : i18n.t('auth.haveAccount')}
            </Text>
            <Link href={isLogin ? '/(auth)/signup' : '/(auth)/login'} replace asChild>
              <TouchableOpacity activeOpacity={0.7} disabled={isSubmitting}>
                <Text style={styles.footerLink}>
                  {isLogin ? i18n.t('auth.createAccount') : i18n.t('auth.logIn')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
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
    brand: {
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    logoRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandSurface,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      marginBottom: spacing.sm,
    },
    logo: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 4,
    },
    logoGlyph: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.onBrand,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
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
    form: {
      gap: spacing.lg,
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
    forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginTop: -spacing.sm,
    },
    forgotPasswordText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brand,
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
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.3,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    socialColumn: {
      gap: spacing.sm,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: TOUCH_TARGET + 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderGlass,
    },
    googleGlyph: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.brand,
    },
    socialLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    footerText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.brand,
    },
  });
}
