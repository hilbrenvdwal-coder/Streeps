import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import AnimatedFollowButton from '@/src/components/AnimatedFollowButton';
import { brand, colors, radius, space, typography } from '@/src/theme';

export type SuggestionFriendsRelation = 'member' | 'follower' | 'mixed';

export interface ExploreSuggestion {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  /** Max 3 namen voor subline. */
  friendNames: string[];
  friendCount: number;
  friendsRelation: SuggestionFriendsRelation;
}

interface ExploreSuggestionRowProps {
  suggestion: ExploreSuggestion;
  onFollow: () => Promise<void>;
  onOpen: () => void;
}

const AVATAR_SIZE = 40;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildSubline(s: ExploreSuggestion): string {
  const { friendNames, friendCount, friendsRelation } = s;
  const plural = friendCount >= 2;

  let verb: string;
  if (friendsRelation === 'mixed') {
    verb = 'zitten hierin';
  } else if (friendsRelation === 'member') {
    verb = plural ? 'zitten hierin' : 'zit hierin';
  } else {
    verb = plural ? 'volgen hierin' : 'volgt hierin';
  }

  if (friendCount === 1) {
    const n0 = friendNames[0] ?? 'Een vriend';
    return `${n0} ${verb}`;
  }
  if (friendCount === 2) {
    const n0 = friendNames[0] ?? 'Een vriend';
    const n1 = friendNames[1] ?? 'een vriend';
    return `${n0} en ${n1} ${verb}`;
  }
  // >= 3
  const n0 = friendNames[0] ?? 'Een vriend';
  return `${n0} + ${friendCount - 1} ${verb}`;
}

export default function ExploreSuggestionRow({
  suggestion,
  onFollow,
  onOpen,
}: ExploreSuggestionRowProps) {
  const subline = buildSubline(suggestion);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatarWrap}>
        {suggestion.avatarUrl ? (
          <Image
            source={{ uri: suggestion.avatarUrl }}
            style={styles.avatarImg}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <AvatarPlaceholder size={AVATAR_SIZE} label={initials(suggestion.name)} />
        )}
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {suggestion.name}
        </Text>
        <Text style={styles.subline} numberOfLines={1}>
          {subline}
        </Text>
      </View>

      <View style={styles.btnWrap}>
        <AnimatedFollowButton onPress={onFollow} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[3],
    gap: space[3],
  },
  rowPressed: {
    opacity: 0.7,
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
  middle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontFamily: 'Unbounded',
    color: colors.dark.text.primary,
    fontWeight: '500',
  },
  subline: {
    ...typography.caption,
    fontFamily: 'Unbounded',
    color: brand.inactive,
    marginTop: 2,
  },
  btnWrap: {
    marginLeft: space[2],
  },
});
