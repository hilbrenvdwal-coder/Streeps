import React, { useState, useMemo } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';
import { formatTimeAgo } from '@/src/hooks/useHistory';
import { useSettlements } from '@/src/hooks/useSettlements';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t, mode), [mode]);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  };

  const handleOpenHistory = async () => {
    await fetchHistory();
    setShowSettlementHistory(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center, { backgroundColor: t.colors.background.primary }]} edges={['top']}>
        <ActivityIndicator size="large" color={t.brand.magenta} />
      </SafeAreaView>
    );
  }

  const me = members.find((m) => m.user_id === user?.id);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.colors.background.primary }]} edges={['top']}>
      {/* Header */}
      <View style={s.groupHeader}>
        {(group as any)?.avatar_url ? (
          <Image source={{ uri: (group as any).avatar_url }} style={s.headerAvatar} />
        ) : (
          <View style={[s.headerAvatar, { backgroundColor: t.colors.surface.overlay }]}>
            <Text style={{ color: t.colors.text.secondary, ...t.typography.bodyMedium }}>
              {group?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <Text style={[s.headerTitle, { color: t.colors.text.primary }]}>{group?.name ?? ''}</Text>
      </View>

      <ScrollView>
        {/* Confirmation toast */}
        {showConfirmation && (
          <View style={s.toast}>
            <Text style={s.toastIcon}>{confirmationText.includes('Gekopieerd') ? '\u2705' : '\u2728'}</Text>
            <Text style={s.toastText}>{confirmationText}</Text>
          </View>
        )}

        {/* Active toggle */}
        <View style={s.section}>
          <Pressable
            style={[
              s.activeToggle,
              {
                backgroundColor: me?.is_active ? t.brand.cyan + '20' : t.colors.surface.overlay,
              },
            ]}
            onPress={toggleActive}
          >
            <View style={[
              s.activeDotLarge,
              { backgroundColor: me?.is_active ? t.brand.cyan : t.colors.text.tertiary },
            ]} />
            <Text style={[s.activeText, { color: me?.is_active ? t.brand.cyan : t.colors.text.tertiary }]}>
              {me?.is_active ? 'Aanwezig' : 'Afwezig'}
            </Text>
          </Pressable>
        </View>

        {/* Invite code */}
        {group && (
          <Pressable
            style={s.inviteBar}
            onPress={async () => {
              await Clipboard.setStringAsync(group.invite_code);
              setConfirmationText('Gekopieerd!');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowConfirmation(true);
              setTimeout(() => setShowConfirmation(false), 1500);
            }}
          >
            <Text style={[s.inviteLabel, { color: t.colors.text.tertiary }]}>Uitnodigingscode:</Text>
            <Text style={[s.inviteCode, { color: t.colors.text.primary }]}>{group.invite_code}</Text>
            <View style={{ flexDirection: 'row', gap: t.space[3], marginTop: t.space[1] }}>
              <Text style={{ color: t.colors.text.tertiary, ...t.typography.overline }}>tap om te kopiëren</Text>
              <Pressable
                onPress={async (e) => {
                  e.stopPropagation();
                  await Share.share({ message: `Join mijn groep "${group.name}" op Streeps! Code: ${group.invite_code}` });
                }}
              >
                <Text style={{ color: t.colors.tint, ...t.typography.overline }}>delen</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* Category selection */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.colors.text.tertiary }]}>
            KIES CATEGORIE
          </Text>
          <View style={s.categoryGrid}>
            {activeCategories.map((cat) => {
              const catColor = t.categoryColors[(cat - 1) % 4];
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    s.categoryCard,
                    {
                      backgroundColor: isSelected
                        ? catColor + '18'
                        : t.colors.surface.raised,
                      borderLeftColor: catColor,
                      borderLeftWidth: 3,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[s.categoryLabel, { color: catColor }]}>
                    {getCategoryName(cat)}
                  </Text>
                  <Text style={[s.categoryPrice, { color: t.colors.text.primary }]}>
                    {'\u20AC'} {(getCategoryPrice(cat) / 100).toFixed(2).replace('.', ',')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Add tally button */}
        <Pressable
          style={[
            s.addButton,
            {
              backgroundColor: selectedCategory ? t.brand.magenta : t.colors.surface.overlay,
              ...(selectedCategory ? t.glows.magenta : {}),
            },
          ]}
          onPress={handleAddTally}
          disabled={!selectedCategory || adding}
        >
          <Text style={[
            s.addButtonText,
            { color: selectedCategory ? '#fff' : t.colors.text.tertiary },
          ]}>
            {adding ? 'Even wachten...' : 'Streepje zetten!'}
          </Text>
        </Pressable>

        {/* Drink list button */}
        <Pressable
          style={{ alignItems: 'center', marginBottom: t.space[2] }}
          onPress={() => setShowDrinkList(true)}
        >
          <Text style={{ color: t.colors.tint, ...t.typography.bodySm }}>Bekijk drankjeslijst</Text>
        </Pressable>

        {/* Members — tap to open detail */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.colors.text.tertiary }]}>
            LEDEN
          </Text>
          <View style={s.membersCard}>
            {members.map((member, index) => {
              const name = member.user_id === user?.id ? 'Jij' : (member.profile?.full_name || 'Onbekend');
              const avatarUrl = member.profile?.avatar_url;
              return (
                <React.Fragment key={member.id}>
                  {index > 0 && <View style={s.memberDivider} />}
                  <Pressable
                    style={s.memberRow}
                    onPress={() => setSelectedMemberId(member.user_id)}
                  >
                    <View style={s.avatarContainer}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={s.memberAvatar} />
                      ) : (
                        <View style={[s.memberAvatar, { backgroundColor: t.colors.surface.overlay }]}>
                          <Text style={{ color: t.colors.text.secondary, ...t.typography.bodySm, fontWeight: t.fontWeights.semibold }}>
                            {name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {member.is_active && (
                        <View style={s.statusBadge}>
                          <View style={s.statusDot} />
                        </View>
                      )}
                    </View>
                    <Text style={[s.memberName, { color: t.colors.text.primary }]}>
                      {name}
                      {member.is_admin && ' (admin)'}
                    </Text>
                    <View style={s.memberTallies}>
                      <Text style={[s.memberTallyCount, { color: t.colors.text.primary }]}>
                        {tallyCounts[member.user_id] ?? 0}
                      </Text>
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Admin actions */}
        {isAdmin && (
          <View style={s.section}>
            <Pressable
              style={[s.adminPillButton, { backgroundColor: t.brand.cyan }]}
              onPress={handleOpenSettlement}
              disabled={settling}
            >
              <Text style={[s.adminPillButtonText, { color: t.colors.text.inverse }]}>
                {settling ? 'Bezig...' : 'Afrekenen'}
              </Text>
            </Pressable>
            <Pressable
              style={[s.adminGhostButton]}
              onPress={handleOpenHistory}
            >
              <Text style={[s.adminGhostButtonText, { color: t.colors.text.secondary }]}>
                Afrekening historie
              </Text>
            </Pressable>
            <Pressable
              style={[s.adminGhostButton]}
              onPress={() => router.push(`/groups/settings?id=${id}` as any)}
            >
              <Text style={[s.adminGhostButtonText, { color: t.colors.text.secondary }]}>
                Groep instellingen
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: t.space[10] }} />
      </ScrollView>

      {/* Drink list modal */}
      <Modal visible={showDrinkList} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowDrinkList(false)}>
          <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: t.colors.text.primary }]}>Drankjeslijst</Text>
            {drinks.length === 0 && (
              <Text style={{ color: t.colors.text.secondary }}>Geen drankjes toegevoegd</Text>
            )}
            {drinks.map((drink) => {
              const catColor = t.categoryColors[(drink.category - 1) % 4];
              return (
                <View
                  key={drink.id}
                  style={s.drinkRow}
                >
                  <Text style={{ fontSize: 20, marginRight: t.space[3] }}>{drink.emoji ?? '\uD83C\uDF7A'}</Text>
                  <Text style={{ color: t.colors.text.primary, flex: 1, ...t.typography.body }}>{drink.name}</Text>
                  <View style={[s.catBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={{ color: catColor, ...t.typography.caption }}>
                      cat. {drink.category}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tally count modal */}
      <Modal visible={showTallyCount} transparent animationType="fade">
        <View style={s.centeredOverlay}>
          <View style={s.tallyCountModal}>
            <Text style={[s.modalTitle, { color: t.colors.text.primary, textAlign: 'center' }]}>
              Hoeveel streepjes?
            </Text>
            {selectedCategory && (
              <Text style={{ color: t.categoryColors[(selectedCategory - 1) % 4], textAlign: 'center', marginBottom: t.space[4], ...t.typography.bodyMedium }}>
                {getCategoryName(selectedCategory)}
              </Text>
            )}
            <View style={s.counterRow}>
              <Pressable
                style={[s.counterBtn, { backgroundColor: t.semantic.errorBg }]}
                onPress={() => {
                  if (tallyCount <= 1) {
                    setShowTallyCount(false);
                  } else {
                    setTallyCount((c) => c - 1);
                  }
                }}
              >
                <Text style={{ color: t.semantic.error, ...t.typography.heading2 }}>{'\u2212'}</Text>
              </Pressable>
              <Text style={[s.counterValue, { color: t.colors.text.primary }]}>{tallyCount}</Text>
              <Pressable
                style={[s.counterBtn, { backgroundColor: t.brand.cyan + '20' }]}
                onPress={() => setTallyCount((c) => Math.min(c + 1, 99))}
              >
                <Text style={{ color: t.brand.cyan, ...t.typography.heading2 }}>+</Text>
              </Pressable>
            </View>
            <Pressable
              style={[s.acceptBtn, { backgroundColor: t.brand.magenta, ...t.glows.magenta }]}
              onPress={handleConfirmTally}
            >
              <Text style={{ color: '#fff', ...t.typography.bodyMedium }}>Accepteren</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Member detail modal */}
      <Modal visible={!!selectedMemberData} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setSelectedMemberId(null)}>
          <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            {selectedMemberData && (
              <ScrollView style={{ maxHeight: 500 }}>
                <Text style={[s.modalTitle, { color: t.colors.text.primary }]}>
                  {selectedMemberData.member.user_id === user?.id
                    ? 'Jij'
                    : (selectedMemberData.member.profile?.full_name || 'Onbekend')}
                  {selectedMemberData.member.is_admin && ' (admin)'}
                </Text>

                {/* Tally counts per category with remove button */}
                <Text style={[s.sectionTitle, { color: t.colors.text.tertiary }]}>STREEPJES</Text>
                {activeCategories.map((cat) => {
                  const count = selectedMemberData.categoryCounts[cat] || 0;
                  const isRemoving = removeCategory === cat;
                  const catColor = t.categoryColors[(cat - 1) % 4];
                  return (
                    <View key={cat} style={{ marginBottom: t.space[2] }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.catDot, { backgroundColor: catColor }]} />
                        <Text style={{ color: catColor, flex: 1, ...t.typography.body }}>
                          {getCategoryName(cat)}
                        </Text>
                        <Text style={{ color: t.colors.text.primary, fontWeight: t.fontWeights.semibold, marginRight: t.space[3] }}>{count}</Text>
                        {isAdmin && count > 0 && !isRemoving && (
                          <Pressable
                            onPress={() => handleStartRemove(cat, count)}
                            style={{ padding: t.space[1] }}
                          >
                            <Text style={{ color: t.semantic.error, ...t.typography.caption }}>verwijder</Text>
                          </Pressable>
                        )}
                      </View>
                      {isRemoving && (
                        <View style={s.removePanel}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space[4] }}>
                            <Pressable
                              style={[s.counterBtnSmall, { backgroundColor: t.semantic.errorBg }]}
                              onPress={() => {
                                if (removeCount <= 1) {
                                  setRemoveCategory(null);
                                } else {
                                  setRemoveCount((c) => c - 1);
                                }
                              }}
                            >
                              <Text style={{ color: t.semantic.error, ...t.typography.heading3 }}>{'\u2212'}</Text>
                            </Pressable>
                            <Text style={{ color: t.colors.text.primary, ...t.typography.tallySm, minWidth: 40, textAlign: 'center' }}>
                              {removeCount}
                            </Text>
                            <Pressable
                              style={[s.counterBtnSmall, { backgroundColor: t.brand.cyan + '20' }]}
                              onPress={() => setRemoveCount((c) => Math.min(c + 1, removableTallies.length))}
                            >
                              <Text style={{ color: t.brand.cyan, ...t.typography.heading3 }}>+</Text>
                            </Pressable>
                          </View>
                          <Pressable
                            style={s.removeConfirmBtn}
                            onPress={handleConfirmRemove}
                          >
                            <Text style={{ color: '#fff', fontWeight: t.fontWeights.semibold }}>Verwijderen</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Tally history */}
                <Text style={[s.sectionTitle, { color: t.colors.text.tertiary, marginTop: t.space[4] }]}>GESCHIEDENIS</Text>
                {selectedMemberData.tallies.length === 0 && (
                  <Text style={{ color: t.colors.text.secondary }}>Geen streepjes</Text>
                )}
                <View style={s.historyCard}>
                  {selectedMemberData.tallies.map((tally, index) => {
                    const cat = (tally as any).category ?? 1;
                    const catColor = t.categoryColors[(cat - 1) % 4];
                    return (
                      <React.Fragment key={tally.id}>
                        {index > 0 && <View style={s.memberDivider} />}
                        <View style={s.historyRow}>
                          <View style={[s.catDot, { backgroundColor: catColor }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: t.colors.text.primary, ...t.typography.bodySm }}>{getCategoryName(cat)}</Text>
                            <Text style={{ color: t.colors.text.tertiary, ...t.typography.caption }}>{formatTimeAgo(tally.created_at)}</Text>
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* Admin actions */}
                {isAdmin && selectedMemberData.member.user_id !== user?.id && (
                  <View style={{ flexDirection: 'row', gap: t.space[2], marginTop: t.space[4] }}>
                    <Pressable
                      style={[s.adminActionBtn, { backgroundColor: t.brand.cyan + '20' }]}
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
                      <Text style={{ color: t.brand.cyan, fontWeight: t.fontWeights.semibold }}>
                        {selectedMemberData.member.is_admin ? 'Admin verwijderen' : 'Admin maken'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[s.adminActionBtn, { backgroundColor: t.semantic.errorBg }]}
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
                      <Text style={{ color: t.semantic.error, fontWeight: t.fontWeights.semibold }}>Verwijderen</Text>
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
          <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={[s.modalTitle, { color: t.colors.text.primary }]}>Afrekenen</Text>

              {/* Select all */}
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: t.space[3] }}
                onPress={toggleAllSettlement}
              >
                <View style={[s.checkbox, selectedForSettlement.size === unsettledMembers.length && s.checkboxChecked]} />
                <Text style={{ color: t.colors.text.primary, fontWeight: t.fontWeights.semibold }}>Selecteer alles</Text>
              </Pressable>

              {/* Per member */}
              {unsettledMembers.map((member) => {
                const selected = selectedForSettlement.has(member.user_id);
                return (
                  <Pressable
                    key={member.user_id}
                    style={[s.settlementRow, { borderColor: selected ? t.brand.cyan : t.colors.border.default }]}
                    onPress={() => toggleSettlementMember(member.user_id)}
                  >
                    <View style={[s.checkbox, selected && s.checkboxChecked]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.colors.text.primary, fontWeight: t.fontWeights.semibold }}>
                        {member.user_id === user?.id ? 'Jij' : member.full_name}
                      </Text>
                      {activeCategories.map((cat) => {
                        const count = member.counts[cat] || 0;
                        if (count === 0) return null;
                        return (
                          <Text key={cat} style={{ color: t.colors.text.secondary, ...t.typography.caption }}>
                            {getCategoryName(cat)}: {count}x
                          </Text>
                        );
                      })}
                    </View>
                    <Text style={{ ...t.typography.body, color: t.brand.cyan, fontWeight: t.fontWeights.bold }}>
                      {'\u20AC'} {(member.amount / 100).toFixed(2).replace('.', ',')}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[3], paddingHorizontal: t.space[1] }}>
                <Text style={{ ...t.typography.body, color: t.colors.text.primary, fontWeight: t.fontWeights.bold }}>Totaal</Text>
                <Text style={{ ...t.typography.body, color: t.brand.cyan, fontWeight: t.fontWeights.bold }}>
                  {'\u20AC'} {(unsettledMembers
                    .filter((m) => selectedForSettlement.has(m.user_id))
                    .reduce((sum, m) => sum + m.amount, 0) / 100
                  ).toFixed(2).replace('.', ',')}
                </Text>
              </View>

              {/* Confirm */}
              <Pressable
                style={[s.settlementConfirmBtn, { backgroundColor: t.brand.cyan }]}
                onPress={handleConfirmSettlement}
                disabled={settling || selectedForSettlement.size === 0}
              >
                <Text style={[s.addButtonText, { color: t.colors.text.inverse }]}>
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
          <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={[s.modalTitle, { color: t.colors.text.primary }]}>Afrekening historie</Text>
              {history.length === 0 && (
                <Text style={{ color: t.colors.text.secondary }}>Nog geen afrekeningen</Text>
              )}
              {history.map((settlement) => (
                <View
                  key={settlement.id}
                  style={s.settlementRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.text.primary, fontWeight: t.fontWeights.semibold }}>
                      {formatTimeAgo(settlement.created_at)}
                    </Text>
                    {settlement.lines.map((line) => (
                      <Text key={line.user_id} style={{ color: t.colors.text.secondary, ...t.typography.caption }}>
                        {line.full_name}: {'\u20AC'} {(line.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ ...t.typography.body, color: t.brand.cyan, fontWeight: t.fontWeights.bold }}>
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

function createStyles(t: Theme, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.layout.screenPaddingH,
      paddingVertical: t.space[3],
      gap: t.space[3],
    },
    headerAvatar: {
      width: t.components.avatar.sm.size,
      height: t.components.avatar.sm.size,
      borderRadius: t.components.avatar.sm.size / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...t.typography.heading2,
    },
    section: {
      paddingHorizontal: t.layout.screenPaddingH,
      paddingBottom: 0,
      marginBottom: t.space[4],
    },
    sectionTitle: {
      ...t.typography.overline,
      marginBottom: t.space[3],
    },
    activeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: t.space[3],
      paddingHorizontal: t.space[5],
      borderRadius: t.radius.full,
    },
    activeDotLarge: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: t.space[2],
    },
    activeText: {
      ...t.typography.bodyMedium,
    },
    inviteBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: t.layout.screenPaddingH,
      marginTop: t.space[2],
      marginBottom: t.space[4],
      padding: t.space[3],
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface.raised,
      gap: t.space[2],
      ...t.shadows.sm,
    },
    inviteLabel: {
      ...t.typography.caption,
    },
    inviteCode: {
      ...t.typography.bodyMedium,
      fontWeight: t.fontWeights.bold,
      letterSpacing: 2,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.space[3],
    },
    categoryCard: {
      flex: 1,
      minWidth: '40%',
      alignItems: 'center',
      padding: t.space[4],
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      ...t.shadows.sm,
    },
    categoryLabel: {
      ...t.typography.bodyMedium,
      fontWeight: t.fontWeights.bold,
    },
    categoryPrice: {
      ...t.typography.bodySm,
      marginTop: t.space[1],
    },
    addButton: {
      marginHorizontal: t.layout.screenPaddingH,
      marginBottom: t.space[3],
      height: 56,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: {
      ...t.typography.heading3,
      fontWeight: t.fontWeights.bold,
    },
    membersCard: {
      backgroundColor: t.colors.surface.raised,
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      ...t.shadows.sm,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[3],
    },
    memberDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border.default,
      marginLeft: t.space[4] + t.components.avatar.sm.size + t.space[3],
    },
    avatarContainer: {
      position: 'relative',
      marginRight: t.space[3],
    },
    memberAvatar: {
      width: t.components.avatar.sm.size,
      height: t.components.avatar.sm.size,
      borderRadius: t.components.avatar.sm.size / 2,
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
      backgroundColor: t.colors.surface.raised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: t.brand.green,
    },
    catDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: t.space[3],
    },
    catBadge: {
      paddingHorizontal: t.space[2],
      paddingVertical: t.space[1],
      borderRadius: t.radius.sm,
    },
    memberName: {
      flex: 1,
      ...t.typography.body,
    },
    memberTallies: {
      backgroundColor: t.colors.surface.overlay,
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[1],
      borderRadius: t.radius.sm,
    },
    memberTallyCount: {
      ...t.typography.bodyMedium,
      fontWeight: t.fontWeights.semibold,
    },
    toast: {
      position: 'absolute',
      bottom: t.space[4],
      left: t.layout.screenPaddingH,
      right: t.layout.screenPaddingH,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space[2],
      paddingVertical: t.space[3],
      paddingHorizontal: t.space[4],
      borderRadius: t.radius.md,
      backgroundColor: t.brand.cyan,
      zIndex: t.zIndex.toast,
      ...t.shadows.md,
    },
    toastIcon: {
      fontSize: 18,
    },
    toastText: {
      color: t.colors.text.inverse,
      ...t.typography.bodyMedium,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: t.colors.scrim,
    },
    modalContent: {
      backgroundColor: t.colors.surface.raised,
      padding: t.components.modal.padding,
      borderTopLeftRadius: t.components.modal.borderRadius,
      borderTopRightRadius: t.components.modal.borderRadius,
    },
    modalHandle: {
      width: t.components.modal.handleWidth,
      height: t.components.modal.handleHeight,
      borderRadius: t.components.modal.handleHeight / 2,
      backgroundColor: t.colors.border.strong,
      alignSelf: 'center',
      marginBottom: t.space[4],
    },
    modalTitle: {
      ...t.typography.heading2,
      marginBottom: t.space[4],
    },
    drinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: t.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.default,
    },
    counterBtnSmall: {
      width: 40,
      height: 40,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: t.radius.xs,
      borderWidth: 2,
      borderColor: t.colors.text.tertiary,
      marginRight: t.space[3],
    },
    checkboxChecked: {
      backgroundColor: t.brand.cyan,
      borderColor: t.brand.cyan,
    },
    settlementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: t.space[3],
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border.default,
      backgroundColor: t.colors.surface.default,
      marginBottom: t.space[2],
    },
    settlementConfirmBtn: {
      height: 56,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: t.space[4],
    },
    adminPillButton: {
      height: 52,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.space[2],
      ...t.shadows.sm,
    },
    adminPillButtonText: {
      ...t.typography.bodyMedium,
      fontWeight: t.fontWeights.bold,
    },
    adminGhostButton: {
      height: 48,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.space[2],
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: t.colors.border.default,
    },
    adminGhostButtonText: {
      ...t.typography.bodyMedium,
    },
    adminActionBtn: {
      flex: 1,
      padding: t.space[3],
      borderRadius: t.radius.full,
      alignItems: 'center',
    },
    centeredOverlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: t.colors.scrim,
    },
    tallyCountModal: {
      marginHorizontal: t.space[10],
      padding: t.space[6],
      borderRadius: t.components.modal.borderRadius,
      backgroundColor: t.colors.surface.raised,
      ...t.shadows.lg,
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space[6],
      marginBottom: t.space[5],
    },
    counterBtn: {
      width: 56,
      height: 56,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterValue: {
      ...t.typography.tally,
      minWidth: 60,
      textAlign: 'center',
    },
    acceptBtn: {
      height: 52,
      borderRadius: t.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removePanel: {
      marginTop: t.space[2],
      padding: t.space[3],
      backgroundColor: t.colors.surface.default,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border.default,
    },
    removeConfirmBtn: {
      backgroundColor: t.semantic.error,
      padding: t.space[3],
      borderRadius: t.radius.full,
      alignItems: 'center',
      marginTop: t.space[2],
    },
    historyCard: {
      backgroundColor: t.colors.surface.raised,
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      ...t.shadows.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[3],
    },
  });
}
