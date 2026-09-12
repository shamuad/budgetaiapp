import {
  authErrorKey,
  getSupabase,
  i18n,
  isValidAuthEmail,
  MIN_PASSWORD_LENGTH,
} from '@budgetaiapp/shared';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text } from 'react-native';

import { authRedirect, signInWithProvider } from '../../lib/auth';
import {
  AuthBody,
  AuthButton,
  AuthCard,
  AuthField,
  AuthMessage,
  AuthNav,
  AuthNote,
  AuthShell,
  flowText as t,
  styles,
} from './AuthUI';
import EmailLinkScreen from './EmailLinkScreen';

/** Successful auth is handled by the root session guard, never a fake screen transition. */
export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const login = mode === 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const locked = useRef(false);

  async function submit() {
    if (locked.current) return;
    if (!isValidAuthEmail(email)) {
      setError(t('invalidEmail'));
      return;
    }
    if (!password) {
      setError(i18n.t('auth.missingPassword'));
      return;
    }
    if (!login && password.length < MIN_PASSWORD_LENGTH) {
      setError(i18n.t('auth.passwordTooShort'));
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (login) {
        const { error: failure } = await getSupabase().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (failure) throw failure;
      } else {
        const { data, error: failure } = await getSupabase().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirect('signup') },
        });
        if (failure) throw failure;
        if (!data.session) {
          setPassword('');
          setConfirm(true);
        }
      }
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function social(selected: 'apple' | 'google') {
    if (locked.current) return;
    locked.current = true;
    setProvider(selected);
    setError(null);
    setNotice(null);
    try {
      if ((await signInWithProvider(selected)) === 'cancelled') setNotice(t('socialCancelled'));
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    } finally {
      locked.current = false;
      setProvider(null);
    }
  }

  if (confirm)
    return (
      <EmailLinkScreen
        kind="signup"
        initialEmail={email.trim()}
        initiallySent
        onChangeEmail={() => setConfirm(false)}
      />
    );
  const disabled = busy || !!provider;
  return (
    <AuthShell
      title={t(login ? 'loginTitle' : 'signupTitle')}
      subtitle={t(login ? 'loginSubtitle' : 'signupSubtitle')}
      footer={
        <AuthNav
          href={login ? '/(auth)/signup' : '/(auth)/login'}
          label={t(login ? 'createAccountFooter' : 'loginFooter')}
        />
      }
    >
      <AuthCard>
        <AuthBody>
          <AuthMessage message={error} error />
          {error === t('emailUnconfirmed') ? (
            <AuthNav href="/(auth)/verify-email" label={t('resend')} />
          ) : null}
          <AuthMessage message={notice} />
          {provider ? (
            <AuthMessage
              message={t('socialOpening', { provider: provider === 'apple' ? 'Apple' : 'Google' })}
            />
          ) : null}
          <AuthField
            label={i18n.t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            placeholder={i18n.t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            editable={!disabled}
            returnKeyType="next"
          />
          <AuthField
            label={i18n.t('auth.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            placeholder={i18n.t(login ? 'auth.passwordPlaceholder' : 'auth.newPasswordLabel')}
            password
            autoCapitalize="none"
            autoComplete={login ? 'current-password' : 'new-password'}
            textContentType={login ? 'password' : 'newPassword'}
            editable={!disabled}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          {login ? (
            <AuthNav
              right
              onPress={() => {
                if (!disabled) router.push('/(auth)/forgot-password');
              }}
              label={i18n.t('auth.forgotPassword')}
            />
          ) : (
            <>
              <AuthNote>{t('passwordHint')}</AuthNote>
              <AuthNote>{t('signupPrivacy')}</AuthNote>
            </>
          )}
          <AuthButton
            label={t(login ? 'signIn' : 'signUp')}
            onPress={() => void submit()}
            busy={busy}
            disabled={!!provider}
          />
          {login ? (
            <AuthButton
              secondary
              label={t('magicAction')}
              disabled={disabled}
              onPress={() => router.push('/(auth)/magic-link')}
            />
          ) : null}
        </AuthBody>
        <AuthBody>
          <Text style={styles.separator}>{t('orContinue')}</Text>
          <AuthButton
            provider="apple"
            label={i18n.t('auth.continueWithApple')}
            onPress={() => void social('apple')}
            busy={provider === 'apple'}
            disabled={disabled}
          />
          <AuthButton
            provider="google"
            label={i18n.t('auth.continueWithGoogle')}
            onPress={() => void social('google')}
            busy={provider === 'google'}
            disabled={disabled}
          />
        </AuthBody>
      </AuthCard>
    </AuthShell>
  );
}
