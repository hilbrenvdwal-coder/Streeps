import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '@/src/theme';

interface Group {
  id: string;
  name: string;
  avatar_url?: string | null;
  member_count: number;
  [key: string]: any;
}

interface Props {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<any>;
  onJoin: (code: string) => Promise<any>;
  theme: Theme;
}

export default function GroupSelector({ groups, selectedId, onSelect, onCreate, onJoin, theme: t }: Props) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selected = groups.find((g) => g.id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    const result = await onCreate(newName.trim());
    setSubmitting(false);
    if (result && 'error' in result && result.error) {
      Alert.alert('Fout', result.error as string);
      return;
    }
    setShowCreate(false);
    setNewName('');
    if (result && 'data' in result && result.data) {
      onSelect(result.data.id);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setSubmitting(true);
    const result = await onJoin(joinCode.trim());
    setSubmitting(false);
    if (result.error) {
      Alert.alert('Fout', result.error);
    } else {
      setShowJoin(false);
      setJoinCode('');
    }
  };

  return (
    <>
      {/* Selector bar */}
      <Pressable
        style={[styles.bar, { backgroundColor: t.colors.surface.raised }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.barText, { color: selected ? t.colors.text.primary : t.colors.text.tertiary }]}>
          {selected ? selected.name : 'Selecteer groep'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.colors.text.tertiary} />
      </Pressable>

      {/* Selection modal */}
      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: t.colors.border.strong }]} />
            <Text style={[styles.sheetTitle, { color: t.colors.text.primary }]}>Kies groep</Text>

            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.groupRow,
                    item.id === selectedId && { backgroundColor: t.brand.magenta + '12' },
                  ]}
                  onPress={() => { onSelect(item.id); setOpen(false); }}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: t.colors.surface.overlay }]}>
                      <Text style={{ color: t.colors.text.secondary, fontSize: 16, fontWeight: '600' }}>
                        {item.name[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupName, { color: t.colors.text.primary }]}>{item.name}</Text>
                    <Text style={{ color: t.colors.text.tertiary, fontSize: 12 }}>{item.member_count} leden</Text>
                  </View>
                  {item.id === selectedId && (
                    <Ionicons name="checkmark" size={20} color={t.brand.magenta} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: t.colors.text.tertiary, textAlign: 'center', padding: 20 }}>
                  Nog geen groepen
                </Text>
              }
            />

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: t.brand.magenta }]}
                onPress={() => { setOpen(false); setShowCreate(true); }}
              >
                <Text style={styles.actionText}>+ Nieuwe groep</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: t.brand.cyan }]}
                onPress={() => { setOpen(false); setShowJoin(true); }}
              >
                <Text style={[styles.actionText, { color: t.colors.text.inverse }]}>Deelnemen</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => { setShowCreate(false); setNewName(''); }}>
          <Pressable style={[styles.sheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: t.colors.border.strong }]} />
            <Text style={[styles.sheetTitle, { color: t.colors.text.primary }]}>Nieuwe groep</Text>
            <View style={[styles.inputWrap, { backgroundColor: t.colors.surface.default }]}>
              <TextInput
                style={[styles.input, { color: t.colors.text.primary }]}
                placeholder="Groepsnaam"
                placeholderTextColor={t.colors.text.tertiary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: t.colors.surface.default }]} onPress={() => { setShowCreate(false); setNewName(''); }}>
                <Text style={[styles.actionText, { color: t.colors.text.secondary }]}>Annuleren</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: t.brand.magenta }]} onPress={handleCreate} disabled={submitting}>
                <Text style={styles.actionText}>{submitting ? 'Laden...' : 'Aanmaken'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join modal */}
      <Modal visible={showJoin} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => { setShowJoin(false); setJoinCode(''); }}>
          <Pressable style={[styles.sheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: t.colors.border.strong }]} />
            <Text style={[styles.sheetTitle, { color: t.colors.text.primary }]}>Deelnemen aan groep</Text>
            <View style={[styles.inputWrap, { backgroundColor: t.colors.surface.default }]}>
              <TextInput
                style={[styles.input, { color: t.colors.text.primary }]}
                placeholder="Uitnodigingscode"
                placeholderTextColor={t.colors.text.tertiary}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: t.colors.surface.default }]} onPress={() => { setShowJoin(false); setJoinCode(''); }}>
                <Text style={[styles.actionText, { color: t.colors.text.secondary }]}>Annuleren</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: t.brand.cyan }]} onPress={handleJoin} disabled={submitting}>
                <Text style={[styles.actionText, { color: t.colors.text.inverse }]}>{submitting ? 'Laden...' : 'Deelnemen'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  barText: { fontSize: 16, fontWeight: '500' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: 16, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  inputWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    height: 52,
  },
});
