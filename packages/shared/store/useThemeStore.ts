import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** `auto` follows the OS appearance; the other two pin a fixed look. */
export type ThemePreference = 'light' | 'dark' | 'auto';

type ThemeState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themePreference: 'auto',
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'budgetaiapp.theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
