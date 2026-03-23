import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { supabase } from '@/src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function ProfielScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t, mode), [mode]);
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('name_changed_at, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setNameChangedAt(data.name_changed_at);
          setAvatarUrl(data.avatar_url);
        }
      });
  }, [user]);

  const canChangeName = () => {
    if (!nameChangedAt) return true;
    const lastChanged = new Date(nameChangedAt);
    const now = new Date();
    const diffDays = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 30;
  };

  const daysUntilChange = () => {
    if (!nameChangedAt) return 0;
    const lastChanged = new Date(nameChangedAt);
    const nextAllowed = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.ceil((nextAllowed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleStartEdit = () => {
    if (!canChangeName()) {
      Alert.alert('Naam wijzigen niet mogelijk', `Je kunt je naam maar 1x per maand wijzigen. Nog ${daysUntilChange()} dagen wachten.`);
      return;
    }
    setNewName(user?.user_metadata?.full_name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    if (newName.trim() === (user?.user_metadata?.full_name || '')) { setEditingName(false); return; }
    const confirmed = await new Promise<boolean>((resolve) =>
      Alert.alert('Naam wijzigen', 'Let op: je kunt je naam maar 1x per maand wijzigen. Weet je het zeker?', [
        { text: 'Annuleren', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Wijzigen', onPress: () => resolve(true) },
      ])
    );
    if (!confirmed) return;
    setSaving(true);
    await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
    await supabase.from('profiles').update({ full_name: newName.trim(), name_changed_at: new Date().toISOString() }).eq('id', user.id);
    setNameChangedAt(new Date().toISOString());
    setEditingName(false);
    setSaving(false);
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0] || !user) return;
    setUploadingAvatar(true);
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
    if (uploadError) { Alert.alert('Upload mislukt', uploadError.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  const handleSignOut = () => {
    Alert.alert('Uitloggen', 'Weet je het zeker?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const themeOptions = [
    { key: 'system' as const, label: 'Systeem' },
    { key: 'light' as const, label: 'Licht' },
    { key: 'dark' as const, label: 'Donker' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Header */}
        <Text style={[s.headerTitle, { color: t.colors.text.primary }]}>Profiel</Text>

        {/* Avatar hero */}
        <Pressable style={s.avatarSection} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: t.colors.surface.overlay }]}>
              <Text style={{ fontSize: 32, fontWeight: '600', color: t.colors.text.secondary }}>
                {(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={{ color: t.colors.tint, fontSize: 12, marginTop: 8 }}>
            {uploadingAvatar ? 'Uploaden...' : 'Foto wijzigen'}
          </Text>
          <Text style={{ ...t.typography.heading3, color: t.colors.text.primary, marginTop: 12 }}>
            {user?.user_metadata?.full_name || '-'}
          </Text>
          <Text style={{ color: t.colors.text.tertiary, fontSize: 14, marginTop: 2 }}>
            {user?.email || ''}
          </Text>
        </Pressable>

        {/* Profile Section */}
        <Text style={s.sectionHeader}>PROFIEL</Text>
        <View style={[s.card, { backgroundColor: t.colors.surface.raised }]}>
          {editingName ? (
            <View style={s.editRow}>
              <Ionicons name="person-outline" size={20} color={t.colors.text.tertiary} style={s.rowIcon} />
              <TextInput
                style={[s.editInput, { color: t.colors.text.primary }]}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                placeholder="Naam"
                placeholderTextColor={t.colors.text.tertiary}
              />
              <Pressable onPress={handleSaveName} disabled={saving} style={s.editBtn}>
                <Text style={{ color: t.colors.tint, fontSize: 14, fontWeight: '600' }}>{saving ? '...' : 'Opslaan'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={s.editBtn}>
                <Text style={{ color: t.colors.text.tertiary, fontSize: 14 }}>Annuleren</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.row} onPress={handleStartEdit}>
              <Ionicons name="person-outline" size={20} color={t.colors.text.tertiary} style={s.rowIcon} />
              <Text style={[s.rowLabel, { color: t.colors.text.primary }]}>Naam</Text>
              <Text style={{ color: t.colors.text.tertiary, fontSize: 14, marginRight: 4 }}>{user?.user_metadata?.full_name || '-'}</Text>
              <Ionicons name="chevron-forward" size={16} color={t.colors.text.tertiary} />
            </Pressable>
          )}
          {!canChangeName() && !editingName && (
            <Text style={{ color: t.colors.text.tertiary, fontSize: 12, paddingHorizontal: 48, paddingBottom: 8 }}>
              Nog {daysUntilChange()} dagen tot je je naam weer kunt wijzigen
            </Text>
          )}
          <View style={[s.divider, { backgroundColor: t.colors.border.default }]} />
          <View style={s.row}>
            <Ionicons name="mail-outline" size={20} color={t.colors.text.tertiary} style={s.rowIcon} />
            <Text style={[s.rowLabel, { color: t.colors.text.primary }]}>E-mail</Text>
            <Text style={{ color: t.colors.text.tertiary, fontSize: 14 }}>{user?.email || '-'}</Text>
          </View>
        </View>

        {/* Display Section */}
        <Text style={s.sectionHeader}>WEERGAVE</Text>
        <View style={[s.card, { backgroundColor: t.colors.surface.raised }]}>
          <View style={s.row}>
            <Ionicons name="color-palette-outline" size={20} color={t.colors.text.tertiary} style={s.rowIcon} />
            <Text style={[s.rowLabel, { color: t.colors.text.primary }]}>Thema</Text>
            <View style={[s.segmented, { backgroundColor: t.colors.surface.default }]}>
              {themeOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[s.segmentBtn, preference === opt.key && [s.segmentActive, { backgroundColor: t.colors.tint + '20' }]]}
                  onPress={() => setPreference(opt.key)}
                >
                  <Text style={[s.segmentText, { color: t.colors.text.tertiary }, preference === opt.key && { color: t.colors.tint, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[s.divider, { backgroundColor: t.colors.border.default }]} />
          <View style={s.row}>
            <Ionicons name="information-circle-outline" size={20} color={t.colors.text.tertiary} style={s.rowIcon} />
            <Text style={[s.rowLabel, { color: t.colors.text.primary }]}>Versie</Text>
            <Text style={{ color: t.colors.text.tertiary, fontSize: 14 }}>1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <Pressable style={[s.logoutBtn, { backgroundColor: t.colors.surface.raised }]} onPress={handleSignOut}>
          <Text style={{ color: t.semantic.error, fontSize: 16, fontWeight: '500' }}>Uitloggen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: Theme, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background.primary },
    content: { paddingBottom: 40 },

    headerTitle: { fontSize: 32, fontWeight: '700', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },

    avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
    avatar: { width: 80, height: 80, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },

    sectionHeader: {
      fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase',
      color: t.colors.text.tertiary, marginLeft: 28, marginTop: 24, marginBottom: 8,
    },

    card: { borderRadius: 16, marginHorizontal: 24, overflow: 'hidden' },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
    rowIcon: { marginRight: 12, width: 20 },
    rowLabel: { fontSize: 16, flex: 1 },
    divider: { height: 1, marginLeft: 48 },

    editRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
    editInput: { flex: 1, fontSize: 16, marginRight: 8 },
    editBtn: { paddingHorizontal: 8, paddingVertical: 4 },

    segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
    segmentBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    segmentActive: {},
    segmentText: { fontSize: 12, fontWeight: '500' },

    logoutBtn: {
      marginHorizontal: 24, marginTop: 32, height: 52, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
