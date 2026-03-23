import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { brand } from '@/src/theme';

// Map route names to their tab config
const TAB_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap }> = {
  activiteit: { icon: 'receipt-outline', iconFocused: 'receipt' },
  home: { icon: 'home-outline', iconFocused: 'home' },
  profiel: { icon: 'person-outline', iconFocused: 'person' },
};

const TAB_ORDER = ['activiteit', 'home', 'profiel'];

export default function CustomNavBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  // Determine which visible tab is active
  const activeRouteName = state.routes[state.index]?.name;
  const visibleIndex = TAB_ORDER.indexOf(activeRouteName);
  const activeTab = visibleIndex >= 0 ? visibleIndex : 1; // default to home

  const pillX = useSharedValue(activeTab);

  useEffect(() => {
    pillX.value = withSpring(activeTab, { damping: 18, stiffness: 150, mass: 0.8 });
  }, [activeTab]);

  const pillStyle = useAnimatedStyle(() => {
    const tabWidth = 80;
    const totalWidth = TAB_ORDER.length * tabWidth;
    const startOffset = -totalWidth / 2 + tabWidth / 2;
    return {
      transform: [{ translateX: startOffset + pillX.value * tabWidth }],
    };
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 16 }]}>
      <View style={styles.bar}>
        {/* Animated pill */}
        <Animated.View style={[styles.pill, pillStyle]} />

        {/* Tab buttons */}
        {TAB_ORDER.map((routeName, index) => {
          const config = TAB_CONFIG[routeName];
          const isFocused = activeTab === index;

          const onPress = () => {
            // Find the actual route in state
            const route = state.routes.find((r: any) => r.name === routeName);
            if (!route) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              navigation.navigate(routeName);
            }
          };

          return (
            <Pressable key={routeName} style={styles.tab} onPress={onPress} hitSlop={8}>
              <Ionicons
                name={isFocused ? config.iconFocused : config.icon}
                size={24}
                color={isFocused ? '#FFFFFF' : '#666680'}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F1E',
    borderTopWidth: 1,
    borderTopColor: '#2D2D44',
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    width: 56,
    height: 40,
    borderRadius: 9999,
    backgroundColor: brand.magenta,
  },
  tab: {
    width: 80,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
