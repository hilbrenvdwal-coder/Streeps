import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { supabase } from '@/src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
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
      Alert.alert(
        'Naam wijzigen niet mogelijk',
        `Je kunt je naam maar 1x per maand wijzigen. Nog ${daysUntilChange()} dagen wachten.`
      );
      return;
    }
    setNewName(user?.user_metadata?.full_name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    if (newName.trim() === (user?.user_metadata?.full_name || '')) {
      setEditingName(false);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) =>
      Alert.alert(
        'Naam wijzigen',
        'Let op: je kunt je naam maar 1x per maand wijzigen. Weet je het zeker?',
        [
          { text: 'Annuleren', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Wijzigen', onPress: () => resolve(true) },
        ]
      )
    );
    if (!confirmed) return;

    setSaving(true);

    // Update auth metadata
    await supabase.auth.updateUser({
      data: { full_name: newName.trim() },
    });

    // Update profiles table
    await supabase
      .from('profiles')
      .update({
        full_name: newName.trim(),
        name_changed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

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

    // Upload to Supabase Storage
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
      console.error('Upload error:', uploadError);
      Alert.alert('Upload mislukt', uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    // Update profile
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  const handleSignOut = () => {
    Alert.alert('Uitloggen', 'Weet je het zeker?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const SettingsRow = ({ label, value }: { label: string; value?: string }) => (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Avatar */}
      <TouchableOpacity style={styles.avatarSection} onPress={handlePickAvatar} disabled={uploadingAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.surfaceLight }]}>
            <Text style={{ fontSize: 32, color: colors.textSecondary }}>
              {(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={{ color: Brand.cyan, fontSize: 13, marginTop: 8 }}>
          {uploadingAvatar ? 'Uploaden...' : 'Foto wijzigen'}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PROFIEL</Text>

        {/* Name - editable */}
        {editingName ? (
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: Brand.cyan }]}>
            <TextInput
              style={[styles.nameInput, { color: colors.text }]}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder="Naam"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity onPress={handleSaveName} disabled={saving}>
              <Text style={{ color: Brand.cyan, fontWeight: '600' }}>
                {saving ? '...' : 'Opslaan'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingName(false)} style={{ marginLeft: 12 }}>
              <Text style={{ color: colors.textSecondary }}>Annuleren</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleStartEdit}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Naam</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                {user?.user_metadata?.full_name || '-'}
              </Text>
              <Text style={{ color: Brand.cyan, marginLeft: 8, fontSize: 12 }}>wijzig</Text>
            </View>
          </TouchableOpacity>
        )}
        {!canChangeName() && !editingName && (
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 4, marginTop: -2, marginBottom: 4 }}>
            Nog {daysUntilChange()} dagen tot je je naam weer kunt wijzigen
          </Text>
        )}

        <SettingsRow label="E-mail" value={user?.email || '-'} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APP</Text>
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Thema</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['system', 'light', 'dark'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: preference === opt ? Brand.cyan + '20' : 'transparent',
                }}
                onPress={() => setPreference(opt)}
              >
                <Text style={{ color: preference === opt ? Brand.cyan : colors.textSecondary, fontSize: 13, fontWeight: preference === opt ? '600' : '400' }}>
                  {opt === 'system' ? 'Systeem' : opt === 'dark' ? 'Donker' : 'Licht'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <SettingsRow label="Versie" value="1.0.0" />
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: colors.error }]}
        onPress={handleSignOut}
      >
        <Text style={[styles.logoutText, { color: colors.error }]}>Uitloggen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 15 },
  nameInput: { flex: 1, fontSize: 16, marginRight: 12 },
  logoutButton: {
    margin: 24,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
