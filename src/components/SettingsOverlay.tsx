import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Animated,
  Easing,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraModal from '@/src/components/CameraModal';
import { supabase } from '@/src/lib/supabase';
import type { Theme } from '@/src/theme';

interface Member {
  id: string;
  user_id: string;
  is_admin: boolean;
  is_active: boolean;
  profile?: { full_name?: string; avatar_url?: string | null } | null;
}

interface Drink {
  id: string;
  name: string;
  category: number;
  emoji: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  group: any;
  groupId: string;
  members: Member[];
  drinks: Drink[];
  currentUserId?: string;
  theme: Theme;
  categoryColors: readonly string[];
  updateGroupPrices: (data: Record<string, any>) => Promise<void>;
  updateGroupName: (name: string) => Promise<void>;
  addDrink: (name: string, category: number, emoji: string) => Promise<void>;
  removeDrink: (drinkId: string) => Promise<void>;
  toggleAdmin: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  regenerateInviteCode: () => Promise<void>;
  deleteGroup: () => Promise<void>;
  leaveGroup: () => Promise<void>;
  removeOwnAdmin: () => Promise<void>;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  // Tally management
  tallyCounts?: Record<string, Record<number, number>>;
  recentTallies?: any[];
  addTally?: (category: 1|2|3|4, userId?: string) => Promise<void>;
  removeTally?: (tallyId: string) => Promise<void>;
  activeCategories?: number[];
  getCategoryName?: (cat: number) => string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Drag-to-select category picker: hold the dot, drag up/down to pick 1–4 */
function CategoryDragPicker({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: readonly string[];
}) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setDragging(true);
        startY.current = 0;
        startVal.current = value;
      },
      onPanResponderMove: (_, gs) => {
        // Every 30px of drag = 1 category step, drag UP = higher number
        const steps = Math.round(-gs.dy / 30);
        const next = Math.max(1, Math.min(4, startVal.current + steps));
        if (next !== value) onChange(next);
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  // Update startVal ref when value changes externally
  useEffect(() => { startVal.current = value; }, [value]);

  return (
    <View style={cdp.wrap} {...pan.panHandlers}>
      {dragging ? (
        // Expanded: show all 4 dots vertically (4 at top, 1 at bottom)
        <View style={cdp.expanded}>
          {[4, 3, 2, 1].map((cat) => (
            <View
              key={cat}
              style={[
                cdp.dot,
                { backgroundColor: colors[(cat - 1) % 4] },
                cat === value && cdp.dotActive,
              ]}
            />
          ))}
        </View>
      ) : (
        // Collapsed: single dot with current color
        <View style={[cdp.dot, cdp.dotLarge, { backgroundColor: colors[(value - 1) % 4] }]} />
      )}
    </View>
  );
}

const cdp = StyleSheet.create({
  wrap: { width: 36, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  expanded: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, opacity: 0.4 },
  dotActive: { opacity: 1, width: 18, height: 18, borderRadius: 9 },
  dotLarge: { width: 18, height: 18, borderRadius: 9, opacity: 1 },
});

export default function SettingsOverlay({
  visible,
  onClose,
  group,
  groupId,
  members,
  drinks,
  currentUserId,
  theme: t,
  categoryColors,
  updateGroupPrices,
  updateGroupName,
  addDrink,
  removeDrink,
  toggleAdmin,
  removeMember,
  regenerateInviteCode,
  deleteGroup,
  leaveGroup,
  removeOwnAdmin,
  isAdmin,
  refresh,
  tallyCounts,
  recentTallies,
  addTally,
  removeTally,
  activeCategories = [1, 2],
  getCategoryName,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showOpen, setShowOpen] = useState(false);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [groupName, setGroupName] = useState('');
  const [catName1, setCatName1] = useState('');
  const [catName2, setCatName2] = useState('');
  const [catName3, setCatName3] = useState('');
  const [catName4, setCatName4] = useState('');
  const [price1, setPrice1] = useState('');
  const [price2, setPrice2] = useState('');
  const [price3, setPrice3] = useState('');
  const [price4, setPrice4] = useState('');
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkEmoji, setNewDrinkEmoji] = useState('');
  const [newDrinkCat, setNewDrinkCat] = useState('1');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [tallyAdj, setTallyAdj] = useState<Record<string, Record<number, number>>>({});

  // Reset optimistic adjustments when real data arrives
  useEffect(() => { setTallyAdj({}); }, [recentTallies]);

  const toggleExpandMember = useCallback((userId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));
    setExpandedMember((prev) => (prev === userId ? null : userId));
  }, []);

  // Init form when opened
  useEffect(() => {
    if (visible && group) {
      setGroupName(group.name);
      setGroupAvatarUrl(group.avatar_url ?? null);
      setPrice1(String(group.price_category_1));
      setPrice2(String(group.price_category_2));
      setPrice3(group.price_category_3 ? String(group.price_category_3) : '');
      setPrice4(group.price_category_4 ? String(group.price_category_4) : '');
      setCatName1(group.name_category_1 || 'Categorie 1');
      setCatName2(group.name_category_2 || 'Categorie 2');
      setCatName3(group.name_category_3 || 'Categorie 3');
      setCatName4(group.name_category_4 || 'Categorie 4');

      setShowOpen(true);
      scrimOpacity.setValue(0);
      contentAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 1, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setShowOpen(false);
      onClose();
    });
  }, [onClose]);

  const handleSave = () => {
    handleClose();
    updateGroupPrices({
      ...(groupName.trim() ? { name: groupName.trim() } : {}),
      price_category_1: parseInt(price1) || 150,
      price_category_2: parseInt(price2) || 300,
      price_category_3: price3 ? parseInt(price3) : null,
      price_category_4: price4 ? parseInt(price4) : null,
      name_category_1: catName1.trim() || 'Categorie 1',
      name_category_2: catName2.trim() || 'Categorie 2',
      name_category_3: catName3.trim() || 'Categorie 3',
      name_category_4: catName4.trim() || 'Categorie 4',
    });
  };

  const handleAddDrink = async () => {
    if (!newDrinkName.trim()) return;
    await addDrink(newDrinkName.trim(), parseInt(newDrinkCat) || 1, newDrinkEmoji || '🍺');
    setNewDrinkName('');
    setNewDrinkEmoji('');
    setNewDrinkCat('1');
  };

  const handleRemoveDrink = (id: string, name: string) => {
    Alert.alert('Drankje verwijderen', `${name} verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => removeDrink(id) },
    ]);
  };

  const handleToggleAdmin = (userId: string, name: string, isAdmin: boolean) => {
    Alert.alert(isAdmin ? 'Admin verwijderen' : 'Admin maken', `${name} ${isAdmin ? 'is dan geen admin meer' : 'wordt admin'}.`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Bevestigen', onPress: () => toggleAdmin(userId) },
    ]);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert('Lid verwijderen', `${name} uit de groep verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => removeMember(userId) },
    ]);
  };

  const handleRegenerateCode = () => {
    Alert.alert('Nieuwe uitnodigingscode', 'De huidige code werkt dan niet meer.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Vernieuwen', onPress: () => regenerateInviteCode() },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Groep verwijderen', 'Alle leden en streepjes gaan verloren.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: async () => {
        await deleteGroup();
        onClose();
      } },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Groep verlaten', 'Weet je zeker dat je deze groep wilt verlaten?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verlaten', style: 'destructive', onPress: async () => {
        await leaveGroup();
        onClose();
      } },
    ]);
  };

  const handleRemoveAdmin = () => {
    Alert.alert('Admin afstaan', 'Weet je zeker dat je je admin-rechten wilt afstaan?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Afstaan', style: 'destructive', onPress: async () => {
        await removeOwnAdmin();
        refresh();
      } },
    ]);
  };

  const handleOpenCamera = () => setCameraVisible(true);

  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    setUploadingAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `groups/${groupId}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (error) { Alert.alert('Upload mislukt', error.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', groupId);
    setGroupAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  const categories = [
    { name: catName1, setName: setCatName1, price: price1, setPrice: setPrice1 },
    { name: catName2, setName: setCatName2, price: price2, setPrice: setPrice2 },
    { name: catName3, setName: setCatName3, price: price3, setPrice: setPrice3 },
    { name: catName4, setName: setCatName4, price: price4, setPrice: setPrice4 },
  ];

  const contentStyle = {
    opacity: contentAnim,
    transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  if (!showOpen) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Frosted scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={s.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[s.container, { paddingTop: insets.top + 12 }, contentStyle]} pointerEvents="auto">
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle}>Instellingen</Text>
          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={s.saveText}>Opslaan</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Group avatar */}
          <Pressable style={s.avatarSection} onPress={handleOpenCamera} disabled={uploadingAvatar}>
            {groupAvatarUrl ? (
              <Image source={{ uri: groupAvatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>{group?.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <Text style={s.avatarAction}>{uploadingAvatar ? 'Uploaden...' : 'Groepsfoto wijzigen'}</Text>
          </Pressable>

          {/* Group name */}
          <Text style={s.sectionHeader}>GROEPSNAAM</Text>
          <View style={s.card}>
            <View style={s.inputRow}>
              <TextInput
                style={s.inputText}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Groepsnaam"
                placeholderTextColor="#848484"
              />
            </View>
          </View>

          {/* Categories */}
          <Text style={s.sectionHeader}>CATEGORIEËN</Text>
          <View style={s.card}>
            {categories.map(({ name, setName, price, setPrice }, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.catRow}>
                  <View style={[s.catDot, { backgroundColor: categoryColors[i] }]} />
                  <TextInput
                    style={s.catNameInput}
                    value={name}
                    onChangeText={setName}
                    placeholder={`Categorie ${i + 1}`}
                    placeholderTextColor="#848484"
                  />
                  <TextInput
                    style={s.catPriceInput}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    placeholder="ct"
                    placeholderTextColor="#848484"
                  />
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Drinks */}
          <Text style={s.sectionHeader}>DRANKJES</Text>
          <View style={s.card}>
            {drinks.length === 0 && (
              <Text style={s.emptyText}>Geen drankjes</Text>
            )}
            {drinks.map((drink, i) => (
              <React.Fragment key={drink.id}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.drinkRow}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{drink.emoji ?? '\uD83C\uDF7A'}</Text>
                  <Text style={s.drinkName}>{drink.name}</Text>
                  <Pressable onPress={() => handleRemoveDrink(drink.id, drink.name)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color="#EB5466" />
                  </Pressable>
                </View>
              </React.Fragment>
            ))}
            <View style={s.divider} />
            {/* Add drink inline */}
            <View style={s.addDrinkRow}>
              <TextInput style={s.addDrinkInput} placeholder="Naam" placeholderTextColor="#848484" value={newDrinkName} onChangeText={setNewDrinkName} />
              <TextInput style={s.addDrinkEmoji} placeholder={'🍺'} placeholderTextColor="#848484" value={newDrinkEmoji} onChangeText={setNewDrinkEmoji} />
              {/* Category drag picker: hold & drag up/down */}
              <CategoryDragPicker
                value={parseInt(newDrinkCat) || 1}
                onChange={(v) => setNewDrinkCat(String(v))}
                colors={categoryColors}
              />
              <Pressable onPress={handleAddDrink} style={s.addDrinkBtn}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Members */}
          <Text style={s.sectionHeader}>LEDEN</Text>
          <View style={s.card}>
            {members.map((member, i) => {
              const name = member.user_id === currentUserId ? 'Jij' : (member.profile?.full_name || 'Onbekend');
              const isSelf = member.user_id === currentUserId;
              const isExpanded = expandedMember === member.user_id;
              const memberTallies = tallyCounts?.[member.user_id] ?? {};
              return (
                <React.Fragment key={member.id}>
                  {i > 0 && <View style={s.divider} />}
                  <Pressable style={s.memberRow} onPress={() => toggleExpandMember(member.user_id)}>
                    {member.profile?.avatar_url ? (
                      <Image source={{ uri: member.profile.avatar_url }} style={s.memberAvatar} />
                    ) : (
                      <View style={[s.memberAvatar, s.memberAvatarFallback]}>
                        <Text style={s.memberAvatarText}>{name[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{name}</Text>
                      {member.is_admin && <Text style={s.adminBadge}>Admin</Text>}
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#848484" />
                  </Pressable>
                  {/* Expanded: tally counts + admin actions */}
                  {isExpanded && (
                    <View style={s.memberExpanded}>
                      {/* Tally counts per category */}
                      {activeCategories.map((cat) => {
                        const adj = tallyAdj[member.user_id]?.[cat] || 0;
                        const count = (memberTallies[cat] || 0) + adj;
                        const catColor = categoryColors[(cat - 1) % 4];
                        const catName = getCategoryName?.(cat) ?? `Cat ${cat}`;
                        return (
                          <View key={cat} style={s.tallyRow}>
                            <View style={[s.tallyDot, { backgroundColor: catColor }]} />
                            <Text style={s.tallyLabel}>{catName}</Text>
                            <Text style={s.tallyCount}>{count}</Text>
                            {addTally && (
                              <Pressable
                                onPress={() => {
                                  setTallyAdj((prev) => ({
                                    ...prev,
                                    [member.user_id]: { ...prev[member.user_id], [cat]: (prev[member.user_id]?.[cat] || 0) + 1 },
                                  }));
                                  addTally(cat as 1|2|3|4, member.user_id);
                                }}
                                style={s.tallyBtn}
                                hitSlop={4}
                              >
                                <Ionicons name="add" size={16} color="#00BEAE" />
                              </Pressable>
                            )}
                            {removeTally && count > 0 && (
                              <Pressable
                                onPress={() => {
                                  const memberRecentTallies = (recentTallies || []).filter(
                                    (t: any) => t.user_id === member.user_id && t.category === cat && !t.removed
                                  );
                                  if (memberRecentTallies.length > 0) {
                                    Alert.alert('Streepje verwijderen', `1x ${catName} van ${name}?`, [
                                      { text: 'Annuleren', style: 'cancel' },
                                      { text: 'Verwijderen', style: 'destructive', onPress: () => {
                                        setTallyAdj((prev) => ({
                                          ...prev,
                                          [member.user_id]: { ...prev[member.user_id], [cat]: (prev[member.user_id]?.[cat] || 0) - 1 },
                                        }));
                                        removeTally(memberRecentTallies[0].id);
                                      } },
                                    ]);
                                  }
                                }}
                                style={s.tallyBtn}
                                hitSlop={4}
                              >
                                <Ionicons name="remove" size={16} color="#EB5466" />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      {/* Admin actions */}
                      {!isSelf && (
                        <View style={s.memberActions}>
                          <Pressable onPress={() => handleToggleAdmin(member.user_id, name, member.is_admin)} style={s.memberActionBtn}>
                            <Ionicons name={member.is_admin ? 'shield' : 'shield-outline'} size={18} color="#00BEAE" />
                            <Text style={s.memberActionText}>{member.is_admin ? 'Admin verwijderen' : 'Admin maken'}</Text>
                          </Pressable>
                          <Pressable onPress={() => handleRemoveMember(member.user_id, name)} style={s.memberActionBtnDanger}>
                            <Ionicons name="person-remove-outline" size={18} color="#EB5466" />
                            <Text style={s.memberActionTextDanger}>Verwijderen</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Invite code */}
          <Text style={s.sectionHeader}>UITNODIGINGSCODE</Text>
          <View style={s.card}>
            <View style={s.inviteRow}>
              <Text style={s.inviteCode}>{group?.invite_code ?? '...'}</Text>
              <Pressable onPress={handleRegenerateCode} hitSlop={8}>
                <Text style={s.refreshText}>Vernieuwen</Text>
              </Pressable>
            </View>
          </View>

          {/* Danger zone */}
          <View style={[s.card, { marginTop: 24 }]}>
            {isAdmin && (
              <Pressable style={s.dangerRow} onPress={handleRemoveAdmin}>
                <Ionicons name="shield-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
                <Text style={s.dangerRowText}>Admin afstaan</Text>
              </Pressable>
            )}
            {isAdmin && <View style={s.divider} />}
            <Pressable style={s.dangerRow} onPress={handleLeaveGroup}>
              <Ionicons name="exit-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
              <Text style={s.dangerRowText}>Groep verlaten</Text>
            </Pressable>
            {isAdmin && (
              <>
                <View style={s.divider} />
                <Pressable style={s.dangerRow} onPress={handleDeleteGroup}>
                  <Ionicons name="trash-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
                  <Text style={s.dangerRowText}>Groep verwijderen</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  container: { flex: 1, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontFamily: 'Unbounded', fontSize: 24, fontWeight: '400', color: '#FFFFFF' },
  saveText: { fontFamily: 'Unbounded', fontSize: 14, fontWeight: '600', color: '#00BEAE' },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '600', color: '#333' },
  avatarAction: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE', marginTop: 8 },

  // Section
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 12, fontWeight: '400', color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },

  // Card
  card: { backgroundColor: 'rgba(78, 78, 78, 0.3)', borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginLeft: 16 },

  // Inputs
  inputRow: { paddingHorizontal: 20, minHeight: 52, justifyContent: 'center' },
  inputText: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', height: 52 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  catNameInput: { fontFamily: 'Unbounded', flex: 1, fontSize: 14, color: '#FFFFFF', height: 52 },
  catPriceInput: { fontFamily: 'Unbounded', width: 72, fontSize: 14, color: '#FFFFFF', textAlign: 'right', height: 52 },

  // Drinks
  drinkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50 },
  drinkName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', flex: 1 },
  emptyText: { fontFamily: 'Unbounded', color: '#848484', padding: 16, fontSize: 14 },
  addDrinkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, gap: 8 },
  addDrinkInput: { fontFamily: 'Unbounded', flex: 1, fontSize: 14, color: '#FFFFFF', height: 48 },
  addDrinkEmoji: { fontFamily: 'Unbounded', width: 48, fontSize: 14, color: '#FFFFFF', textAlign: 'center', height: 48 },
  addDrinkBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF004D', alignItems: 'center', justifyContent: 'center' },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  memberAvatarFallback: { backgroundColor: '#F1F1F1' },
  memberAvatarText: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  adminBadge: { fontFamily: 'Unbounded', fontSize: 11, color: '#00BEAE', marginTop: 1 },

  // Expanded member
  memberExpanded: { paddingHorizontal: 16, paddingBottom: 12 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tallyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  tallyLabel: { fontFamily: 'Unbounded', fontSize: 12, color: '#FFFFFF', flex: 1 },
  tallyCount: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginRight: 8, minWidth: 24, textAlign: 'right' },
  tallyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(78,78,78,0.4)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  memberActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,217,163,0.1)' },
  memberActionText: { fontFamily: 'Unbounded', fontSize: 11, color: '#00BEAE' },
  memberActionBtnDanger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 18, backgroundColor: 'rgba(235,84,102,0.1)' },
  memberActionTextDanger: { fontFamily: 'Unbounded', fontSize: 11, color: '#EB5466' },

  // Invite
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 52 },
  inviteCode: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', flex: 1, letterSpacing: 2 },
  refreshText: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE' },

  // Danger
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  dangerRowText: { fontFamily: 'Unbounded', fontSize: 14, color: '#EB5466', flex: 1 },
});
