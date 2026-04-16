import React, { createContext, useContext, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme } from '@/src/theme';
import CustomNavBar from '@/src/components/CustomNavBar';

const NavBarAnimContext = createContext<Animated.Value>(new Animated.Value(0));
export const useNavBarAnim = () => useContext(NavBarAnimContext);

export default function TabLayout() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const navBarAnim = useRef(new Animated.Value(0)).current;

  return (
    <NavBarAnimContext.Provider value={navBarAnim}>
    <Tabs
      tabBar={(props) => (
        <Animated.View
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
            transform: [{ translateY: navBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 120],
            })}],
          }}
        >
          <CustomNavBar {...props} />
        </Animated.View>
      )}
      screenOptions={{
        animation: 'none',
        sceneStyle: { backgroundColor: '#0E0D1C' },
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
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Berichten',
          headerShown: false,
        }}
      />
    </Tabs>
    </NavBarAnimContext.Provider>
  );
}
