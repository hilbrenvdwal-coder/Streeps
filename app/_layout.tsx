import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { ThemeProvider as StreepsThemeProvider } from '@/src/contexts/ThemeContext';
import { getTheme } from '@/src/theme';
import { useHeartbeat } from '@/src/hooks/useHeartbeat';
import { queryClient } from '@/src/lib/queryClient';
import SplashAnimation from '@/src/components/SplashAnimation';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Unbounded: require('@expo-google-fonts/unbounded/400Regular/Unbounded_400Regular.ttf'),
    'Unbounded-Medium': require('@expo-google-fonts/unbounded/500Medium/Unbounded_500Medium.ttf'),
    'Unbounded-SemiBold': require('@expo-google-fonts/unbounded/600SemiBold/Unbounded_600SemiBold.ttf'),
    'Unbounded-Bold': require('@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf'),
    'Unbounded-ExtraBold': require('@expo-google-fonts/unbounded/800ExtraBold/Unbounded_800ExtraBold.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (loaded) {
      setShowSplash(true);
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StreepsThemeProvider>
          <AuthProvider>
            <RootLayoutNav />
            {showSplash && (
              <SplashOverlay onComplete={() => setShowSplash(false)} />
            )}
          </AuthProvider>
        </StreepsThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function SplashOverlay({ onComplete }: { onComplete: () => void }) {
  const { loading } = useAuth();
  return <SplashAnimation authLoading={loading} onComplete={onComplete} />;
}

function RootLayoutNav() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const { session, loading, isRecovery } = useAuth();
  const segments = useSegments();

  useHeartbeat(session?.user?.id);
  const router = useRouter();

  const navTheme = mode === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: t.colors.tint,
          background: '#0E0D1C',
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
          background: '#0E0D1C',
          card: t.colors.surface.default,
          text: t.colors.text.primary,
          border: t.colors.border.default,
        },
      };

  // Deep link handling for password recovery URLs
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url && url.includes('reset-password')) {
        router.replace('/(auth)/reset-password' as any);
      }
    };

    // Check cold start URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Listen for incoming URLs while app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    // If in recovery mode, redirect to reset-password screen
    if (isRecovery) {
      router.replace('/(auth)/reset-password' as any);
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inJoinRoute = segments[0] === 'join';
    if (!session && !inAuthGroup && !inJoinRoute) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      // Check for pending invite code from deep link before login
      AsyncStorage.getItem('streeps_pending_invite_code').then((pendingCode) => {
        if (pendingCode) {
          AsyncStorage.removeItem('streeps_pending_invite_code');
          router.replace(`/join/${pendingCode}` as any);
        } else {
          router.replace('/(tabs)/home' as any);
        }
      });
    }
  }, [session, loading, isRecovery]);

  return (
    <ThemeProvider value={navTheme}>
      <Slot />
    </ThemeProvider>
  );
}
