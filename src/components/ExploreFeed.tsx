import React, { Fragment, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, colors, space, typography } from '@/src/theme';
import { useFollows } from '@/src/hooks/useFollows';
import { useFollowFeed } from '@/src/hooks/useFollowFeed';
import ExploreAvatarRow from '@/src/components/ExploreAvatarRow';
import ExploreFeedItem from '@/src/components/ExploreFeedItem';
import ExploreFeedSectionHeader from '@/src/components/ExploreFeedSectionHeader';
import ExploreSuggestionRow from '@/src/components/ExploreSuggestionRow';

interface ExploreFeedProps {
  onGroupPress: (groupId: string) => void;
}

// ─── Empty states ────────────────────────────────────────────────────────────

function NoFollowsState() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons
        name="compass-outline"
        size={48}
        color={brand.inactive}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>Volg eerst een groep</Text>
      <Text style={styles.emptySubtext}>
        Volg groepen via het profiel van je vrienden.
      </Text>
    </View>
  );
}

function NoActivityState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Nog geen activiteit</Text>
      <Text style={styles.emptySubtext}>
        Er is recent niks te zien in de groepen die je volgt.
      </Text>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ExploreFeed({ onGroupPress }: ExploreFeedProps) {
  const { followedGroups, follow, loading: followsLoading, refresh: refreshFollows } = useFollows();
  const {
    buckets,
    suggestions,
    liveGroupIds,
    loading: feedLoading,
    refresh: refreshFeed,
    removeSuggestion,
  } = useFollowFeed();

  const loading = followsLoading || feedLoading;

  // Session-only likes: bevat keys `${groupId}:${bucketKey}` voor geliked items.
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const toggleLike = useCallback((key: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleRefresh = React.useCallback(async () => {
    await Promise.all([refreshFollows(), refreshFeed()]);
  }, [refreshFollows, refreshFeed]);

  const hasFollowedGroups = followedGroups.length > 0;
  const hasBuckets = buckets.length > 0;
  const hasSuggestions = suggestions.length > 0;

  // Als de user niemand volgt EN er zijn geen suggesties: volledige empty state.
  if (!loading && !hasFollowedGroups && !hasSuggestions) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={brand.inactive}
          />
        }
      >
        <NoFollowsState />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleRefresh}
          tintColor={brand.inactive}
        />
      }
    >
      {/* Avatar-rij — alleen tonen als er gevolgde groepen zijn */}
      {hasFollowedGroups && (
        <View style={styles.avatarRowWrap}>
          <ExploreAvatarRow
            groups={followedGroups.map((g) => ({
              id: g.id,
              name: g.name,
              avatarUrl: g.avatarUrl,
            }))}
            onGroupPress={onGroupPress}
            liveGroupIds={liveGroupIds}
          />
        </View>
      )}

      {/* Suggesties — verberg sectie compleet als leeg */}
      {hasSuggestions && (
        <>
          <ExploreFeedSectionHeader
            label="Misschien leuk om te volgen"
            variant="muted"
          />
          {suggestions.map((s, i) => (
            <Fragment key={s.groupId}>
              {i > 0 && <View style={styles.separator} />}
              <ExploreSuggestionRow
                suggestion={{
                  groupId: s.groupId,
                  name: s.name,
                  avatarUrl: s.avatarUrl,
                  friendNames: s.friendNames,
                  friendCount: s.friendCount,
                  friendsRelation: s.friendsRelation,
                }}
                onFollow={async () => {
                  try {
                    await follow(s.groupId);
                    removeSuggestion(s.groupId);
                  } catch (err) {
                    console.error('[ExploreFeed] follow failed:', err);
                    throw err; // AnimatedFollowButton verwacht throw voor rollback
                  }
                }}
                onOpen={() => onGroupPress(s.groupId)}
              />
            </Fragment>
          ))}
        </>
      )}

      {/* Feed — buckets */}
      {hasBuckets ? (
        buckets.map((bucket) => (
          <Fragment key={bucket.key}>
            <ExploreFeedSectionHeader label={bucket.label} />
            {bucket.items.map((item) => {
              const itemKey = `${item.groupId}:${bucket.key}`;
              return (
                <Fragment key={itemKey}>
                  <ExploreFeedItem
                    group={{
                      id: item.groupId,
                      name: item.groupName,
                      avatarUrl: item.groupAvatarUrl,
                    }}
                    isLive={item.isLive}
                    drinkCounts={item.drinkCounts}
                    onPress={() => onGroupPress(item.groupId)}
                    seedKey={bucket.key}
                    liked={liked.has(itemKey)}
                    onToggleLike={() => toggleLike(itemKey)}
                  />
                </Fragment>
              );
            })}
          </Fragment>
        ))
      ) : hasFollowedGroups ? (
        <NoActivityState />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: space[3],
    paddingBottom: 160,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  avatarRowWrap: {
    paddingBottom: space[2],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.dark.border.default,
    marginHorizontal: space[3],
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
    fontFamily: 'Unbounded',
    color: brand.inactive,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySm,
    fontFamily: 'Unbounded',
    color: brand.inactive,
    textAlign: 'center',
    marginTop: space[1],
  },
});
