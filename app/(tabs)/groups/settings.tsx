import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const {
    group,
    drinks,
    isAdmin,
    updateGroupPrices,
    addDrink,
    removeDrink,
    updateGroupName,
    deleteGroup,
    leaveGroup,
    regenerateInviteCode,
    refresh,
  } = useGroupDetail(id);

  const [groupName, setGroupName] = useState('');
  const [price1, setPrice1] = useState('');
  const [price2, setPrice2] = useState('');
  const [price3, setPrice3] = useState('');
  const [price4, setPrice4] = useState('');
  const [catName1, setCatName1] = useState('');
  const [catName2, setCatName2] = useState('');
  const [catName3, setCatName3] = useState('');
  const [catName4, setCatName4] = useState('');
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkEmoji, setNewDrinkEmoji] = useState('');
  const [newDrinkCategory, setNewDrinkCategory] = useState('1');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);

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
      if (groupName.trim()) await updateGroupName(groupName.trim());
      await updateGroupPrices({
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
    await refresh();
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
    Alert.alert(
      'Nieuwe uitnodigingscode',
      'De huidige code werkt dan niet meer. Doorgaan?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Vernieuwen',
          onPress: async () => {
            await regenerateInviteCode();
            Alert.alert('Code vernieuwd!');
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Weet je zeker dat je de groep wilt verwijderen?',
      'Alle leden, streepjes gaan verloren.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup();
            router.replace('/(tabs)/groups' as any);
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Groep verlaten',
      'Weet je zeker dat je deze groep wilt verlaten?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verlaten',
          style: 'destructive',
          onPress: async () => {
            await leaveGroup();
            router.replace('/(tabs)/groups' as any);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: Brand.cyan, fontSize: 16 }}>← Terug</Text>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity onPress={handleSaveAll}>
                <Text style={{ color: Brand.cyan, fontSize: 16, fontWeight: '600' }}>Opslaan</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Groep instellingen</Text>
        </View>

        {/* Group avatar */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.groupAvatarSection}
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
              });
              if (result.canceled || !result.assets[0]) return;

              setUploadingGroupAvatar(true);
              const asset = result.assets[0];
              const ext = asset.uri.split('.').pop() ?? 'jpg';
              const path = `groups/${id}/avatar.${ext}`;

              const response = await fetch(asset.uri);
              const blob = await response.blob();
              const arrayBuffer = await new Response(blob).arrayBuffer();

              const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, arrayBuffer, {
                  contentType: asset.mimeType ?? 'image/jpeg',
                  upsert: true,
                });

              if (uploadError) {
                Alert.alert('Upload mislukt', uploadError.message);
                setUploadingGroupAvatar(false);
                return;
              }

              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
              const publicUrl = urlData.publicUrl + '?t=' + Date.now();

              await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', id);
              setGroupAvatarUrl(publicUrl);
              setUploadingGroupAvatar(false);
            }}
            disabled={uploadingGroupAvatar}
          >
            {groupAvatarUrl ? (
              <Image source={{ uri: groupAvatarUrl }} style={styles.groupAvatarImg} />
            ) : (
              <View style={[styles.groupAvatarImg, { backgroundColor: colors.surfaceLight }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 28, fontWeight: '600' }}>
                  {group?.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <Text style={{ color: Brand.cyan, fontSize: 13, marginTop: 8 }}>
              {uploadingGroupAvatar ? 'Uploaden...' : 'Groepsfoto wijzigen'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Group name */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GROEPSNAAM</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>
        )}

        {/* Prices */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              CATEGORIEËN
            </Text>
            {[
              { name: catName1, setName: setCatName1, price: price1, setPrice: setPrice1 },
              { name: catName2, setName: setCatName2, price: price2, setPrice: setPrice2 },
              { name: catName3, setName: setCatName3, price: price3, setPrice: setPrice3 },
              { name: catName4, setName: setCatName4, price: price4, setPrice: setPrice4 },
            ].map(({ name, setName, price, setPrice }, i) => (
              <View key={i} style={styles.categoryRow}>
                <TextInput
                  style={[styles.catNameInput, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={`Categorie ${i + 1}`}
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.priceInput, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="ct"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            ))}
          </View>
        )}

        {/* Current drinks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DRANKJES</Text>
          {drinks.map((drink) => (
            <View key={drink.id} style={[styles.drinkRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>{drink.emoji ?? '🍺'}</Text>
              <Text style={[{ color: colors.text, flex: 1 }]}>{drink.name}</Text>
              <Text style={[{ color: colors.textSecondary, marginRight: 8 }]}>cat. {drink.category}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => handleRemoveDrink(drink.id, drink.name)}>
                  <Text style={{ color: '#ff4444' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Add drink */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DRANKJE TOEVOEGEN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
              placeholder="Naam"
              placeholderTextColor={colors.textSecondary}
              value={newDrinkName}
              onChangeText={setNewDrinkName}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
                placeholder="Emoji"
                placeholderTextColor={colors.textSecondary}
                value={newDrinkEmoji}
                onChangeText={setNewDrinkEmoji}
              />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
                placeholder="Categorie (1-4)"
                placeholderTextColor={colors.textSecondary}
                value={newDrinkCategory}
                onChangeText={setNewDrinkCategory}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: Brand.magenta }]}
              onPress={handleAddDrink}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Toevoegen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invite code */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>UITNODIGINGSCODE</Text>
            <View style={[styles.drinkRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: 2 }}>
                {group?.invite_code}
              </Text>
              <TouchableOpacity onPress={handleRegenerateCode}>
                <Text style={{ color: Brand.cyan, fontSize: 13 }}>Vernieuwen</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Danger zone */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: '#ff4444' }]}>GEVARENZONE</Text>
          <TouchableOpacity
            style={[styles.dangerButton, { borderColor: '#ff444440' }]}
            onPress={handleLeaveGroup}
          >
            <Text style={{ color: '#ff4444', fontWeight: '600' }}>Groep verlaten</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.dangerButton, { backgroundColor: '#ff444415', borderColor: '#ff4444' }]}
              onPress={handleDeleteGroup}
            >
              <Text style={{ color: '#ff4444', fontWeight: '600' }}>Groep verwijderen</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  groupAvatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  groupAvatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  catNameInput: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  priceInput: {
    width: 80,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
  },
  saveButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  dangerButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
});
