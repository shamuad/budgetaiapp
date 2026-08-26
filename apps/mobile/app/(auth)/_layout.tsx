import { useAuthStore } from '@budgetaiapp/shared';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAppTheme } from '../../src/theming';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function AuthLayout() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);

  // A recovery link signs the user in behind the scenes; the root guard keeps
  // them in this group, and this sends them to the one screen that matters
  // until a new password is saved. Redirecting from here rather than the root
  // means the stack is already mounted by the time it runs.
  useEffect(() => {
    if (isPasswordRecovery) {
      router.replace('/(auth)/update-password');
    }
  }, [isPasswordRecovery, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="update-password" />
    </Stack>
  );
}
