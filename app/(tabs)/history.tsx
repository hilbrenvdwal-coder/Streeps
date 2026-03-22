import React from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useHistory, formatTimeAgo } from '@/src/hooks/useHistory';

const CATEGORY_COLORS = [Brand.cyan, Brand.magenta, Brand.blue, Brand.purple];

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { history, loading, refresh } = useHistory();

  const renderItem = ({ item }: { item: typeof history[0] }) => (
    <View style={[
      styles.historyItem,
      { backgroundColor: colors.card, borderColor: colors.border },
      item.removed && styles.removedItem,
    ]}>
      <View style={[
        styles.categoryDot,
        { backgroundColor: CATEGORY_COLORS[(item.category - 1) % 4] },
      ]} />
      <View style={styles.itemInfo}>
        <Text style={[styles.categoryName, { color: colors.text }, item.removed && styles.removedText]}>
          Categorie {item.category}
          {item.removed ? ' (verwijderd)' : ''}
        </Text>
        <Text style={[styles.groupName, { color: colors.textSecondary }]}>{item.group_name}</Text>
      </View>
      <Text style={[styles.time, { color: colors.textSecondary }]}>
        {formatTimeAgo(item.created_at)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Brand.magenta} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nog geen streepjes gezet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  removedItem: { opacity: 0.5 },
  removedText: { textDecorationLine: 'line-through' },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  itemInfo: { flex: 1 },
  categoryName: { fontSize: 16, fontWeight: '500' },
  groupName: { fontSize: 13, marginTop: 2 },
  time: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16 },
});
