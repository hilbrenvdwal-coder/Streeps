import { Stack } from 'expo-router';
import { getTheme } from '@/src/theme';
import { useTheme } from '@/src/contexts/ThemeContext';

export default function GroupsLayout() {
  const { theme } = useTheme();
  const tokens = getTheme(theme);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.surface.default },
        headerTintColor: tokens.colors.text.primary,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}
