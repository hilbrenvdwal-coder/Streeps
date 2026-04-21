import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors, radius, space, typography } from '@/src/theme';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import type { FollowedGroup } from '@/src/hooks/useFollows';

const AVATAR_SIZE = 54;

interface FollowedGroupRowProps {
  group: FollowedGroup;
  onPress: () => void;
  onUnfollow: () => void;
}

/**
 * Format an ISO timestamp into a relative Dutch phrase
 * ("net nu", "3 min geleden", "2 uur geleden", "4 dagen geleden",
 *  or a locale date for anything older than a week).
 */
function formatRelative(iso: string | null): string {
  if (!iso) return 'nog geen activiteit';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = diff / 60000;
  if (mins < 1) return 'net nu';
  if (mins < 60) return `${Math.round(mins)} min geleden`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} uur geleden`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)} dagen geleden`;
  return new Date(iso).toLocaleDateString('nl-NL');
}

export default function FollowedGroupRow({
  group,
  onPress,
  onUnfollow,
}: FollowedGroupRowProps) {
  const subline = `${group.memberCount} leden · ${formatRelative(group.lastActivityAt)}`;
  const showFollowingPill = !group.isMember && group.isExplicitFollow;

  const handleUnfollowPress = () => {
    Alert.alert(
      'Niet meer volgen?',
      `Stop met het volgen van ${group.name}?`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Niet meer volgen',
          style: 'destructive',
          onPress: onUnfollow,
        },
      ],
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open groep ${group.name}`}
    >
      {group.avatarUrl ? (
        <Image
          source={{ uri: group.avatarUrl }}
          style={styles.avatar}
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <AvatarPlaceholder
          size={AVATAR_SIZE}
          label={group.name[0]?.toUpperCase() ?? '?'}
          borderRadius={AVATAR_SIZE / 2}
          fontSize={18}
          style={styles.avatar}
        />
      )}

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.subline} numberOfLines={1}>
          {subline}
        </Text>
      </View>

      {group.isMember ? (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={brand.inactive}
          style={styles.cta}
        />
      ) : showFollowingPill ? (
        <Pressable
          onPress={handleUnfollowPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.followingPill,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Niet meer volgen"
        >
          <Text style={styles.followingPillText}>Volgend</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  rowPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    color: colors.dark.text.primary,
  },
  subline: {
    ...typography.caption,
    fontFamily: 'Unbounded',
    color: brand.inactive,
    marginTop: 2,
  },
  cta: {
    marginLeft: space[2],
  },
  followingPill: {
    marginLeft: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: brand.cyan,
  },
  followingPillText: {
    ...typography.captionMedium,
    fontFamily: 'Unbounded',
    color: brand.cyan,
  },
});
