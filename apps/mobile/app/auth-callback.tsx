import { useAuthStore } from '@budgetaiapp/shared';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { handleAuthCallback } from '../src/lib/auth';
import {
  AuthButton,
  AuthCard,
  AuthMessage,
  AuthNav,
  AuthShell,
  authColors,
  flowText as t,
} from '../src/components/auth/AuthUI';

/** Outside protected groups: wait for THIS link, not a session left from an earlier login. */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const {
    session,
    isLoading,
    isPasswordRecovery,
    authLinkStatus,
    authLinkIntent,
    authLinkError,
    setAuthLinkState,
  } = useAuthStore();
  const [completedUrl, setCompletedUrl] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    let active = true;
    if (url)
      void handleAuthCallback(url).then((success) => {
        if (active) {
          setAccepted(success);
          setCompletedUrl(url);
        }
      });
    return () => {
      active = false;
    };
  }, [url]);
  const finished = completedUrl === url && !!url;
  if (finished && accepted && authLinkStatus === 'idle' && session && !isLoading) {
    return <Redirect href={isPasswordRecovery ? '/(auth)/update-password' : '/(tabs)'} />;
  }
  const failed = finished && (!accepted || authLinkStatus === 'error');
  const social = authLinkIntent === 'oauth';
  const target =
    authLinkIntent === 'recovery'
      ? '/(auth)/forgot-password'
      : authLinkIntent === 'signup'
        ? '/(auth)/verify-email'
        : social
          ? '/(auth)/login'
          : '/(auth)/magic-link';
  function leave(path: typeof target | '/(auth)/login') {
    setAuthLinkState('idle');
    router.replace(path);
  }
  return (
    <AuthShell
      title={t(failed ? (social ? 'loginTitle' : 'expiredTitle') : 'checkingTitle')}
      subtitle={t(
        failed
          ? authLinkError === 'networkError'
            ? 'networkError'
            : social
              ? 'tryAgain'
              : 'expiredLink'
          : 'checkingSubtitle',
      )}
      statusIcon={failed ? 'expired' : undefined}
      footer={
        failed ? (
          <AuthNav label={t('backLogin')} onPress={() => leave('/(auth)/login')} />
        ) : undefined
      }
    >
      <AuthCard>
        {failed ? (
          <AuthButton
            label={t(social ? 'backLogin' : 'requestNewLink')}
            onPress={() => leave(target)}
          />
        ) : (
          <>
            <ActivityIndicator color={authColors.forest} size="large" />
            <AuthMessage message={t('checkingNote')} />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
