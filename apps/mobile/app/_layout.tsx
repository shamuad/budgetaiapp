import 'react-native-reanimated';
import '../src/lib/apiConfig';

import { i18n, useAuthStore } from '@budgetaiapp/shared';
import { Stack } from 'expo-router';
import {
  DarkTheme as RouterDarkTheme,
  DefaultTheme as RouterDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { useMemo } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/providers/AuthProvider';
import { QueryProvider } from '../src/providers/QueryProvider';
import { ThemeProvider, useAppTheme } from '../src/theming';

/** Reads inside `ThemeProvider`, so any pushed stack screen gets a themed header. */
function RootStack() {
  const { colors, scheme } = useAppTheme();
  const session = useAuthStore((state) => state.session);
  // True only until the session is first read back from `AsyncStorage`, so
  // the guard below never has a chance to flash the login screen at launch.
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  // A forgot-password OTP verification issues a real session, but the user
  // still needs to set a new password — keep them on the `(auth)` group
  // until that's done instead of jumping straight to the main app.
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const authLinkStatus = useAuthStore((state) => state.authLinkStatus);
  const showTabs = !!session && !isPasswordRecovery && authLinkStatus !== 'processing';

  // Expo Router's own navigator theme defaults to a light `rgb(242, 242, 242)`
  // canvas until overridden. Left as-is, that default paints behind screen
  // transitions and edge-to-edge insets, which is the "white frame" on Android.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? RouterDarkTheme : RouterDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.tint,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  return (
    // The outermost surface behind every screen, so it's never the OS/navigator
    // default white — matters most under Android's edge-to-edge insets.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationThemeProvider value={navigationTheme}>
        {isAuthLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.background,
            }}
          >
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { color: colors.text },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            {/* Whichever branch's guard is false is inaccessible — Expo Router
                redirects there automatically, including when `session` changes
                after the app is already showing one side (e.g. on log out). */}
            <Stack.Protected guard={showTabs}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="profile"
                options={{
                  title: i18n.t('tabs.profile'),
                  headerBackButtonDisplayMode: 'minimal',
                  headerShadowVisible: false,
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!showTabs}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          </Stack>
        )}
      </NavigationThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded && !fontError)
    return (
      <View style={{ flex: 1, backgroundColor: '#0A100E', justifyContent: 'center' }}>
        <ActivityIndicator color="#8ECFA7" />
      </View>
    );
  return (
    // Required ancestor for the swipe gestures used by the transaction rows.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              <RootStack />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
