import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';
import { formatTimeAgo } from '@/src/hooks/useHistory';
import { useSettlements } from '@/src/hooks/useSettlements';
import * as Clipboard from 'expo-clipboard';

const CATEGORY_COLORS = [Brand.cyan, Brand.magenta, Brand.blue, Brand.purple];

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const {
    group,
    members,
    drinks,
    tallyCounts,
    recentTallies,
    loading,
    isAdmin,
    addTally,
    toggleActive,
    removeTally,
    toggleAdmin,
    removeMember,
  } = useGroupDetail(id);

  const { settling, getUnsettledTallies, createSettlement, fetchHistory, history } = useSettlements(id);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [unsettledMembers, setUnsettledMembers] = useState<any[]>([]);
  const [selectedForSettlement, setSelectedForSettlement] = useState<Set<string>>(new Set());
  const [showSettlementHistory, setShowSettlementHistory] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationText, setConfirmationText] = useState('Streepje gezet!');
  const [adding, setAdding] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showDrinkList, setShowDrinkList] = useState(false);
  const [showTallyCount, setShowTallyCount] = useState(false);
  const [tallyCount, setTallyCount] = useState(1);

  // Which categories are active (have at least one drink)
  const activeCategories = useMemo(() => {
    const catsWithDrinks = new Set(drinks.map((d) => d.category));
    return [1, 2, 3, 4].filter((cat) => catsWithDrinks.has(cat));
  }, [drinks]);

  const getCategoryName = (cat: number) => {
    if (!group) return `Categorie ${cat}`;
    switch (cat) {
      case 1: return group.name_category_1 || 'Categorie 1';
      case 2: return group.name_category_2 || 'Categorie 2';
      case 3: return group.name_category_3 || 'Categorie 3';
      case 4: return group.name_category_4 || 'Categorie 4';
      default: return `Categorie ${cat}`;
    }
  };

  const getCategoryPrice = (cat: number) => {
    if (!group) return 0;
    switch (cat) {
      case 1: return group.price_category_1;
      case 2: return group.price_category_2;
      case 3: return group.price_category_3 ?? 0;
      case 4: return group.price_category_4 ?? 0;
      default: return 0;
    }
  };

  const handleAddTally = () => {
    if (!selectedCategory) return;
    setTallyCount(1);
    setShowTallyCount(true);
  };

  const handleConfirmTally = async () => {
    if (!selectedCategory || tallyCount < 1) {
      setShowTallyCount(false);
      return;
    }
    setShowTallyCount(false);
    setAdding(true);
    // Insert multiple tallies
    const inserts = Array.from({ length: tallyCount }, () => addTally(selectedCategory));
    await Promise.all(inserts);
    setAdding(false);
    setConfirmationText(tallyCount === 1 ? 'Streepje gezet!' : `${tallyCount} streepjes gezet!`);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setSelectedCategory(null);
  };

  // Member detail modal data
  const selectedMemberData = useMemo(() => {
    if (!selectedMemberId) return null;
    const member = members.find((m) => m.user_id === selectedMemberId);
    if (!member) return null;
    const tallies = recentTallies.filter((t) => t.user_id === selectedMemberId);
    const categoryCounts: Record<number, number> = {};
    tallies.forEach((t) => {
      const cat = (t as any).category ?? 1;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    return { member, tallies, categoryCounts };
  }, [selectedMemberId, members, recentTallies]);

  const [removeCategory, setRemoveCategory] = useState<number | null>(null);
  const [removeCount, setRemoveCount] = useState(1);

  // Get tallies for the selected member + category (for bulk remove)
  const removableTallies = useMemo(() => {
    if (!selectedMemberData || !removeCategory) return [];
    return selectedMemberData.tallies.filter((t) => (t as any).category === removeCategory);
  }, [selectedMemberData, removeCategory]);

  const handleStartRemove = (category: number, maxCount: number) => {
    if (maxCount === 0) return;
    setRemoveCount(1);
    setRemoveCategory(category);
  };

  const handleConfirmRemove = async () => {
    if (!removeCategory || removeCount < 1) {
      setRemoveCategory(null);
      return;
    }
    const toRemove = removableTallies.slice(0, removeCount);
    await Promise.all(toRemove.map((t) => removeTally(t.id)));
    setRemoveCategory(null);
  };

  const handleOpenSettlement = async () => {
    if (!group) return;
    const members = await getUnsettledTallies(group);
    if (members.length === 0) {
      Alert.alert('Geen streepjes', 'Er zijn geen onafgerekende streepjes.');
      return;
    }
    setUnsettledMembers(members);
    setSelectedForSettlement(new Set(members.map((m) => m.user_id)));
    setShowSettlement(true);
  };

  const toggleSettlementMember = (userId: string) => {
    setSelectedForSettlement((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllSettlement = () => {
    if (selectedForSettlement.size === unsettledMembers.length) {
      setSelectedForSettlement(new Set());
    } else {
      setSelectedForSettlement(new Set(unsettledMembers.map((m) => m.user_id)));
    }
  };

  const handleConfirmSettlement = async () => {
    if (!group || selectedForSettlement.size === 0) return;
    await createSettlement(group, Array.from(selectedForSettlement));
    setShowSettlement(false);
    setConfirmationText('Afrekening gemaakt!');
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  };

  const handleOpenHistory = async () => {
    await fetchHistory();
    setShowSettlementHistory(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={Brand.magenta} />
      </SafeAreaView>
    );
  }

  const me = members.find((m) => m.user_id === user?.id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView>
        {/* Confirmation toast */}
        {showConfirmation && (
          <View style={[styles.toast, { backgroundColor: Brand.cyan }]}>
            <Text style={styles.toastText}>{confirmationText}</Text>
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
          <TouchableOpacity
            style={[styles.inviteBar, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={async () => {
              await Clipboard.setStringAsync(group.invite_code);
              setConfirmationText('Gekopieerd!');
              setShowConfirmation(true);
              setTimeout(() => setShowConfirmation(false), 1500);
            }}
          >
            <Text style={[styles.inviteLabel, { color: colors.textSecondary }]}>Uitnodigingscode:</Text>
            <Text style={[styles.inviteCode, { color: colors.text }]}>{group.invite_code}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>tap om te kopiëren</Text>
          </TouchableOpacity>
        )}

        {/* Category selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            KIES CATEGORIE
          </Text>
          <View style={styles.categoryGrid}>
            {activeCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: selectedCategory === cat
                      ? CATEGORY_COLORS[(cat - 1) % 4] + '30'
                      : colors.card,
                    borderColor: selectedCategory === cat
                      ? CATEGORY_COLORS[(cat - 1) % 4]
                      : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryLabel, { color: CATEGORY_COLORS[(cat - 1) % 4] }]}>
                  {getCategoryName(cat)}
                </Text>
                <Text style={[styles.categoryPrice, { color: colors.text }]}>
                  {(getCategoryPrice(cat) / 100).toFixed(2).replace('.', ',')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Add tally button */}
        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: selectedCategory ? Brand.magenta : colors.surfaceLight },
          ]}
          onPress={handleAddTally}
          disabled={!selectedCategory || adding}
        >
          <Text style={[
            styles.addButtonText,
            { color: selectedCategory ? '#fff' : colors.textSecondary },
          ]}>
            {adding ? 'Even wachten...' : 'Streepje zetten!'}
          </Text>
        </TouchableOpacity>

        {/* Drink list button */}
        <TouchableOpacity
          style={{ alignItems: 'center', marginBottom: 8 }}
          onPress={() => setShowDrinkList(true)}
        >
          <Text style={{ color: Brand.cyan, fontSize: 14 }}>Bekijk drankjeslijst</Text>
        </TouchableOpacity>

        {/* Members — tap to open detail */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            LEDEN
          </Text>
          {members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setSelectedMemberId(member.user_id)}
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
            </TouchableOpacity>
          ))}
        </View>

        {/* Admin actions */}
        {isAdmin && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: Brand.cyan, margin: 0, marginBottom: 8 }]}
              onPress={handleOpenSettlement}
              disabled={settling}
            >
              <Text style={[styles.addButtonText, { color: '#1A1A2E' }]}>
                {settling ? 'Bezig...' : 'Afrekenen'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.surfaceLight, margin: 0, marginBottom: 8 }]}
              onPress={handleOpenHistory}
            >
              <Text style={[styles.addButtonText, { color: colors.text }]}>
                Afrekening historie
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.surfaceLight, margin: 0 }]}
              onPress={() => router.push(`/groups/settings?id=${id}` as any)}
            >
              <Text style={[styles.addButtonText, { color: colors.text }]}>
                Groep instellingen
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Drink list modal */}
      <Modal visible={showDrinkList} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDrinkList(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Drankjeslijst</Text>
            {drinks.length === 0 && (
              <Text style={{ color: colors.textSecondary }}>Geen drankjes toegevoegd</Text>
            )}
            {drinks.map((drink) => (
              <View
                key={drink.id}
                style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 20, marginRight: 10 }}>{drink.emoji ?? '🍺'}</Text>
                <Text style={[{ color: colors.text, flex: 1, fontSize: 16 }]}>{drink.name}</Text>
                <View style={[
                  styles.catBadge,
                  { backgroundColor: CATEGORY_COLORS[(drink.category - 1) % 4] + '20' },
                ]}>
                  <Text style={{ color: CATEGORY_COLORS[(drink.category - 1) % 4], fontSize: 12 }}>
                    cat. {drink.category}
                  </Text>
                </View>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tally count modal */}
      <Modal visible={showTallyCount} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={[styles.tallyCountModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>
              Hoeveel streepjes?
            </Text>
            {selectedCategory && (
              <Text style={{ color: CATEGORY_COLORS[(selectedCategory - 1) % 4], textAlign: 'center', marginBottom: 16 }}>
                {getCategoryName(selectedCategory)}
              </Text>
            )}
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={[styles.counterBtn, { backgroundColor: '#ff444420' }]}
                onPress={() => {
                  if (tallyCount <= 1) {
                    setShowTallyCount(false);
                  } else {
                    setTallyCount((c) => c - 1);
                  }
                }}
              >
                <Text style={{ color: '#ff4444', fontSize: 24, fontWeight: '700' }}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.counterValue, { color: colors.text }]}>{tallyCount}</Text>
              <TouchableOpacity
                style={[styles.counterBtn, { backgroundColor: Brand.cyan + '20' }]}
                onPress={() => setTallyCount((c) => Math.min(c + 1, 99))}
              >
                <Text style={{ color: Brand.cyan, fontSize: 24, fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: Brand.magenta }]}
              onPress={handleConfirmTally}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Accepteren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Member detail modal */}
      <Modal visible={!!selectedMemberData} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMemberId(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {selectedMemberData && (
              <ScrollView style={{ maxHeight: 500 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedMemberData.member.user_id === user?.id
                    ? 'Jij'
                    : (selectedMemberData.member.profile?.full_name || 'Onbekend')}
                  {selectedMemberData.member.is_admin && ' (admin)'}
                </Text>

                {/* Tally counts per category with remove button */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>STREEPJES</Text>
                {activeCategories.map((cat) => {
                  const count = selectedMemberData.categoryCounts[cat] || 0;
                  const isRemoving = removeCategory === cat;
                  return (
                    <View key={cat} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[(cat - 1) % 4] }]} />
                        <Text style={{ color: CATEGORY_COLORS[(cat - 1) % 4], flex: 1 }}>
                          {getCategoryName(cat)}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: '600', marginRight: 10 }}>{count}</Text>
                        {isAdmin && count > 0 && !isRemoving && (
                          <TouchableOpacity
                            onPress={() => handleStartRemove(cat, count)}
                            style={{ padding: 4 }}
                          >
                            <Text style={{ color: '#ff4444', fontSize: 12 }}>verwijder</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {isRemoving && (
                        <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                            <TouchableOpacity
                              style={[styles.counterBtnSmall, { backgroundColor: '#ff444420' }]}
                              onPress={() => {
                                if (removeCount <= 1) {
                                  setRemoveCategory(null);
                                } else {
                                  setRemoveCount((c) => c - 1);
                                }
                              }}
                            >
                              <Text style={{ color: '#ff4444', fontSize: 20, fontWeight: '700' }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', minWidth: 40, textAlign: 'center' }}>
                              {removeCount}
                            </Text>
                            <TouchableOpacity
                              style={[styles.counterBtnSmall, { backgroundColor: Brand.cyan + '20' }]}
                              onPress={() => setRemoveCount((c) => Math.min(c + 1, removableTallies.length))}
                            >
                              <Text style={{ color: Brand.cyan, fontSize: 20, fontWeight: '700' }}>+</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={{ backgroundColor: '#ff4444', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
                            onPress={handleConfirmRemove}
                          >
                            <Text style={{ color: '#fff', fontWeight: '600' }}>Verwijderen</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Tally history */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>GESCHIEDENIS</Text>
                {selectedMemberData.tallies.length === 0 && (
                  <Text style={{ color: colors.textSecondary }}>Geen streepjes</Text>
                )}
                {selectedMemberData.tallies.map((tally) => {
                  const cat = (tally as any).category ?? 1;
                  return (
                    <View
                      key={tally.id}
                      style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={[
                        styles.catDot,
                        { backgroundColor: CATEGORY_COLORS[(cat - 1) % 4] },
                      ]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14 }}>{getCategoryName(cat)}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatTimeAgo(tally.created_at)}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Admin actions */}
                {isAdmin && selectedMemberData.member.user_id !== user?.id && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <TouchableOpacity
                      style={[styles.adminBtn, { backgroundColor: Brand.cyan + '20' }]}
                      onPress={() => {
                        const m = selectedMemberData.member;
                        Alert.alert(
                          m.is_admin ? 'Admin verwijderen' : 'Admin maken',
                          `${m.profile?.full_name || 'Onbekend'} ${m.is_admin ? 'is dan geen admin meer' : 'wordt admin'}`,
                          [
                            { text: 'Annuleren', style: 'cancel' },
                            { text: 'Ja', onPress: () => toggleAdmin(m.user_id) },
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: Brand.cyan, fontWeight: '600' }}>
                        {selectedMemberData.member.is_admin ? 'Admin verwijderen' : 'Admin maken'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.adminBtn, { backgroundColor: '#ff444420' }]}
                      onPress={() => {
                        const m = selectedMemberData.member;
                        Alert.alert(
                          'Lid verwijderen',
                          `${m.profile?.full_name || 'Onbekend'} uit de groep verwijderen?`,
                          [
                            { text: 'Annuleren', style: 'cancel' },
                            {
                              text: 'Verwijderen',
                              style: 'destructive',
                              onPress: () => { removeMember(m.user_id); setSelectedMemberId(null); },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: '#ff4444', fontWeight: '600' }}>Verwijderen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

          </Pressable>
        </Pressable>
      </Modal>

      {/* Settlement modal */}
      <Modal visible={showSettlement} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSettlement(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Afrekenen</Text>

              {/* Select all */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                onPress={toggleAllSettlement}
              >
                <View style={[styles.checkbox, selectedForSettlement.size === unsettledMembers.length && styles.checkboxChecked]} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>Selecteer alles</Text>
              </TouchableOpacity>

              {/* Per member */}
              {unsettledMembers.map((member) => {
                const selected = selectedForSettlement.has(member.user_id);
                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[styles.settlementRow, { backgroundColor: colors.card, borderColor: selected ? Brand.cyan : colors.border }]}
                    onPress={() => toggleSettlementMember(member.user_id)}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>
                        {member.user_id === user?.id ? 'Jij' : member.full_name}
                      </Text>
                      {activeCategories.map((cat) => {
                        const count = member.counts[cat] || 0;
                        if (count === 0) return null;
                        return (
                          <Text key={cat} style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {getCategoryName(cat)}: {count}x
                          </Text>
                        );
                      })}
                    </View>
                    <Text style={{ color: Brand.cyan, fontWeight: '700', fontSize: 16 }}>
                      {(member.amount / 100).toFixed(2).replace('.', ',')}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Totaal</Text>
                <Text style={{ color: Brand.cyan, fontWeight: '700', fontSize: 16 }}>
                  {(unsettledMembers
                    .filter((m) => selectedForSettlement.has(m.user_id))
                    .reduce((sum, m) => sum + m.amount, 0) / 100
                  ).toFixed(2).replace('.', ',')}
                </Text>
              </View>

              {/* Confirm */}
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: Brand.cyan, margin: 0, marginTop: 16 }]}
                onPress={handleConfirmSettlement}
                disabled={settling || selectedForSettlement.size === 0}
              >
                <Text style={[styles.addButtonText, { color: '#1A1A2E' }]}>
                  {settling ? 'Bezig...' : 'Bevestigen'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settlement history modal */}
      <Modal visible={showSettlementHistory} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSettlementHistory(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Afrekening historie</Text>
              {history.length === 0 && (
                <Text style={{ color: colors.textSecondary }}>Nog geen afrekeningen</Text>
              )}
              {history.map((settlement) => (
                <View
                  key={settlement.id}
                  style={[styles.settlementRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {formatTimeAgo(settlement.created_at)}
                    </Text>
                    {settlement.lines.map((line) => (
                      <Text key={line.user_id} style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {line.full_name}: {(line.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ color: Brand.cyan, fontWeight: '700', fontSize: 16 }}>
                    {(settlement.total_amount / 100).toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    flex: 1,
    minWidth: '40%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryLabel: { fontSize: 16, fontWeight: '700' },
  categoryPrice: { fontSize: 14, marginTop: 4 },
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
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  counterBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: Brand.cyan,
    borderColor: Brand.cyan,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  adminBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  centeredOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tallyCountModal: {
    margin: 40,
    padding: 24,
    borderRadius: 20,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  counterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 48,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  acceptBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});
