import {
  authErrorKey,
  getSupabase,
  i18n,
  MIN_PASSWORD_LENGTH,
  useAuthStore,
} from '@budgetaiapp/shared';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AuthButton,
  AuthCard,
  AuthField,
  AuthMessage,
  AuthNav,
  AuthNote,
  AuthShell,
  flowText as t,
} from '../../src/components/auth/AuthUI';

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const recovery = useAuthStore((state) => state.isPasswordRecovery);
  const session = useAuthStore((state) => state.session);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  async function save() {
    if (locked.current || !session || !recovery) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(i18n.t('auth.passwordTooShort'));
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await getSupabase().auth.updateUser({ password });
      if (failure) throw failure;
      setPassword('');
      setDone(true);
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function backToLogin() {
    if (busy) return;
    setBusy(true);
    try {
      await useAuthStore.getState().signOut();
      router.replace('/(auth)/login');
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    } finally {
      setBusy(false);
    }
  }
  if (!session || !recovery)
    return (
      <AuthShell
        title={t('expiredTitle')}
        subtitle={t('expiredLink')}
        statusIcon="expired"
        footer={<AuthNav href="/(auth)/login" label={t('backLogin')} />}
      >
        <AuthCard>
          <AuthButton
            label={t('requestNewLink')}
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </AuthCard>
      </AuthShell>
    );
  return (
    <AuthShell
      title={t(done ? 'passwordSaved' : 'newPasswordTitle')}
      subtitle={t(done ? 'passwordSavedSubtitle' : 'newPasswordSubtitle')}
      footer={
        !done ? <AuthNav label={t('backLogin')} onPress={() => void backToLogin()} /> : undefined
      }
    >
      <AuthCard>
        <AuthMessage message={error} error />
        {done ? (
          <AuthButton
            label={t('continueToApp')}
            onPress={() => useAuthStore.getState().setIsPasswordRecovery(false)}
          />
        ) : (
          <>
            <AuthField
              password
              label={i18n.t('auth.newPasswordLabel')}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={i18n.t('auth.newPasswordLabel')}
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
            <AuthNote>{t('passwordHint')}</AuthNote>
            <AuthButton
              label={i18n.t('auth.savePassword')}
              onPress={() => void save()}
              busy={busy}
            />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
