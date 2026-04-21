import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { LiveBadge } from '@/src/components/LiveBadge';
import { brand, colors, radius, space, typography } from '@/src/theme';

export interface ExploreFeedItemGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ExploreFeedDrinkCount {
  emoji: string;
  count: number;
}

interface ExploreFeedItemProps {
  group: ExploreFeedItemGroup;
  isLive: boolean;
  drinkCounts: ExploreFeedDrinkCount[];
  onPress: () => void;
}

const AVATAR_SIZE = 32;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ExploreFeedItem({
  group,
  isLive,
  drinkCounts,
  onPress,
}: ExploreFeedItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.topRow}>
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
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        {isLive && <LiveBadge size="sm" />}
      </View>

      {drinkCounts.length > 0 && (
        <View style={styles.bottomRow}>
          {drinkCounts.map((d, i) => (
            <React.Fragment key={`${d.emoji}-${i}`}>
              {i > 0 && <Text style={styles.separator}> · </Text>}
              <Text style={styles.emoji}>{d.emoji}</Text>
              <Text style={styles.count}> {d.count}</Text>
            </React.Fragment>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  rowPressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.dark.surface.default,
  },
  name: {
    ...typography.body,
    color: colors.dark.text.primary,
    fontWeight: '500',
    flexShrink: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: space[1],
    marginLeft: AVATAR_SIZE + space[2],
  },
  emoji: {
    fontSize: 14,
  },
  count: {
    fontSize: 14,
    lineHeight: 20,
    color: brand.inactive,
  },
  separator: {
    fontSize: 14,
    lineHeight: 20,
    color: brand.inactive,
  },
});
