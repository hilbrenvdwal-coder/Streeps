import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useGroups } from '@/src/hooks/useGroups';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettlements } from '@/src/hooks/useSettlements';
import { formatTimeAgo } from '@/src/hooks/useHistory';
import GroupSelector from '@/src/components/GroupSelector';
import CounterControl from '@/src/components/CounterControl';
import CategoryRow from '@/src/components/CategoryRow';
import MemberRow from '@/src/components/MemberRow';
import StreepjesVerificatieModal from '@/src/components/StreepjesVerificatieModal';

const STORAGE_KEY = 'streeps_selected_group';

export default function HomeScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t), [mode]);
  const router = useRouter();
  const { user } = useAuth();
  const { groups, loading: groupsLoading, createGroup, joinGroup, refresh: refreshGroups } = useGroups();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Persist selected group
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((id) => {
      if (id) setSelectedGroupId(id);
    });
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      AsyncStorage.setItem(STORAGE_KEY, selectedGroupId);
    }
  }, [selectedGroupId]);

  // Auto-select first group if none selected
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const {
    group,
    members,
    drinks,
    tallyCounts,
    recentTallies,
    loading: detailLoading,
    isAdmin,
    addTally,
    toggleActive,
    removeTally,
    toggleAdmin,
    removeMember,
  } = useGroupDetail(selectedGroupId ?? '');

  const { settling, getUnsettledTallies, createSettlement, fetchHistory, history } = useSettlements(selectedGroupId ?? '');

  // Tally flow state
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [tallyCount, setTallyCount] = useState(1);
  const [showVerification, setShowVerification] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  // Member detail modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showDrinkList, setShowDrinkList] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // Settlement modals
  const [showSettlement, setShowSettlement] = useState(false);
  const [unsettledMembers, setUnsettledMembers] = useState<any[]>([]);
  const [selectedForSettlement, setSelectedForSettlement] = useState<Set<string>>(new Set());
  const [showSettlementHistory, setShowSettlementHistory] = useState(false);

  // Remove tally state for member detail
  const [removeCategory, setRemoveCategory] = useState<number | null>(null);
  const [removeCount, setRemoveCount] = useState(1);

  const activeCategories = useMemo(() => {
    const catsWithDrinks = new Set(drinks.map((d) => d.category));
    return ([1, 2, 3, 4] as const).filter((cat) => catsWithDrinks.has(cat));
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

  const handleCategoryTap = (cat: number) => {
    setSelectedCategory(cat);
    setTallyCount(1);
    setShowVerification(true);
  };

  const handleConfirmTally = async () => {
    if (!selectedCategory || tallyCount < 1) {
      setShowVerification(false);
      return;
    }
    setShowVerification(false);
    setAdding(true);
    const inserts = Array.from({ length: tallyCount }, () => addTally(selectedCategory as 1 | 2 | 3 | 4));
    await Promise.all(inserts);
    setAdding(false);
    setConfirmationText(tallyCount === 1 ? 'Streepje gezet!' : `${tallyCount} streepjes gezet!`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setSelectedCategory(null);
  };

  // Member detail data
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

  const removableTallies = useMemo(() => {
    if (!selectedMemberData || !removeCategory) return [];
    return selectedMemberData.tallies.filter((t) => (t as any).category === removeCategory);
  }, [selectedMemberData, removeCategory]);

  const handleConfirmRemove = async () => {
    if (!removeCategory || removeCount < 1) { setRemoveCategory(null); return; }
    const toRemove = removableTallies.slice(0, removeCount);
    await Promise.all(toRemove.map((t) => removeTally(t.id)));
    setRemoveCategory(null);
  };

  const handleOpenSettlement = async () => {
    if (!group) return;
    const m = await getUnsettledTallies(group);
    if (m.length === 0) { Alert.alert('Geen streepjes', 'Er zijn geen onafgerekende streepjes.'); return; }
    setUnsettledMembers(m);
    setSelectedForSettlement(new Set(m.map((mm: any) => mm.user_id)));
    setShowSettlement(true);
  };

  const handleConfirmSettlement = async () => {
    if (!group || selectedForSettlement.size === 0) return;
    await createSettlement(group, Array.from(selectedForSettlement));
    setShowSettlement(false);
    setConfirmationText('Afrekening gemaakt!');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  };

  const me = members.find((m) => m.user_id === user?.id);

  if (groupsLoading) {
    return (
      <SafeAreaView style={[s.container, s.center]} edges={['top']}>
        <ActivityIndicator size="large" color={t.brand.magenta} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Group Selector */}
        <GroupSelector
          groups={groups}
          selectedId={selectedGroupId}
          onSelect={setSelectedGroupId}
          onCreate={createGroup}
          onJoin={joinGroup}
          theme={t}
        />

        {/* Show group content only when group is selected and loaded */}
        {selectedGroupId && group ? (
          <>
            {/* Group card */}
            <View style={s.groupCard}>
              {(group as any)?.avatar_url ? (
                <Image source={{ uri: (group as any).avatar_url }} style={s.groupAvatar} />
              ) : (
                <View style={[s.groupAvatar, { backgroundColor: t.colors.surface.overlay }]}>
                  <Text style={{ color: t.colors.text.secondary, fontSize: 20, fontWeight: '600' }}>
                    {group?.name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.groupName, { color: t.colors.text.primary }]}>{group.name}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  <Text style={{ color: t.colors.text.tertiary, fontSize: 14 }}>
                    {members.filter((m) => m.is_active).length} actief
                  </Text>
                  <Text style={{ color: t.colors.text.tertiary, fontSize: 14 }}>
                    {members.length} leden
                  </Text>
                </View>
              </View>
            </View>

            {/* Active toggle */}
            <Pressable
              style={[s.activeToggle, { backgroundColor: me?.is_active ? t.brand.cyan + '20' : t.colors.surface.overlay }]}
              onPress={toggleActive}
            >
              <View style={[s.activeDot, { backgroundColor: me?.is_active ? t.brand.cyan : t.colors.text.tertiary }]} />
              <Text style={{ color: me?.is_active ? t.brand.cyan : t.colors.text.tertiary, fontSize: 16, fontWeight: '500' }}>
                {me?.is_active ? 'Aanwezig' : 'Afwezig'}
              </Text>
            </Pressable>

            {/* Counter */}
            <View style={s.section}>
              <CounterControl
                value={tallyCount}
                onIncrement={() => setTallyCount((c) => Math.min(c + 1, 99))}
                onDecrement={() => setTallyCount((c) => Math.max(c - 1, 1))}
                theme={t}
              />
            </View>

            {/* Category rows */}
            <View style={s.section}>
              {activeCategories.map((cat) => (
                <CategoryRow
                  key={cat}
                  name={getCategoryName(cat)}
                  price={getCategoryPrice(cat)}
                  color={t.categoryColors[(cat - 1) % 4]}
                  selected={selectedCategory === cat}
                  onPress={() => handleCategoryTap(cat)}
                  theme={t}
                />
              ))}
            </View>

            {/* Info section */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: t.colors.text.primary }]}>Info</Text>

              {/* Invite code */}
              {group && (
                <Pressable
                  style={[s.infoCard, { backgroundColor: t.colors.surface.raised }]}
                  onPress={async () => {
                    await Clipboard.setStringAsync(group.invite_code);
                    setConfirmationText('Gekopieerd!');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowConfirmation(true);
                    setTimeout(() => setShowConfirmation(false), 1500);
                  }}
                >
                  <Text style={{ color: t.colors.text.tertiary, fontSize: 12 }}>Uitnodigingscode:</Text>
                  <Text style={{ color: t.colors.text.primary, fontSize: 18, fontWeight: '700', letterSpacing: 2 }}>
                    {group.invite_code}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Text style={{ color: t.colors.text.tertiary, fontSize: 11, textTransform: 'uppercase' }}>
                      tap om te kopiëren
                    </Text>
                    <Pressable onPress={async (e) => {
                      e.stopPropagation();
                      await Share.share({ message: `Join mijn groep "${group.name}" op Streeps! Code: ${group.invite_code}` });
                    }}>
                      <Text style={{ color: t.colors.tint, fontSize: 11, textTransform: 'uppercase' }}>delen</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}

              {/* Drink list button */}
              <Pressable
                style={[s.infoCard, { backgroundColor: t.colors.surface.raised, marginTop: 8 }]}
                onPress={() => setShowDrinkList(true)}
              >
                <Text style={{ color: t.colors.text.primary, fontSize: 16, fontWeight: '500' }}>Drankenlijst</Text>
                <Ionicons name="chevron-forward" size={16} color={t.colors.text.tertiary} />
              </Pressable>
            </View>

            {/* Members */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: t.colors.text.primary }]}>Leden</Text>
              <View style={[s.membersCard, { backgroundColor: t.colors.surface.raised }]}>
                {members.slice(0, showMembers ? members.length : 3).map((member, index) => {
                  const name = member.user_id === user?.id ? 'Jij' : (member.profile?.full_name || 'Onbekend');
                  return (
                    <React.Fragment key={member.id}>
                      {index > 0 && <View style={[s.divider, { backgroundColor: t.colors.border.default }]} />}
                      <MemberRow
                        name={name}
                        avatarUrl={member.profile?.avatar_url}
                        isActive={member.is_active}
                        isAdmin={member.is_admin}
                        tallyCount={tallyCounts[member.user_id] ?? 0}
                        theme={t}
                        onPress={() => setSelectedMemberId(member.user_id)}
                      />
                    </React.Fragment>
                  );
                })}
              </View>
              {members.length > 3 && (
                <Pressable onPress={() => setShowMembers(!showMembers)} style={{ paddingVertical: 12 }}>
                  <Text style={{ color: t.colors.text.tertiary, fontSize: 14, textAlign: 'center' }}>
                    {showMembers ? 'Minder tonen' : `Bekijk meer (${members.length - 3})`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Admin actions */}
            {isAdmin && (
              <View style={s.section}>
                <Pressable
                  style={[s.adminBtn, { backgroundColor: t.brand.cyan }]}
                  onPress={handleOpenSettlement}
                  disabled={settling}
                >
                  <Text style={{ color: t.colors.text.inverse, fontSize: 16, fontWeight: '700' }}>
                    {settling ? 'Bezig...' : 'Afrekenen'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.ghostBtn, { borderColor: t.colors.border.default }]}
                  onPress={async () => { await fetchHistory(); setShowSettlementHistory(true); }}
                >
                  <Text style={{ color: t.colors.text.secondary, fontSize: 16, fontWeight: '500' }}>
                    Afrekening historie
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.ghostBtn, { borderColor: t.colors.border.default }]}
                  onPress={() => router.push(`/groups/settings?id=${selectedGroupId}` as any)}
                >
                  <Text style={{ color: t.colors.text.secondary, fontSize: 16, fontWeight: '500' }}>
                    Groep instellingen
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={{ height: 40 }} />
          </>
        ) : selectedGroupId && detailLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={t.brand.magenta} />
          </View>
        ) : !selectedGroupId ? (
          <View style={[s.center, { paddingTop: 80 }]}>
            <Text style={{ color: t.colors.text.primary, fontSize: 22, fontWeight: '600', marginBottom: 8 }}>
              Welkom bij Streeps!
            </Text>
            <Text style={{ color: t.colors.text.tertiary, fontSize: 16, textAlign: 'center' }}>
              Maak een groep aan of neem deel via de selector hierboven.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Confirmation toast */}
      {showConfirmation && (
        <View style={s.toast}>
          <Text style={s.toastIcon}>{confirmationText.includes('Gekopieerd') ? '\u2705' : '\u2728'}</Text>
          <Text style={s.toastText}>{confirmationText}</Text>
        </View>
      )}

      {/* Streepjes Verificatie Modal */}
      <StreepjesVerificatieModal
        visible={showVerification}
        count={tallyCount}
        categoryName={selectedCategory ? getCategoryName(selectedCategory) : ''}
        categoryColor={selectedCategory ? t.categoryColors[(selectedCategory - 1) % 4] : t.brand.cyan}
        onConfirm={handleConfirmTally}
        onCancel={() => setShowVerification(false)}
        theme={t}
      />

      {/* Drink list modal */}
      <Modal visible={showDrinkList} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowDrinkList(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.modalHandle, { backgroundColor: t.colors.border.strong }]} />
            <Text style={{ ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 16 }}>Drankjeslijst</Text>
            {drinks.length === 0 && <Text style={{ color: t.colors.text.secondary }}>Geen drankjes toegevoegd</Text>}
            {drinks.map((drink) => {
              const catColor = t.categoryColors[(drink.category - 1) % 4];
              return (
                <View key={drink.id} style={s.drinkRow}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{drink.emoji ?? '\uD83C\uDF7A'}</Text>
                  <Text style={{ color: t.colors.text.primary, flex: 1, fontSize: 16 }}>{drink.name}</Text>
                  <View style={[s.catBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={{ color: catColor, fontSize: 12 }}>cat. {drink.category}</Text>
                  </View>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Member detail modal */}
      <Modal visible={!!selectedMemberData} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setSelectedMemberId(null)}>
          <Pressable style={[s.modalSheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.modalHandle, { backgroundColor: t.colors.border.strong }]} />
            {selectedMemberData && (
              <ScrollView style={{ maxHeight: 500 }}>
                <Text style={{ ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 16 }}>
                  {selectedMemberData.member.user_id === user?.id
                    ? 'Jij'
                    : (selectedMemberData.member.profile?.full_name || 'Onbekend')}
                  {selectedMemberData.member.is_admin && ' (admin)'}
                </Text>

                <Text style={{ ...t.typography.overline, color: t.colors.text.tertiary, marginBottom: 12 }}>STREEPJES</Text>
                {activeCategories.map((cat) => {
                  const count = selectedMemberData.categoryCounts[cat] || 0;
                  const catColor = t.categoryColors[(cat - 1) % 4];
                  const isRemoving = removeCategory === cat;
                  return (
                    <View key={cat} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.catDot, { backgroundColor: catColor }]} />
                        <Text style={{ color: catColor, flex: 1, fontSize: 16 }}>{getCategoryName(cat)}</Text>
                        <Text style={{ color: t.colors.text.primary, fontWeight: '600', marginRight: 12 }}>{count}</Text>
                        {isAdmin && count > 0 && !isRemoving && (
                          <Pressable onPress={() => { setRemoveCount(1); setRemoveCategory(cat); }} style={{ padding: 4 }}>
                            <Text style={{ color: t.semantic.error, fontSize: 12 }}>verwijder</Text>
                          </Pressable>
                        )}
                      </View>
                      {isRemoving && (
                        <View style={[s.removePanel, { backgroundColor: t.colors.surface.default, borderColor: t.colors.border.default }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                            <Pressable
                              style={[s.counterBtnSm, { backgroundColor: t.semantic.errorBg }]}
                              onPress={() => { removeCount <= 1 ? setRemoveCategory(null) : setRemoveCount((c) => c - 1); }}
                            >
                              <Text style={{ color: t.semantic.error, fontSize: 18, fontWeight: '600' }}>{'\u2212'}</Text>
                            </Pressable>
                            <Text style={{ color: t.colors.text.primary, fontSize: 28, fontWeight: '700', minWidth: 40, textAlign: 'center' }}>{removeCount}</Text>
                            <Pressable
                              style={[s.counterBtnSm, { backgroundColor: t.brand.cyan + '20' }]}
                              onPress={() => setRemoveCount((c) => Math.min(c + 1, removableTallies.length))}
                            >
                              <Text style={{ color: t.brand.cyan, fontSize: 18, fontWeight: '600' }}>+</Text>
                            </Pressable>
                          </View>
                          <Pressable style={[s.removeConfirmBtn, { backgroundColor: t.semantic.error }]} onPress={handleConfirmRemove}>
                            <Text style={{ color: '#fff', fontWeight: '600' }}>Verwijderen</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Tally history */}
                <Text style={{ ...t.typography.overline, color: t.colors.text.tertiary, marginTop: 16, marginBottom: 12 }}>GESCHIEDENIS</Text>
                {selectedMemberData.tallies.length === 0 && <Text style={{ color: t.colors.text.secondary }}>Geen streepjes</Text>}
                {selectedMemberData.tallies.map((tally, index) => {
                  const cat = (tally as any).category ?? 1;
                  const catColor = t.categoryColors[(cat - 1) % 4];
                  return (
                    <React.Fragment key={tally.id}>
                      {index > 0 && <View style={{ height: 1, backgroundColor: t.colors.border.default, marginLeft: 22 }} />}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                        <View style={[s.catDot, { backgroundColor: catColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: t.colors.text.primary, fontSize: 14 }}>{getCategoryName(cat)}</Text>
                          <Text style={{ color: t.colors.text.tertiary, fontSize: 12 }}>{formatTimeAgo(tally.created_at)}</Text>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}

                {/* Admin actions */}
                {isAdmin && selectedMemberData.member.user_id !== user?.id && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <Pressable
                      style={[s.memberActionBtn, { backgroundColor: t.brand.cyan + '20' }]}
                      onPress={() => {
                        const m = selectedMemberData.member;
                        Alert.alert(
                          m.is_admin ? 'Admin verwijderen' : 'Admin maken',
                          `${m.profile?.full_name || 'Onbekend'} ${m.is_admin ? 'is dan geen admin meer' : 'wordt admin'}`,
                          [{ text: 'Annuleren', style: 'cancel' }, { text: 'Ja', onPress: () => toggleAdmin(m.user_id) }]
                        );
                      }}
                    >
                      <Text style={{ color: t.brand.cyan, fontWeight: '600' }}>
                        {selectedMemberData.member.is_admin ? 'Admin verwijderen' : 'Admin maken'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[s.memberActionBtn, { backgroundColor: t.semantic.errorBg }]}
                      onPress={() => {
                        const m = selectedMemberData.member;
                        Alert.alert('Lid verwijderen', `${m.profile?.full_name || 'Onbekend'} uit de groep verwijderen?`, [
                          { text: 'Annuleren', style: 'cancel' },
                          { text: 'Verwijderen', style: 'destructive', onPress: () => { removeMember(m.user_id); setSelectedMemberId(null); } },
                        ]);
                      }}
                    >
                      <Text style={{ color: t.semantic.error, fontWeight: '600' }}>Verwijderen</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settlement modal */}
      <Modal visible={showSettlement} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowSettlement(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.modalHandle, { backgroundColor: t.colors.border.strong }]} />
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={{ ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 16 }}>Afrekenen</Text>

              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                onPress={() => {
                  if (selectedForSettlement.size === unsettledMembers.length) setSelectedForSettlement(new Set());
                  else setSelectedForSettlement(new Set(unsettledMembers.map((m) => m.user_id)));
                }}
              >
                <View style={[s.checkbox, selectedForSettlement.size === unsettledMembers.length && s.checkboxChecked]} />
                <Text style={{ color: t.colors.text.primary, fontWeight: '600' }}>Selecteer alles</Text>
              </Pressable>

              {unsettledMembers.map((member) => {
                const selected = selectedForSettlement.has(member.user_id);
                return (
                  <Pressable
                    key={member.user_id}
                    style={[s.settlementRow, { borderColor: selected ? t.brand.cyan : t.colors.border.default, backgroundColor: t.colors.surface.default }]}
                    onPress={() => {
                      setSelectedForSettlement((prev) => {
                        const next = new Set(prev);
                        next.has(member.user_id) ? next.delete(member.user_id) : next.add(member.user_id);
                        return next;
                      });
                    }}
                  >
                    <View style={[s.checkbox, selected && s.checkboxChecked]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.colors.text.primary, fontWeight: '600' }}>
                        {member.user_id === user?.id ? 'Jij' : member.full_name}
                      </Text>
                      {activeCategories.map((cat) => {
                        const count = member.counts[cat] || 0;
                        if (count === 0) return null;
                        return (
                          <Text key={cat} style={{ color: t.colors.text.secondary, fontSize: 12 }}>
                            {getCategoryName(cat)}: {count}x
                          </Text>
                        );
                      })}
                    </View>
                    <Text style={{ fontSize: 16, color: t.brand.cyan, fontWeight: '700' }}>
                      {'\u20AC'} {(member.amount / 100).toFixed(2).replace('.', ',')}
                    </Text>
                  </Pressable>
                );
              })}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 16, color: t.colors.text.primary, fontWeight: '700' }}>Totaal</Text>
                <Text style={{ fontSize: 16, color: t.brand.cyan, fontWeight: '700' }}>
                  {'\u20AC'} {(unsettledMembers.filter((m) => selectedForSettlement.has(m.user_id)).reduce((sum, m) => sum + m.amount, 0) / 100).toFixed(2).replace('.', ',')}
                </Text>
              </View>

              <Pressable
                style={[s.adminBtn, { backgroundColor: t.brand.cyan, marginTop: 16 }]}
                onPress={handleConfirmSettlement}
                disabled={settling || selectedForSettlement.size === 0}
              >
                <Text style={{ color: t.colors.text.inverse, fontSize: 16, fontWeight: '700' }}>
                  {settling ? 'Bezig...' : 'Bevestigen'}
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settlement history modal */}
      <Modal visible={showSettlementHistory} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowSettlementHistory(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.modalHandle, { backgroundColor: t.colors.border.strong }]} />
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={{ ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 16 }}>Afrekening historie</Text>
              {history.length === 0 && <Text style={{ color: t.colors.text.secondary }}>Nog geen afrekeningen</Text>}
              {history.map((settlement) => (
                <View key={settlement.id} style={[s.settlementRow, { borderColor: t.colors.border.default, backgroundColor: t.colors.surface.default }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.text.primary, fontWeight: '600' }}>{formatTimeAgo(settlement.created_at)}</Text>
                    {settlement.lines.map((line: any) => (
                      <Text key={line.user_id} style={{ color: t.colors.text.secondary, fontSize: 12 }}>
                        {line.full_name}: {'\u20AC'} {(line.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ fontSize: 16, color: t.brand.cyan, fontWeight: '700' }}>
                    {'\u20AC'} {(settlement.total_amount / 100).toFixed(2).replace('.', ',')}
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

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background.primary },
    center: { justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20 },

    // Group card
    groupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface.raised,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    groupAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: { fontSize: 20, fontWeight: '700' },

    // Active toggle
    activeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 9999,
      marginBottom: 16,
    },
    activeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },

    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },

    // Info card
    infoCard: {
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },

    // Members
    membersCard: { borderRadius: 16, overflow: 'hidden' },
    divider: { height: 1, marginLeft: 68 },

    // Admin
    adminBtn: {
      height: 52,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    ghostBtn: {
      height: 48,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      borderWidth: 1,
    },

    // Toast
    toast: {
      position: 'absolute',
      bottom: 100,
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: t.brand.cyan,
      ...t.shadows.md,
    },
    toastIcon: { fontSize: 18 },
    toastText: { color: t.colors.text.inverse, fontSize: 16, fontWeight: '500' },

    // Modal shared
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim },
    modalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 40,
    },
    modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

    drinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.default,
    },
    catBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },

    // Member detail
    counterBtnSm: { width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
    removePanel: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    removeConfirmBtn: { padding: 12, borderRadius: 9999, alignItems: 'center', marginTop: 8 },
    memberActionBtn: { flex: 1, padding: 12, borderRadius: 9999, alignItems: 'center' },

    // Settlement
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: t.colors.text.tertiary,
      marginRight: 12,
    },
    checkboxChecked: { backgroundColor: t.brand.cyan, borderColor: t.brand.cyan },
    settlementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
  });
}
