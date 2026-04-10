import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useGroups } from '@/src/hooks/useGroups';
import { useNavigation } from '@react-navigation/native';

export default function GroupsScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t, mode), [mode]);
  const router = useRouter();
  const navigation = useNavigation();
  const { groups, loading, createGroup, joinGroup, refresh } = useGroups();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { refresh(); });
    return unsubscribe;
  }, [navigation, refresh]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusedModal, setFocusedModal] = useState(false);

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
    <Pressable
      style={s.groupRow}
      onPress={() => router.push(`/groups/${item.id}` as any)}
    >
      <View style={s.avatarWrap}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={s.avatar} cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarLetter}>{item.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        {item.is_active && (
          <View style={s.statusBadge}>
            <View style={s.statusDot} />
          </View>
        )}
      </View>
      <View style={s.groupInfo}>
        <Text style={s.groupName}>{item.name}</Text>
        <Text style={s.groupMeta}>{item.member_count} leden</Text>
      </View>
      <View style={s.tallyBadge}>
        <Text style={s.tallyCount}>{item.my_tally_count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.colors.text.tertiary} />
    </Pressable>
  );

  const renderSeparator = () => <View style={s.divider} />;

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center]} edges={['top']}>
        <ActivityIndicator size="large" color={t.brand.magenta} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Groepen</Text>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={s.list}
        onRefresh={refresh}
        refreshing={loading}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        removeClippedSubviews={true}
        ListHeaderComponent={groups.length > 0 ? <View style={s.cardTop} /> : null}
        ListFooterComponent={groups.length > 0 ? <View style={s.cardBottom} /> : null}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Welkom bij Streeps!</Text>
            <Text style={s.emptyText}>Maak een groep aan of neem deel met een uitnodigingscode.</Text>
          </View>
        }
      />

      {/* Bottom buttons */}
      <View style={s.buttonRow}>
        <Pressable style={s.btnPrimary} onPress={() => setShowCreateModal(true)}>
          <Text style={s.btnPrimaryText}>+ Nieuwe groep</Text>
        </Pressable>
        <Pressable style={s.btnSecondary} onPress={() => setShowJoinModal(true)}>
          <Text style={s.btnSecondaryText}>Deelnemen</Text>
        </Pressable>
      </View>

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => { setShowCreateModal(false); setNewGroupName(''); }}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Nieuwe groep</Text>
            <View style={s.modalCard}>
              <View style={[s.modalInputRow, focusedModal && s.modalInputFocused]}>
                <Ionicons name="people-outline" size={20} color={t.colors.text.tertiary} style={s.modalInputIcon} />
                <TextInput
                  style={s.modalInput}
                  placeholder="Groepsnaam"
                  placeholderTextColor={t.colors.text.tertiary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                  onFocus={() => setFocusedModal(true)}
                  onBlur={() => setFocusedModal(false)}
                />
              </View>
            </View>
            <View style={s.modalBtnRow}>
              <Pressable style={s.modalBtnCancel} onPress={() => { setShowCreateModal(false); setNewGroupName(''); }}>
                <Text style={s.modalBtnCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable style={[s.modalBtnConfirm, { backgroundColor: t.brand.magenta }]} onPress={handleCreate} disabled={submitting}>
                <Text style={s.modalBtnConfirmText}>{submitting ? 'Laden...' : 'Aanmaken'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join Modal */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => { setShowJoinModal(false); setInviteCode(''); }}>
          <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Deelnemen aan groep</Text>
            <View style={s.modalCard}>
              <View style={s.modalInputRow}>
                <Ionicons name="key-outline" size={20} color={t.colors.text.tertiary} style={s.modalInputIcon} />
                <TextInput
                  style={s.modalInput}
                  placeholder="Uitnodigingscode"
                  placeholderTextColor={t.colors.text.tertiary}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
            </View>
            <View style={s.modalBtnRow}>
              <Pressable style={s.modalBtnCancel} onPress={() => { setShowJoinModal(false); setInviteCode(''); }}>
                <Text style={s.modalBtnCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable style={[s.modalBtnConfirm, { backgroundColor: t.brand.cyan }]} onPress={handleJoin} disabled={submitting}>
                <Text style={[s.modalBtnConfirmText, { color: t.colors.text.inverse }]}>{submitting ? 'Laden...' : 'Deelnemen'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(t: Theme, mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background.primary },
    center: { justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
    headerTitle: { ...t.typography.display, color: t.colors.text.primary },

    // List
    list: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
    cardTop: {
      height: t.radius.lg,
      backgroundColor: t.colors.surface.raised,
      borderTopLeftRadius: t.radius.lg,
      borderTopRightRadius: t.radius.lg,
    },
    cardBottom: {
      height: t.radius.lg,
      backgroundColor: t.colors.surface.raised,
      borderBottomLeftRadius: t.radius.lg,
      borderBottomRightRadius: t.radius.lg,
    },

    // Group row
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.colors.surface.raised,
    },
    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: {
      backgroundColor: t.colors.surface.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: { color: t.colors.text.secondary, fontSize: 18, fontWeight: '600' },
    statusBadge: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.colors.surface.raised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.brand.cyan },
    groupInfo: { flex: 1 },
    groupName: { ...t.typography.bodyMedium, color: t.colors.text.primary },
    groupMeta: { ...t.typography.caption, color: t.colors.text.tertiary, marginTop: 2 },
    tallyBadge: {
      backgroundColor: t.brand.magenta + '18',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 9999,
      marginRight: 8,
    },
    tallyCount: { ...t.typography.bodyMedium, color: t.brand.magenta },

    divider: { height: 1, backgroundColor: t.colors.border.default, marginLeft: 72 },

    // Empty
    empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
    emptyTitle: { ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 8 },
    emptyText: { ...t.typography.body, color: t.colors.text.tertiary, textAlign: 'center' },

    // Bottom buttons
    buttonRow: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12, gap: 12 },
    btnPrimary: {
      flex: 1,
      height: 50,
      backgroundColor: t.brand.magenta,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isDark
        ? Platform.select({ ios: { shadowColor: t.brand.magenta, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 4 }, default: {} })
        : {}
      ),
    },
    btnPrimaryText: { color: '#FFFFFF', ...t.typography.bodyMedium },
    btnSecondary: {
      flex: 1,
      height: 50,
      backgroundColor: t.brand.cyan,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isDark
        ? Platform.select({ ios: { shadowColor: t.brand.cyan, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 4 }, default: {} })
        : {}
      ),
    },
    btnSecondaryText: { color: t.colors.text.inverse, ...t.typography.bodyMedium },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim },
    modalSheet: {
      backgroundColor: t.colors.surface.raised,
      borderTopLeftRadius: t.radius.xl,
      borderTopRightRadius: t.radius.xl,
      padding: 24,
      paddingBottom: 40,
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: t.colors.border.strong,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    modalTitle: { ...t.typography.heading2, color: t.colors.text.primary, marginBottom: 16 },
    modalCard: {
      backgroundColor: t.colors.surface.default,
      borderRadius: t.radius.md,
      overflow: 'hidden',
      marginBottom: 20,
    },
    modalInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      height: 52,
    },
    modalInputFocused: {
      backgroundColor: isDark ? 'rgba(0, 217, 163, 0.06)' : 'rgba(233, 30, 140, 0.04)',
    },
    modalInputIcon: { marginRight: 12, width: 20 },
    modalInput: { flex: 1, ...t.typography.body, color: t.colors.text.primary, height: 52 },
    modalBtnRow: { flexDirection: 'row', gap: 12 },
    modalBtnCancel: {
      flex: 1,
      height: 50,
      backgroundColor: t.colors.surface.default,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnCancelText: { ...t.typography.bodyMedium, color: t.colors.text.secondary },
    modalBtnConfirm: {
      flex: 1,
      height: 50,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnConfirmText: { color: '#FFFFFF', ...t.typography.bodyMedium },
  });
}
