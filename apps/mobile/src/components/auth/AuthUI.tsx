import { i18n } from '@budgetaiapp/shared';
import { Link, useFocusEffect, type Href } from 'expo-router';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { EyeOff } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { authVectors } from '../../../assets/auth/vectors';
import { useAppTheme } from '../../theming';

// Approved auth palette is intentionally fixed, like the dark welcome, independent of ledger theme.
export const authColors = {
  paper: '#F1F7F3',
  forest: '#173F33',
  muted: '#64796F',
  field: '#F5F8F6',
  border: '#DFE9E2',
  mint: '#8ECFA7',
  charcoal: '#0A100E',
  link: '#087F5B',
};
export const authFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
export const flowText = (key: string, options?: Record<string, unknown>) =>
  i18n.t(`authFlow.${key}`, options);

export function useAuthSystemBars(dark = false) {
  const { colors, scheme } = useAppTheme();
  useFocusEffect(
    useCallback(() => {
      void SystemUI.setBackgroundColorAsync(dark ? authColors.charcoal : authColors.paper).catch(
        () => {},
      );
      if (Platform.OS === 'android') NavigationBar.setStyle(dark ? 'light' : 'dark');
      return () => {
        void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
        if (Platform.OS === 'android') NavigationBar.setStyle(scheme === 'dark' ? 'light' : 'dark');
      };
    }, [dark, colors.background, scheme]),
  );
}

export function AuthLogo({ white = false, width = 132 }: { white?: boolean; width?: number }) {
  return (
    <SvgXml
      xml={white ? authVectors.logoWhite : authVectors.logo}
      width={width}
      height={(width * 36) / 132}
      accessibilityLabel="Budgree"
    />
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  statusIcon,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  statusIcon?: 'mail' | 'expired';
}) {
  const insets = useSafeAreaInsets();
  useAuthSystemBars();
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Image
        accessible={false}
        source={require('../../../assets/auth/atmosphere.png')}
        style={styles.atmosphere}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Math.max(60, insets.top + 16),
              paddingBottom: Math.max(28, insets.bottom + 8),
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Link href="/(auth)/welcome" asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={flowText('backWelcome')}
                  style={styles.logoLink}
                >
                  <AuthLogo />
                </Pressable>
              </Link>
              {statusIcon ? <SvgXml xml={authVectors[statusIcon]} width={64} height={64} /> : null}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function AuthBody({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}
export function AuthNote({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}
export function AuthMessage({
  message,
  error = false,
}: {
  message: string | null;
  error?: boolean;
}) {
  if (!message) return null;
  return (
    <View style={[styles.message, error && styles.error]}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole={error ? 'alert' : undefined}
        style={[styles.messageText, error && styles.errorText]}
      >
        {message}
      </Text>
    </View>
  );
}

export function AuthField({
  label,
  password = false,
  invalid = false,
  ...props
}: TextInputProps & { label: string; password?: boolean; invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.focusedField, invalid && styles.invalidField]}>
      <View style={styles.fieldText}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          {...props}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={authColors.muted}
          autoCorrect={false}
          keyboardAppearance="light"
          secureTextEntry={password && !visible}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
      </View>
      {password ? (
        <Pressable
          onPress={() => setVisible(!visible)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          accessibilityState={{ checked: visible }}
          style={styles.eye}
        >
          {visible ? (
            <EyeOff color={authColors.muted} size={20} />
          ) : (
            <SvgXml xml={authVectors.eye} width={20} height={20} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function AuthButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  provider,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  provider?: 'apple' | 'google';
}) {
  const ink = secondary || provider === 'google';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        provider === 'apple' && styles.apple,
        provider === 'google' && styles.google,
        (disabled || busy || pressed) && styles.dim,
      ]}
    >
      {provider && !busy ? (
        <View style={styles.providerIcon}>
          <SvgXml
            xml={authVectors[provider]}
            width={provider === 'apple' ? 18 : 20}
            height={provider === 'apple' ? 22 : 20}
          />
        </View>
      ) : null}
      {busy ? (
        <ActivityIndicator color={ink ? authColors.forest : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, ink && styles.ink]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function AuthNav({
  href,
  label,
  right = false,
  onPress,
}: {
  href?: Href;
  label: string;
  right?: boolean;
  onPress?: () => void;
}) {
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={StyleSheet.flatten([styles.nav, right && styles.navRight])}
    >
      <Text style={[styles.navText, right && styles.ink]}>{label}</Text>
    </Pressable>
  );
  return href ? (
    <Link href={href} replace asChild>
      {button}
    </Link>
  ) : (
    button
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: authColors.paper },
  atmosphere: { position: 'absolute', right: 0, top: 0, width: 288, height: 202 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  content: { width: '100%', maxWidth: 440, gap: 24 },
  header: { gap: 10 },
  logoLink: { alignSelf: 'flex-start', minHeight: 36 },
  title: {
    fontFamily: authFonts.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
    color: authColors.forest,
  },
  subtitle: {
    fontFamily: authFonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: authColors.muted,
  },
  footer: { width: '100%', maxWidth: 440 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 24,
    padding: 19,
    gap: 16,
    shadowColor: '#17402B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  body: { gap: 12 },
  field: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.field,
    borderRadius: 12,
    paddingLeft: 15,
    paddingRight: 5,
  },
  focusedField: { borderColor: authColors.link },
  invalidField: { borderColor: '#C72E2E' },
  fieldText: { flex: 1, paddingVertical: 9, gap: 2 },
  label: { fontFamily: authFonts.regular, fontSize: 12, lineHeight: 16, color: authColors.muted },
  input: {
    fontFamily: authFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: authColors.forest,
    padding: 0,
    minHeight: 22,
  },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: authColors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondary: { minHeight: 44, borderRadius: 12, backgroundColor: authColors.paper },
  buttonText: {
    fontFamily: authFonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    textAlign: 'center',
  },
  ink: { color: authColors.forest },
  dim: { opacity: 0.65 },
  apple: { minHeight: 50, backgroundColor: '#0A0B0A', borderRadius: 12, paddingHorizontal: 48 },
  google: {
    minHeight: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 12,
    paddingHorizontal: 48,
  },
  providerIcon: { position: 'absolute', left: 20 },
  nav: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  navRight: { alignItems: 'flex-end' },
  navText: {
    fontFamily: authFonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: authColors.link,
    textAlign: 'center',
  },
  note: { fontFamily: authFonts.regular, fontSize: 13, lineHeight: 18, color: authColors.muted },
  message: { backgroundColor: '#EDF7F0', borderRadius: 12, padding: 12 },
  messageText: {
    fontFamily: authFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: authColors.forest,
  },
  error: { backgroundColor: '#FFF1EF' },
  errorText: { color: '#A72A2A' },
  separator: {
    fontFamily: authFonts.regular,
    fontSize: 12,
    lineHeight: 20,
    color: authColors.muted,
    textAlign: 'center',
  },
});
