import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { LiveBadge } from '@/src/components/LiveBadge';
import { colors, radius } from '@/src/theme';

export interface ExploreAvatarRowGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ExploreAvatarRowProps {
  groups: ExploreAvatarRowGroup[];
  onGroupPress: (groupId: string) => void;
  /** Group-ids die momenteel live zijn (LIVE-badge op avatar). */
  liveGroupIds?: Set<string>;
}

const AVATAR_SIZE = 52;
const ITEM_WIDTH = 64;

function initials(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function ExploreAvatarRow({
  groups,
  onGroupPress,
  liveGroupIds,
}: ExploreAvatarRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {groups.map((group) => {
        const isLive = !!liveGroupIds?.has(group.id);
        return (
          <Pressable
            key={group.id}
            onPress={() => onGroupPress(group.id)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            hitSlop={4}
          >
            <View style={styles.avatarWrap}>
              {group.avatarUrl ? (
                <Image
                  source={{ uri: group.avatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <AvatarPlaceholder size={AVATAR_SIZE} label={initials(group.name)} />
              )}
              {isLive && (
                <View style={styles.liveBadgeWrap} pointerEvents="none">
                  <LiveBadge size="md" />
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {group.name.split(' ')[0]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  item: {
    alignItems: 'center',
    width: ITEM_WIDTH,
  },
  itemPressed: {
    opacity: 0.7,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'visible',
    position: 'relative',
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.dark.surface.default,
  },
  liveBadgeWrap: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 6,
    width: ITEM_WIDTH,
    textAlign: 'center',
  },
});
