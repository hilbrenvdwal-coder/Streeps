import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { getTheme, type Theme } from '@/src/theme';

interface MemberRowProps {
  name: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  isAdmin?: boolean;
  tallyCount?: number;
  theme: Theme;
  onPress?: () => void;
}

export default function MemberRow({
  name,
  avatarUrl,
  isActive,
  isAdmin,
  tallyCount,
  theme: t,
  onPress,
}: MemberRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: t.colors.surface.overlay }]}>
            <Text style={{ color: t.colors.text.secondary, fontSize: 14, fontWeight: '600' }}>
              {name[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        {isActive && (
          <View style={[styles.statusBadge, { backgroundColor: t.colors.surface.raised }]}>
            <View style={[styles.statusDot, { backgroundColor: '#00FE96' }]} />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: t.colors.text.primary }]}>
          {name}{isAdmin ? ' (admin)' : ''}
        </Text>
      </View>
      {tallyCount !== undefined && (
        <View style={[styles.badge, { backgroundColor: t.brand.magenta + '18' }]}>
          <Text style={[styles.badgeText, { color: t.brand.magenta }]}>{tallyCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },
  info: { flex: 1 },
  name: { fontFamily: 'Unbounded', fontSize: 20, fontWeight: '400', color: '#FFFFFF' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: { fontSize: 14, fontWeight: '600' },
});
