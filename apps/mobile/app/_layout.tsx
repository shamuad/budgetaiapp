import 'react-native-reanimated';

import { Stack } from 'expo-router';
import {
  DarkTheme as RouterDarkTheme,
  DefaultTheme as RouterDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { useMemo } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from '../src/providers/QueryProvider';
import { ThemeProvider, useAppTheme } from '../src/theming';

/** Reads inside `ThemeProvider`, so any pushed stack screen gets a themed header. */
function RootStack() {
  const { colors, scheme } = useAppTheme();

  // Expo Router's own navigator theme defaults to a light `rgb(242, 242, 242)`
  // canvas until overridden. Left as-is, that default paints behind screen
  // transitions and edge-to-edge insets, which is the "white frame" on Android.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? RouterDarkTheme : RouterDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </NavigationThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    // Required ancestor for the swipe gestures used by the transaction rows.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <RootStack />
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
