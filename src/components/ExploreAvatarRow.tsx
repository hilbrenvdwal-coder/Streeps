import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { LiveBadge } from '@/src/components/LiveBadge';
import { colors, radius, space, typography } from '@/src/theme';

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

const AVATAR_SIZE = 64;
const ITEM_MAX_WIDTH = 68;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
              {group.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: space[4],
    gap: space[3],
  },
  item: {
    alignItems: 'center',
    maxWidth: ITEM_MAX_WIDTH,
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
    top: -2,
    right: -4,
  },
  name: {
    ...typography.caption,
    color: colors.dark.text.primary,
    marginTop: space[1],
    maxWidth: ITEM_MAX_WIDTH,
    textAlign: 'center',
  },
});
