import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, space, typography } from '@/src/theme';
import { useFollows } from '@/src/hooks/useFollows';
import FollowedGroupRow from '@/src/components/FollowedGroupRow';

interface ExploreFeedProps {
  onGroupPress: (groupId: string) => void;
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons
        name="compass-outline"
        size={48}
        color={brand.inactive}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>Nog niks gevolgd</Text>
      <Text style={styles.emptySubtext}>
        Volg groepen via het profiel van je vrienden.
      </Text>
    </View>
  );
}

export default function ExploreFeed({ onGroupPress }: ExploreFeedProps) {
  const { followedGroups, loading, refresh, unfollow } = useFollows();

  return (
    <FlatList
      data={followedGroups}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <FollowedGroupRow
          group={item}
          onPress={() => onGroupPress(item.id)}
          onUnfollow={() => {
            unfollow(item.id).catch((err) => {
              console.error('[ExploreFeed] unfollow failed:', err);
            });
          }}
        />
      )}
      refreshing={loading}
      onRefresh={refresh}
      ListEmptyComponent={<EmptyState />}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: space[3],
    paddingBottom: 160,
    paddingHorizontal: space[4],
    gap: space[2],
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space[10],
    paddingHorizontal: space[6],
  },
  emptyIcon: {
    marginBottom: space[3],
  },
  emptyTitle: {
    ...typography.body,
    color: brand.inactive,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySm,
    color: brand.inactive,
    textAlign: 'center',
    marginTop: space[1],
  },
});
