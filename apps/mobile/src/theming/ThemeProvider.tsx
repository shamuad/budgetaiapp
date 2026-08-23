import { ThemePreference, useThemeStore } from '@budgetaiapp/shared';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

import { darkColors, lightColors, type ColorScheme, type ColorTokens } from './tokens';

type SystemScheme = ReturnType<typeof Appearance.getColorScheme>;

type AppThemeContextValue = {
  colors: ColorTokens;
  /** The resolved scheme actually being rendered, after `auto` is settled. */
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function resolveScheme(preference: ThemePreference, system: SystemScheme): ColorScheme {
  return preference === 'auto' ? (system === 'dark' ? 'dark' : 'light') : preference;
}

/**
 * Resolves `themePreference` against the OS appearance and exposes the
 * result as semantic color tokens via `useAppTheme()`. Wrap the app once,
 * at the root.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((state) => state.themePreference);
  const setPreference = useThemeStore((state) => state.setThemePreference);
  const [system, setSystem] = useState<SystemScheme>(() => Appearance.getColorScheme());

  useEffect(() => {
    // Keeps 'auto' tracking live if the user flips the OS setting while the app is open.
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const scheme = resolveScheme(preference, system);
  const colors = scheme === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    // The root view's own background — this is what shows through before the
    // JS tree paints and behind any area the layout doesn't cover, so it's
    // what actually eliminates the Android "white frame" (unlike the system
    // bars, it isn't restricted by edge-to-edge enforcement).
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});

    if (Platform.OS === 'android') {
      // `setButtonStyleAsync`/`setBackgroundColorAsync` were removed once
      // Android enforced edge-to-edge; `setStyle` is the current, supported
      // way to keep the nav bar's own buttons legible against our theme.
      NavigationBar.setStyle(scheme === 'dark' ? 'light' : 'dark');
    }
  }, [colors.background, scheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference, setPreference],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {/*
       * `react-native-edge-to-edge`'s `SystemBars` would be the more modern,
       * edge-to-edge-safe replacement, but it ships a native module that
       * Expo Go's precompiled binary doesn't include — it needs a rebuilt
       * dev client. `expo-status-bar` is what Expo Go already bundles.
       */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }

  return context;
}
