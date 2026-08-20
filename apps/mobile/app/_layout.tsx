import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AssetsProvider } from '../src/context/AssetsContext';
import { CategoriesProvider } from '../src/context/CategoriesContext';
import { TransactionsProvider } from '../src/context/TransactionsContext';

export default function RootLayout() {
  return (
    // Required ancestor for the swipe gestures used by the transaction rows.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* All three sit above the tabs so every screen reads and writes one copy. */}
      <AssetsProvider>
        <CategoriesProvider>
          <TransactionsProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </TransactionsProvider>
        </CategoriesProvider>
      </AssetsProvider>
    </GestureHandlerRootView>
  );
}
