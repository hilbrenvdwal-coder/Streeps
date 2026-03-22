import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useGroups } from '@/src/hooks/useGroups';

export default function GroupsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { groups, loading, createGroup, joinGroup, refresh } = useGroups();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setSubmitting(true);
    const result = await createGroup(newGroupName.trim());
    setSubmitting(false);
    if (result && 'error' in result && result.error) {
      Alert.alert('Fout', result.error as string);
      return;
    }
    setShowCreateModal(false);
    setNewGroupName('');
    if (result && 'data' in result && result.data) {
      router.push(`/groups/${result.data.id}` as any);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    const result = await joinGroup(inviteCode.trim());
    setSubmitting(false);
    if (result.error) {
      Alert.alert('Fout', result.error);
    } else {
      setShowJoinModal(false);
      setInviteCode('');
    }
  };

  const renderGroup = ({ item }: { item: typeof groups[0] }) => (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/groups/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.groupInfo}>
        <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.groupMeta, { color: colors.textSecondary }]}>
          {item.member_count} leden
        </Text>
      </View>
      <View style={[styles.tallyBadge, { backgroundColor: Brand.magenta + '20' }]}>
        <Text style={[styles.tallyCount, { color: Brand.magenta }]}>
          {item.my_tally_count}
        </Text>
        <Text style={[styles.tallyLabel, { color: Brand.magenta }]}>streepjes</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={Brand.magenta} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Welkom bij Streeps!</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Maak een groep aan of neem deel met een uitnodigingscode.
            </Text>
          </View>
        }
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: Brand.magenta }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.buttonText}>+ Nieuwe groep</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: Brand.cyan }]}
          onPress={() => setShowJoinModal(true)}
        >
          <Text style={[styles.buttonText, { color: '#1A1A2E' }]}>Deelnemen</Text>
        </TouchableOpacity>
      </View>

      {/* Create group modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nieuwe groep</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
              placeholder="Groepsnaam"
              placeholderTextColor={colors.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceLight }]}
                onPress={() => { setShowCreateModal(false); setNewGroupName(''); }}
              >
                <Text style={{ color: colors.text }}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Brand.magenta }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>
                  {submitting ? 'Laden...' : 'Aanmaken'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join group modal */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Deelnemen aan groep</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.border }]}
              placeholder="Uitnodigingscode"
              placeholderTextColor={colors.textSecondary}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceLight }]}
                onPress={() => { setShowJoinModal(false); setInviteCode(''); }}
              >
                <Text style={{ color: colors.text }}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Brand.cyan }]}
                onPress={handleJoin}
                disabled={submitting}
              >
                <Text style={[styles.buttonText, { color: '#1A1A2E' }]}>
                  {submitting ? 'Laden...' : 'Deelnemen'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '600' },
  groupMeta: { fontSize: 14, marginTop: 4 },
  tallyBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tallyCount: { fontSize: 20, fontWeight: '700' },
  tallyLabel: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  input: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});
