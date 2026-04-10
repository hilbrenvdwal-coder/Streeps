import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Animated, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Custom NavBar — Figma node 30:255, glassy look
 *
 * Figma glass variables:
 *   light: 45deg, 80%
 *   refraction: 80, depth: 20, dispersion: 50
 *   frost: 8, splay: 0
 *
 * Mapped to React Native:
 *   frost 8  → BlurView intensity ~20 (frost is subtle)
 *   80%      → tint overlay opacity 0.80
 *   light 45° → diagonal highlight gradient from top-left
 *   depth 20 → subtle top border highlight
 */

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const scale = (v: number) => (v / DESIGN_W) * SCREEN_W;

const TAB_ORDER = ['activiteit', 'home', 'chat'];

const PILL_POSITIONS = [24, 155, 286];
const PILL_W = 80;
const ICON_X = [48 + 16, 179 + 16, 310 + 16];

const PILL_LEFTS = PILL_POSITIONS.map((x) => scale(x));
const PILL_RIGHTS = PILL_POSITIONS.map((x) => scale(x + PILL_W));

const SPRING_CONF = { damping: 20, stiffness: 300, mass: 1 };

export default function CustomNavBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  const activeRouteName = state.routes[state.index]?.name;
  const visibleIndex = TAB_ORDER.indexOf(activeRouteName);
  const activeTab = visibleIndex >= 0 ? visibleIndex : 1;

  const PILL_H = 50;
  const PILL_H_THIN = 38;

  const prevTab = useRef(activeTab);
  const pillLeft = useRef(new Animated.Value(PILL_LEFTS[activeTab])).current;
  const pillRight = useRef(new Animated.Value(PILL_RIGHTS[activeTab])).current;
  const pillHeight = useRef(new Animated.Value(PILL_H)).current;

  useEffect(() => {
    const goingRight = activeTab > prevTab.current;
    const changed = activeTab !== prevTab.current;
    const spring = (v: Animated.Value, to: number) =>
      Animated.spring(v, { toValue: to, ...SPRING_CONF, useNativeDriver: false });

    if (changed) {
      // Instantly squeeze, then spring back alongside the move
      pillHeight.setValue(PILL_H_THIN);
      Animated.spring(pillHeight, { toValue: PILL_H, ...SPRING_CONF, useNativeDriver: false }).start();
    }

    if (goingRight) {
      spring(pillRight, PILL_RIGHTS[activeTab]).start();
      Animated.sequence([
        Animated.delay(100),
        spring(pillLeft, PILL_LEFTS[activeTab]),
      ]).start();
    } else {
      spring(pillLeft, PILL_LEFTS[activeTab]).start();
      Animated.sequence([
        Animated.delay(100),
        spring(pillRight, PILL_RIGHTS[activeTab]),
      ]).start();
    }

    prevTab.current = activeTab;
  }, [activeTab]);

  const pillWidth = Animated.subtract(pillRight, pillLeft);
  // Center vertically: offset top so pill stays centered
  const pillTop = pillHeight.interpolate({
    inputRange: [PILL_H_THIN, PILL_H],
    outputRange: [14 + (PILL_H - PILL_H_THIN) / 2, 14],
  });

  const icons: Array<{ name: keyof typeof Ionicons.glyphMap; nameFocused: keyof typeof Ionicons.glyphMap }> = [
    { name: 'people-outline', nameFocused: 'people' },
    { name: 'home-outline', nameFocused: 'home' },
    { name: 'chatbubbles-outline', nameFocused: 'chatbubbles' },
  ];

  return (
    <View style={[styles.container, { paddingBottom: (insets.bottom || 12) / 2 }]}>
      {/* Layer 1: Blur — frost: 8 → subtle blur */}
      <BlurView
        intensity={20}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Layer 2: Dark tint — 80% opacity glass base */}
      <View style={styles.tintOverlay} />

      {/* Layer 3: Light highlight — 45° diagonal, subtle white sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Layer 4: Top edge highlight — depth: 20 */}
      <View style={styles.topEdge} />

      <View style={styles.bar}>
        {/* Animated pill */}
        <Animated.View style={[styles.pill, { left: pillLeft, width: pillWidth, height: pillHeight, top: pillTop }]} />

        {/* Icons at exact Figma positions */}
        {TAB_ORDER.map((routeName, index) => {
          const isFocused = activeTab === index;
          const icon = icons[index];

          const onPress = () => {
            const route = state.routes.find((r: any) => r.name === routeName);
            if (!route) return;
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) navigation.navigate(routeName);
          };

          return (
            <Pressable
              key={routeName}
              style={[styles.iconTouch, { left: scale(ICON_X[index]) - 24 }]}
              onPress={onPress}
            >
              <Ionicons
                name={isFocused ? icon.nameFocused : icon.name}
                size={20}
                color={isFocused ? '#FFFFFF' : '#878787'}
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
    overflow: 'hidden',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 21, 21, 0.80)',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  bar: {
    height: 77,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    height: 50,
    top: 14,
    borderRadius: 44,
    backgroundColor: '#FF004D',
    shadowColor: '#FF004D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 9.4,
    elevation: 6,
  },
  iconTouch: {
    position: 'absolute',
    width: 48,
    height: 48,
    top: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
