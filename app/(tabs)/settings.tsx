import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('name_changed_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setNameChangedAt(data.name_changed_at);
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
        <SettingsRow label="Thema" value={colorScheme === 'dark' ? 'Donker' : 'Licht'} />
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
