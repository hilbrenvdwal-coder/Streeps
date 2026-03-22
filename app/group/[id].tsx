import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';

const CATEGORY_COLORS = [Brand.cyan, Brand.magenta, Brand.blue, Brand.purple];

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const {
    group,
    members,
    drinks,
    tallyCounts,
    loading,
    isAdmin,
    addTally,
    toggleActive,
  } = useGroupDetail(id);

  const [selectedDrink, setSelectedDrink] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleAddTally = async () => {
    if (!selectedDrink) return;
    setAdding(true);
    await addTally(selectedDrink);
    setAdding(false);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setSelectedDrink(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Brand.magenta} />
      </View>
    );
  }

  const me = members.find((m) => m.user_id === user?.id);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Confirmation toast */}
      {showConfirmation && (
        <View style={[styles.toast, { backgroundColor: Brand.cyan }]}>
          <Text style={styles.toastText}>Streepje gezet!</Text>
        </View>
      )}

      {/* Active toggle */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.activeToggle,
            {
              backgroundColor: me?.is_active ? Brand.cyan + '20' : colors.surfaceLight,
              borderColor: me?.is_active ? Brand.cyan : colors.border,
            },
          ]}
          onPress={toggleActive}
        >
          <View style={[
            styles.activeDotLarge,
            { backgroundColor: me?.is_active ? Brand.cyan : colors.textSecondary },
          ]} />
          <Text style={[styles.activeText, { color: me?.is_active ? Brand.cyan : colors.textSecondary }]}>
            {me?.is_active ? 'Aanwezig' : 'Afwezig'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Invite code */}
      {group && (
        <View style={[styles.inviteBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inviteLabel, { color: colors.textSecondary }]}>Uitnodigingscode:</Text>
          <Text style={[styles.inviteCode, { color: colors.text }]}>{group.invite_code}</Text>
        </View>
      )}

      {/* Drink selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          KIES JE DRANKJE
        </Text>
        <View style={styles.drinkGrid}>
          {drinks.map((drink) => (
            <TouchableOpacity
              key={drink.id}
              style={[
                styles.drinkCard,
                {
                  backgroundColor: selectedDrink === drink.id ? Brand.magenta + '30' : colors.card,
                  borderColor: selectedDrink === drink.id ? Brand.magenta : colors.border,
                },
              ]}
              onPress={() => setSelectedDrink(drink.id)}
            >
              <Text style={styles.drinkEmoji}>{drink.emoji ?? '🍺'}</Text>
              <Text style={[styles.drinkName, { color: colors.text }]}>{drink.name}</Text>
              <View style={[
                styles.categoryTag,
                { backgroundColor: CATEGORY_COLORS[(drink.category - 1) % 4] + '20' },
              ]}>
                <Text style={[styles.drinkCategory, {
                  color: CATEGORY_COLORS[(drink.category - 1) % 4],
                }]}>
                  cat. {drink.category}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Add tally button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          { backgroundColor: selectedDrink ? Brand.magenta : colors.surfaceLight },
        ]}
        onPress={handleAddTally}
        disabled={!selectedDrink || adding}
      >
        <Text style={[
          styles.addButtonText,
          { color: selectedDrink ? '#fff' : colors.textSecondary },
        ]}>
          {adding ? 'Even wachten...' : 'Streepje zetten!'}
        </Text>
      </TouchableOpacity>

      {/* Members */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          LEDEN
        </Text>
        {members.map((member) => (
          <View
            key={member.id}
            style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[
              styles.activeDot,
              { backgroundColor: member.is_active ? Brand.cyan : colors.textSecondary },
            ]} />
            <Text style={[styles.memberName, { color: colors.text }]}>
              {member.user_id === user?.id ? 'Jij' : (member.profile?.full_name || 'Onbekend')}
              {member.is_admin && ' (admin)'}
            </Text>
            <View style={[styles.memberTallies, { backgroundColor: colors.surfaceLight }]}>
              <Text style={[styles.memberTallyCount, { color: colors.text }]}>
                {tallyCounts[member.user_id] ?? 0}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  activeText: { fontSize: 16, fontWeight: '600' },
  inviteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  inviteLabel: { fontSize: 13 },
  inviteCode: { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  drinkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  drinkCard: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  drinkEmoji: { fontSize: 28 },
  drinkName: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  categoryTag: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  drinkCategory: { fontSize: 11 },
  addButton: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  addButtonText: { fontSize: 18, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  memberName: { flex: 1, fontSize: 16 },
  memberTallies: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberTallyCount: { fontSize: 16, fontWeight: '600' },
  toast: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  toastText: { color: '#1A1A2E', fontSize: 16, fontWeight: '600' },
});
