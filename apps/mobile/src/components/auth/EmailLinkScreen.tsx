import { authErrorKey, getSupabase, i18n, isValidAuthEmail } from '@budgetaiapp/shared';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

import { authRedirect } from '../../lib/auth';
import {
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

export default function EmailLinkScreen({
  kind,
  initialEmail = '',
  initiallySent = false,
  onChangeEmail,
}: {
  kind: 'signup' | 'magiclink' | 'recovery';
  initialEmail?: string;
  initiallySent?: boolean;
  onChangeEmail?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(initiallySent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initiallySent ? 60 : 0);
  const [resent, setResent] = useState(false);
  const until = useRef(initiallySent ? Date.now() + 60000 : 0);
  const locked = useRef(false);
  useEffect(() => {
    if (!remaining) return;
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((until.current - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [remaining]);

  async function send() {
    if (locked.current || remaining > 0) return;
    if (!isValidAuthEmail(email)) {
      setError(t('invalidEmail'));
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const auth = getSupabase().auth;
      const result =
        kind === 'recovery'
          ? await auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(kind) })
          : kind === 'signup'
            ? await auth.resend({
                type: 'signup',
                email: email.trim(),
                options: { emailRedirectTo: authRedirect(kind) },
              })
            : await auth.signInWithOtp({
                email: email.trim(),
                options: { emailRedirectTo: authRedirect(kind), shouldCreateUser: false },
              });
      // Keep the same neutral outcome for an unknown Magic Link account.
      if (result.error && !(kind === 'magiclink' && result.error.code === 'otp_disabled'))
        throw result.error;
      setResent(sent);
      setSent(true);
      until.current = Date.now() + 60000;
      setRemaining(60);
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const title = sent
    ? 'checkInbox'
    : kind === 'recovery'
      ? 'forgotTitle'
      : kind === 'signup'
        ? 'verifyTitle'
        : 'magicTitle';
  const subtitle = sent
    ? `${kind}Sent`
    : kind === 'recovery'
      ? 'forgotSubtitle'
      : kind === 'signup'
        ? 'verifySubtitle'
        : 'magicSubtitle';
  return (
    <AuthShell
      title={t(title)}
      subtitle={t(subtitle)}
      statusIcon={sent ? 'mail' : undefined}
      footer={<AuthNav href="/(auth)/login" label={t('backLogin')} />}
    >
      <AuthCard>
        <AuthMessage message={error} error />
        <AuthMessage message={resent ? t('resent') : null} />
        {sent ? (
          <>
            <Text style={[styles.subtitle, { color: '#173F33', fontFamily: 'Inter_600SemiBold' }]}>
              {email.trim()}
            </Text>
            <AuthNote>{t('inboxHint')}</AuthNote>
            <AuthButton
              label={remaining ? t('resendCountdown', { seconds: remaining }) : t('resend')}
              busy={busy}
              disabled={remaining > 0}
              onPress={() => void send()}
            />
            <AuthNav
              label={t('changeEmail')}
              onPress={() => {
                if (onChangeEmail) onChangeEmail();
                else {
                  setSent(false);
                  setResent(false);
                  setError(null);
                }
              }}
            />
          </>
        ) : (
          <>
            <AuthField
              label={i18n.t('auth.emailLabel')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder={i18n.t('auth.emailPlaceholder')}
              editable={!busy}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <AuthButton
              label={
                remaining
                  ? t('resendCountdown', { seconds: remaining })
                  : t(
                      kind === 'recovery'
                        ? 'sendReset'
                        : kind === 'signup'
                          ? 'resend'
                          : 'sendMagic',
                    )
              }
              onPress={() => void send()}
              busy={busy}
              disabled={remaining > 0}
            />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
