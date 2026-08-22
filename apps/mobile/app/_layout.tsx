import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from '../src/providers/QueryProvider';

export default function RootLayout() {
  return (
    // Required ancestor for the swipe gestures used by the transaction rows.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
