import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme, auroraPalettes } from '@/src/theme';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import ExploreFeed from '@/src/components/ExploreFeed';
import SearchGroupsModal from '@/src/components/SearchGroupsModal';
import GroupProfileOverlay from '@/src/components/GroupProfileOverlay';

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

export default function ExploreScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const insets = useSafeAreaInsets();
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Explore → GroupProfileOverlay: open direct vanuit feed. Vanuit de
  // search-modal sluiten we eerst de modal zodat de overlay daaroverheen
  // kan animeren i.p.v. achter de Modal-laag te verdwijnen.
  const handleGroupPress = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const handleSearchGroupPress = (groupId: string) => {
    setSearchVisible(false);
    // Kleine delay zodat de modal eerst dichtvaagt; voorkomt een
    // visuele "spring" wanneer de overlay opent.
    setTimeout(() => setSelectedGroupId(groupId), 200);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      {/* Status bar spacer + aurora + title */}
      <View style={{ paddingTop: insets.top }}>
        {/* Aurora */}
        <View style={styles.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={[...auroraPalettes.explore]} animated />
        </View>

        {/* Header: Title + search icon */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Verkennen</Text>
          <Pressable
            onPress={() => setSearchVisible(true)}
            hitSlop={12}
            style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
          >
            <Ionicons name="search-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Feed */}
      <View style={styles.feedWrap}>
        <ExploreFeed onGroupPress={handleGroupPress} />
      </View>

      {/* Search modal */}
      <SearchGroupsModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onGroupPress={handleSearchGroupPress}
      />

      {/* Group profile overlay (full-screen, slide-in). */}
      <GroupProfileOverlay
        visible={selectedGroupId !== null}
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
      />
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    // Aurora
    auroraWrap: {
      position: 'absolute',
      left: -20,
      top: 0,
      zIndex: 0,
    },

    // Header row
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(21),
      paddingTop: s(10),
    },
    title: {
      fontFamily: 'Unbounded',
      fontSize: 24,
      fontWeight: '400',
      color: '#FFFFFF',
    },
    searchBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnPressed: {
      opacity: 0.6,
    },

    feedWrap: {
      flex: 1,
    },
  });
}
