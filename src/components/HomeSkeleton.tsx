import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const C = 'rgba(255,255,255,0.06)';

export default function HomeSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[sk.container, { opacity }]}>
      {/* Group Header */}
      <View style={sk.groupHeader}>
        <View style={sk.groupTopRow}>
          <View style={sk.avatar} />
          <View style={sk.groupNameBar} />
        </View>
        <View style={sk.activeCountBar} />
      </View>

      {/* Counter */}
      <View style={sk.counterRow}>
        <View style={sk.counterBtn} />
        <View style={sk.counterDisplay} />
        <View style={sk.counterBtn} />
      </View>

      {/* Category pills */}
      <View style={sk.categories}>
        <View style={sk.pill} />
        <View style={sk.pill} />
        <View style={sk.pill} />
      </View>

      {/* Leden */}
      <View style={sk.section}>
        <View style={sk.sectionHeader}>
          <View style={sk.sectionTitle} />
          <View style={sk.sectionCount} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={sk.lidRow}>
            <View style={sk.lidAvatar} />
            <View style={[sk.lidName, { width: [120, 150, 100, 130][i] }]} />
          </View>
        ))}
      </View>

      {/* Drankenlijst */}
      <View style={sk.section}>
        <View style={sk.sectionHeader}>
          <View style={[sk.sectionTitle, { width: 120 }]} />
          <View style={sk.sectionCount} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={sk.drinkRow}>
            <View style={sk.drinkEmoji} />
            <View style={[sk.drinkName, { width: [100, 80, 110, 90][i] }]} />
            <View style={sk.drinkBadge} />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  container: { paddingTop: 12 },

  // Group header
  groupHeader: { marginBottom: 24, paddingHorizontal: 14 },
  groupTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: C },
  groupNameBar: { width: 180, height: 28, borderRadius: 14, backgroundColor: C },
  activeCountBar: { width: 100, height: 18, borderRadius: 9, backgroundColor: C, marginTop: 12, marginLeft: 10 },

  // Counter
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, paddingHorizontal: 10 },
  counterBtn: { flex: 1, height: 60, borderRadius: 20, backgroundColor: C },
  counterDisplay: { width: 60, height: 60, borderRadius: 20, backgroundColor: C },

  // Categories
  categories: { marginBottom: 24, paddingHorizontal: 10 },
  pill: { height: 50, borderRadius: 25, backgroundColor: C, marginBottom: 9 },

  // Sections (leden + dranken)
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { width: 80, height: 18, borderRadius: 9, backgroundColor: C },
  sectionCount: { width: 70, height: 18, borderRadius: 9, backgroundColor: C },

  // Lid rows
  lidRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  lidAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: C, marginRight: 16 },
  lidName: { height: 16, borderRadius: 8, backgroundColor: C },

  // Drink rows
  drinkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  drinkEmoji: { width: 24, height: 24, borderRadius: 12, backgroundColor: C, marginRight: 12 },
  drinkName: { height: 14, borderRadius: 7, backgroundColor: C, flex: 1, marginRight: 12 },
  drinkBadge: { width: 70, height: 24, borderRadius: 8, backgroundColor: C },
});
