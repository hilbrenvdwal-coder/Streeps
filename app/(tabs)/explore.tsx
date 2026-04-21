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

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

export default function ExploreScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const insets = useSafeAreaInsets();
  const [searchVisible, setSearchVisible] = useState(false);

  // TODO(Phase 3 B3): open GroupProfileOverlay op de explore-tab zelf.
  // Voor nu loggen we alleen — de overlay zit nu aan chat.tsx gekoppeld.
  const handleGroupPress = (groupId: string) => {
    console.log('[explore] open group', groupId);
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
        onGroupPress={handleGroupPress}
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
