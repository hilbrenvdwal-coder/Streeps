import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme, auroraPalettes } from '@/src/theme';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import ExploreFeed from '@/src/components/ExploreFeed';

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

export default function ExploreScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      {/* Status bar spacer + aurora + title */}
      <View style={{ paddingTop: insets.top }}>
        {/* Aurora */}
        <View style={styles.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={[...auroraPalettes.explore]} animated />
        </View>

        {/* Title */}
        <Text style={styles.title}>Verkennen</Text>
      </View>

      {/* Feed */}
      <View style={styles.feedWrap}>
        <ExploreFeed
          onGroupPress={(groupId) => {
            // TODO(Phase 3 B1): open GroupProfileOverlay via chat.tsx integration.
            // For now, placeholder logging — deferred to a later merge.
            console.log('[explore] open group', groupId);
          }}
        />
      </View>
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

    // Title
    title: {
      fontFamily: 'Unbounded',
      fontSize: 24,
      fontWeight: '400',
      color: '#FFFFFF',
      paddingHorizontal: s(21),
      paddingTop: s(10),
    },

    feedWrap: {
      flex: 1,
    },
  });
}
