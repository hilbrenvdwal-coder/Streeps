import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { ThemeProvider as StreepsThemeProvider } from '@/src/contexts/ThemeContext';
import { getTheme } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StreepsThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </StreepsThemeProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const navTheme = mode === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: t.colors.tint,
          background: t.colors.background.primary,
          card: t.colors.surface.default,
          text: t.colors.text.primary,
          border: t.colors.border.default,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: t.colors.tint,
          background: t.colors.background.primary,
          card: t.colors.surface.default,
          text: t.colors.text.primary,
          border: t.colors.border.default,
        },
      };

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home' as any);
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.background.primary }}>
        <ActivityIndicator size="large" color={t.brand.magenta} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <Slot />
    </ThemeProvider>
  );
}
