import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Platform,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import CameraModal from '@/src/components/CameraModal';
import * as Haptics from 'expo-haptics';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t, mode), [mode]);
  const { user } = useAuth();
  const {
    group, drinks, isAdmin,
    updateGroupPrices, addDrink, removeDrink, updateGroupName,
    deleteGroup, leaveGroup, removeOwnAdmin, regenerateInviteCode, refresh,
  } = useGroupDetail(id);

  const [groupName, setGroupName] = useState('');
  const [price1, setPrice1] = useState('');
  const [price2, setPrice2] = useState('');
  const [price3, setPrice3] = useState('');
  const [price4, setPrice4] = useState('');
  const [catName1, setCatName1] = useState('Categorie 1');
  const [catName2, setCatName2] = useState('Categorie 2');
  const [catName3, setCatName3] = useState('Categorie 3');
  const [catName4, setCatName4] = useState('Categorie 4');
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkEmoji, setNewDrinkEmoji] = useState('');
  const [newDrinkCategory, setNewDrinkCategory] = useState('1');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const pickerRef = useRef<View>(null);

  useEffect(() => {
    if (group) {
      setGroupName(group.name);
      setGroupAvatarUrl((group as any).avatar_url ?? null);
      setPrice1(String(group.price_category_1));
      setPrice2(String(group.price_category_2));
      setPrice3(group.price_category_3 ? String(group.price_category_3) : '');
      setPrice4(group.price_category_4 ? String(group.price_category_4) : '');
      setCatName1(group.name_category_1 || 'Categorie 1');
      setCatName2(group.name_category_2 || 'Categorie 2');
      setCatName3(group.name_category_3 || 'Categorie 3');
      setCatName4(group.name_category_4 || 'Categorie 4');
    }
  }, [group]);

  const handleSaveAll = async () => {
    if (isAdmin) {
      await updateGroupPrices({
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
    }
    router.back();
  };

  const handleAddDrink = async () => {
    if (!newDrinkName.trim()) return;
    await addDrink(newDrinkName.trim(), parseInt(newDrinkCategory) || 1, newDrinkEmoji || '🍺');
    setNewDrinkName('');
    setNewDrinkEmoji('');
    setNewDrinkCategory('1');
  };

  const handleRemoveDrink = (drinkId: string, name: string) => {
    Alert.alert('Drankje verwijderen', `${name} verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => removeDrink(drinkId) },
    ]);
  };

  const handleRegenerateCode = () => {
    Alert.alert('Nieuwe uitnodigingscode', 'De huidige code werkt dan niet meer. Doorgaan?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Vernieuwen', onPress: async () => { await regenerateInviteCode(); Alert.alert('Code vernieuwd!'); } },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Weet je zeker dat je de groep wilt verwijderen?', 'Alle leden, streepjes gaan verloren.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: async () => { await deleteGroup(); router.replace('/(tabs)/home' as any); } },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Groep verlaten', 'Weet je zeker dat je deze groep wilt verlaten?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verlaten', style: 'destructive', onPress: async () => { await leaveGroup(); router.replace('/(tabs)/home' as any); } },
    ]);
  };

  const handleRemoveAdmin = () => {
    Alert.alert('Admin afstaan', 'Weet je zeker dat je je admin-rechten wilt afstaan?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Afstaan', style: 'destructive', onPress: async () => { await removeOwnAdmin(); refresh(); } },
    ]);
  };

  const handleOpenCamera = () => setCameraVisible(true);

  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    setUploadingGroupAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `groups/${id}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (uploadError) { Alert.alert('Upload mislukt', uploadError.message); setUploadingGroupAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', id);
    setGroupAvatarUrl(publicUrl);
    setUploadingGroupAvatar(false);
  };

  const categories = [
    { name: catName1, setName: setCatName1, price: price1, setPrice: setPrice1 },
    { name: catName2, setName: setCatName2, price: price2, setPrice: setPrice2 },
    { name: catName3, setName: setCatName3, price: price3, setPrice: setPrice3 },
    { name: catName4, setName: setCatName4, price: price4, setPrice: setPrice4 },
  ];

  const categoryNames = [catName1, catName2, catName3, catName4];

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5,
      onPanResponderGrant: () => {
        setScrubbing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (evt) => {
        if (!pickerRef.current) return;
        pickerRef.current.measure((_x, _y, width, _height, pageX, _pageY) => {
          const relX = evt.nativeEvent.pageX - pageX;
          const dotIndex = Math.floor((relX / width) * 4);
          const clamped = Math.max(0, Math.min(3, dotIndex));
          const newCat = String(clamped + 1);
          setNewDrinkCategory(prev => {
            if (prev !== newCat) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            return newCat;
          });
        });
      },
      onPanResponderRelease: () => {
        setScrubbing(false);
      },
      onPanResponderTerminate: () => {
        setScrubbing(false);
      },
    }),
  []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={t.colors.text.secondary} />
        </Pressable>
        <Text style={s.headerTitle}>Instellingen</Text>
        {isAdmin && (
          <Pressable onPress={handleSaveAll} style={s.saveBtn}>
            <Text style={s.saveBtnText}>Opslaan</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} scrollEnabled={!scrubbing}>
        {/* Group avatar */}
        {isAdmin && (
          <Pressable style={s.avatarSection} onPress={handleOpenCamera} disabled={uploadingGroupAvatar}>
            {groupAvatarUrl ? (
              <Image source={{ uri: groupAvatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarLetter}>{group?.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <Text style={s.avatarAction}>
              {uploadingGroupAvatar ? 'Uploaden...' : 'Groepsfoto wijzigen'}
            </Text>
          </Pressable>
        )}

        {/* Group name */}
        {isAdmin && (
          <>
            <Text style={s.sectionHeader}>GROEPSNAAM</Text>
            <View style={s.card}>
              <View style={s.inputRow}>
                <Ionicons name="people-outline" size={20} color={t.colors.text.tertiary} style={s.inputIcon} />
                <TextInput
                  style={s.inputText}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Groepsnaam"
                  placeholderTextColor={t.colors.text.tertiary}
                />
              </View>
            </View>
          </>
        )}

        {/* Categories */}
        {isAdmin && (
          <>
            <Text style={s.sectionHeader}>CATEGORIEËN</Text>
            <View style={s.card}>
              {categories.map(({ name, setName, price, setPrice }, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.catRow}>
                    <View style={[s.catDot, { backgroundColor: t.categoryColors[i] }]} />
                    <TextInput
                      style={s.catNameInput}
                      value={name}
                      onChangeText={setName}
                      placeholder={`Categorie ${i + 1}`}
                      placeholderTextColor={t.colors.text.tertiary}
                    />
                    <TextInput
                      style={s.catPriceInput}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="numeric"
                      placeholder="ct"
                      placeholderTextColor={t.colors.text.tertiary}
                    />
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Current drinks */}
        <Text style={s.sectionHeader}>DE KAART</Text>
        <View style={s.card}>
          {drinks.length === 0 && (
            <View style={s.emptyRow}>
              <Text style={s.emptyText}>Geen drankjes</Text>
            </View>
          )}
          {drinks.map((drink, i) => (
            <React.Fragment key={drink.id}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.drinkRow}>
                <Text style={s.drinkEmoji}>{drink.emoji ?? '🍺'}</Text>
                <Text style={s.drinkName}>{drink.name}</Text>
                <View style={[s.catBadge, { backgroundColor: t.categoryColors[(drink.category - 1) % 4] + '33' }]}>
                  <Text style={[s.catBadgeText, { color: t.categoryColors[(drink.category - 1) % 4] }]}>
                    {categoryNames[(drink.category - 1) % 4]}
                  </Text>
                </View>
                {isAdmin && (
                  <Pressable onPress={() => handleRemoveDrink(drink.id, drink.name)} style={s.removeBtn}>
                    <Ionicons name="close" size={16} color={t.semantic.error} />
                  </Pressable>
                )}
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Add drink */}
        {isAdmin && (
          <>
            <Text style={s.sectionHeader}>DRANKJE TOEVOEGEN</Text>
            <View style={s.card}>
              <View style={s.inputRow}>
                <Ionicons name="beer-outline" size={20} color={t.colors.text.tertiary} style={s.inputIcon} />
                <TextInput
                  style={s.inputText}
                  placeholder="Naam"
                  placeholderTextColor={t.colors.text.tertiary}
                  value={newDrinkName}
                  onChangeText={setNewDrinkName}
                />
              </View>
              <View style={s.divider} />
              <View style={s.inputRow}>
                <TextInput
                  style={[s.inputText, { flex: 1 }]}
                  placeholder="Emoji"
                  placeholderTextColor={t.colors.text.tertiary}
                  value={newDrinkEmoji}
                  onChangeText={setNewDrinkEmoji}
                />
              </View>
              <View style={s.divider} />
              <View
                ref={pickerRef}
                style={s.categoryPickerRow}
                {...panResponder.panHandlers}
              >
                <Text style={s.categoryPickerLabel}>Categorie</Text>
                <View style={s.categoryPickerDots}>
                  {[1, 2, 3, 4].map((cat) => {
                    const isSelected = newDrinkCategory === String(cat);
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          setNewDrinkCategory(String(cat));
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        hitSlop={8}
                        style={[
                          s.categoryPickerDot,
                          {
                            backgroundColor: t.categoryColors[cat - 1],
                            opacity: isSelected ? 1 : 0.4,
                            transform: [{ scale: isSelected ? 1.2 : 1 }],
                          },
                          isSelected && {
                            borderWidth: 2,
                            borderColor: '#fff',
                          },
                          scrubbing && isSelected && {
                            transform: [{ scale: 1.4 }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            </View>
            <Pressable style={s.addBtn} onPress={handleAddDrink}>
              <Text style={s.addBtnText}>Toevoegen</Text>
            </Pressable>
          </>
        )}

        {/* Invite code */}
        {isAdmin && (
          <>
            <Text style={s.sectionHeader}>UITNODIGINGSCODE</Text>
            <View style={s.card}>
              <View style={s.inviteRow}>
                <Ionicons name="key-outline" size={20} color={t.colors.text.tertiary} style={s.inputIcon} />
                <Text style={s.inviteCode}>{group?.invite_code}</Text>
                <Pressable onPress={handleRegenerateCode}>
                  <Text style={s.refreshText}>Vernieuwen</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Danger zone */}
        <Text style={s.dangerHeader}>GEVARENZONE</Text>
        <View style={s.card}>
          {isAdmin && (
            <Pressable style={s.dangerRow} onPress={handleRemoveAdmin}>
              <Ionicons name="shield-outline" size={20} color={t.semantic.error} style={s.inputIcon} />
              <Text style={s.dangerText}>Admin afstaan</Text>
            </Pressable>
          )}
          {isAdmin && <View style={s.divider} />}
          <Pressable style={s.dangerRow} onPress={handleLeaveGroup}>
            <Ionicons name="exit-outline" size={20} color={t.semantic.error} style={s.inputIcon} />
            <Text style={s.dangerText}>Groep verlaten</Text>
          </Pressable>
          {isAdmin && (
            <>
              <View style={s.divider} />
              <Pressable style={s.dangerRow} onPress={handleDeleteGroup}>
                <Ionicons name="trash-outline" size={20} color={t.semantic.error} style={s.inputIcon} />
                <Text style={s.dangerText}>Groep verwijderen</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />

    </SafeAreaView>
  );
}

function createStyles(t: Theme, mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background.primary },
    content: { paddingBottom: 40 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...t.typography.heading2, color: t.colors.text.primary, flex: 1 },
    saveBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    saveBtnText: { ...t.typography.bodyMedium, color: t.colors.tint },

    // Avatar
    avatarSection: { alignItems: 'center', paddingVertical: 16 },
    avatar: { width: 80, height: 80, borderRadius: 9999 },
    avatarFallback: {
      backgroundColor: t.colors.surface.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: { fontSize: 28, fontWeight: '600', color: t.colors.text.secondary },
    avatarAction: { ...t.typography.caption, color: t.colors.tint, marginTop: 8 },

    // Section
    sectionHeader: {
      ...t.typography.overline,
      color: t.colors.text.tertiary,
      marginLeft: 28,
      marginTop: 24,
      marginBottom: 8,
    },
    dangerHeader: {
      ...t.typography.overline,
      color: t.semantic.error,
      marginLeft: 28,
      marginTop: 32,
      marginBottom: 8,
    },

    // Grouped card
    card: {
      backgroundColor: t.colors.surface.raised,
      borderRadius: t.radius.lg,
      marginHorizontal: 24,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: t.colors.border.default, marginLeft: 48 },

    // Input row
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 52,
    },
    inputIcon: { marginRight: 12, width: 20 },
    inputText: {
      flex: 1,
      ...t.typography.body,
      color: t.colors.text.primary,
      height: 52,
    },

    // Category row
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      height: 52,
    },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    catNameInput: {
      flex: 1,
      ...t.typography.body,
      color: t.colors.text.primary,
      height: 52,
    },
    catPriceInput: {
      width: 72,
      ...t.typography.body,
      color: t.colors.text.primary,
      textAlign: 'right',
      height: 52,
    },

    // Drinks
    drinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 52,
    },
    drinkEmoji: { fontSize: 20, marginRight: 12 },
    drinkName: { ...t.typography.body, color: t.colors.text.primary, flex: 1 },
    catBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 9999,
    },
    catBadgeText: { ...t.typography.caption, fontWeight: '600' },
    removeBtn: { padding: 8, marginLeft: 8 },
    emptyRow: { padding: 16 },
    emptyText: { ...t.typography.bodySm, color: t.colors.text.tertiary },

    // Add button
    addBtn: {
      marginHorizontal: 24,
      marginTop: 12,
      height: 48,
      backgroundColor: t.brand.magenta,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isDark
        ? Platform.select({ ios: { shadowColor: t.brand.magenta, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 4 }, default: {} })
        : {}
      ),
    },
    addBtnText: { color: '#FFFFFF', ...t.typography.bodyMedium },

    // Invite
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 52,
    },
    inviteCode: {
      ...t.typography.bodyMedium,
      color: t.colors.text.primary,
      flex: 1,
      letterSpacing: 2,
    },
    refreshText: { ...t.typography.bodySm, color: t.colors.tint },

    // Danger
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 52,
    },
    dangerText: { ...t.typography.body, color: t.semantic.error, flex: 1 },

    // Category picker (inline scrub)
    categoryPickerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    categoryPickerLabel: {
      color: '#fff',
      fontSize: 16,
    },
    categoryPickerDots: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    categoryPickerDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
  });
}
