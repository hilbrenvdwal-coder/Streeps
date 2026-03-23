import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme } from '@/src/theme';
import CustomNavBar from '@/src/components/CustomNavBar';

export default function TabLayout() {
  const mode = useColorScheme();
  const t = getTheme(mode);

  return (
    <Tabs
      tabBar={(props) => <CustomNavBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: t.colors.background.primary,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: t.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: t.typography.heading3.fontSize,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="activiteit"
        options={{
          title: 'Activiteit',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profiel"
        options={{
          title: 'Profiel',
          headerShown: false,
        }}
      />
      {/* Groups stack kept for push navigation (settings, etc.) */}
      <Tabs.Screen
        name="groups"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
