import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Alert, Dimensions, Animated, Easing, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { supabase } from '@/src/lib/supabase';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import CameraModal from '@/src/components/CameraModal';
import { AnimatedCard } from '@/src/components/AnimatedCard';

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

const PROFIEL_AURORA_COLORS = ['#FF0085', '#00BEAE', '#F1F1F1', '#00FE96'];

function FadeMask({ children }: { children: React.ReactNode }) {
  return (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={
        <View style={{ flex: 1 }}>
          <LinearGradient colors={['transparent', '#000']} style={{ height: 32 }} />
          <View style={{ flex: 1, backgroundColor: '#000' }} />
        </View>
      }
    >
      {children}
    </MaskedView>
  );
}

export default function ProfielScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('name_changed_at, avatar_url, gender')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setNameChangedAt(data.name_changed_at);
            setAvatarUrl(data.avatar_url);
            setGender(data.gender ?? null);
          }
        });
    }, [user])
  );

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

  const handleOpenCamera = () => setCameraVisible(true);

  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (uploadError) { Alert.alert('Upload mislukt', uploadError.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  type GenderValue = 'man' | 'vrouw' | 'anders' | 'onbekend';
  const genderOptions: { value: GenderValue; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { value: 'man', label: 'Man', icon: 'male-outline' },
    { value: 'vrouw', label: 'Vrouw', icon: 'female-outline' },
    { value: 'anders', label: 'Anders', icon: 'transgender-outline' },
    { value: 'onbekend', label: 'Zeg ik liever niet', icon: 'remove-circle-outline' },
  ];

  const genderLabel = (value: string | null) => {
    if (!value) return 'Niet ingesteld';
    return genderOptions.find((o) => o.value === value)?.label ?? value;
  };

  const handleSelectGender = async (value: GenderValue) => {
    setGenderModalVisible(false);
    if (!user) return;
    setGender(value);
    await supabase.from('profiles').update({ gender: value }).eq('id', user.id);
  };

  const handleSignOut = () => {
    Alert.alert('Uitloggen', 'Weet je het zeker?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Account verwijderen',
      'Weet je het zeker? Al je gegevens worden permanent verwijderd. Dit kan niet ongedaan worden gemaakt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Definitief verwijderen?',
              'Dit is je laatste kans.',
              [
                { text: 'Annuleren', style: 'cancel' },
                {
                  text: 'Definitief verwijderen',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { data: { session: currentSession } } = await supabase.auth.getSession();
                      if (!currentSession?.access_token) {
                        Alert.alert('Fout', 'Je bent niet ingelogd.');
                        return;
                      }
                      const res = await fetch(
                        'https://ozyfedcosrgukiyscvsd.supabase.co/functions/v1/delete-account',
                        {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${currentSession.access_token}`,
                            'Content-Type': 'application/json',
                          },
                        }
                      );
                      const body = await res.json();
                      if (!res.ok) {
                        Alert.alert('Fout', body.error || 'Er ging iets mis.');
                        return;
                      }
                      await signOut();
                      router.replace('/(auth)/login');
                    } catch (e: any) {
                      Alert.alert('Fout', e.message || 'Er ging iets mis.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const themeOptions = [
    { key: 'system' as const, label: 'Systeem' },
    { key: 'light' as const, label: 'Licht' },
    { key: 'dark' as const, label: 'Donker' },
  ];

  // Animated segmented indicator
  const segLayouts = useRef<{ x: number; w: number }[]>([]).current;
  const segX = useRef(new Animated.Value(0)).current;
  const segW = useRef(new Animated.Value(0)).current;
  const segReady = useRef(false);

  const activeSegIndex = themeOptions.findIndex((o) => o.key === preference);

  const onSegLayout = useCallback((index: number, x: number, w: number) => {
    segLayouts[index] = { x, w };
    if (segLayouts.filter(Boolean).length === themeOptions.length && !segReady.current) {
      segReady.current = true;
      const cur = segLayouts[activeSegIndex] ?? segLayouts[0];
      segX.setValue(cur.x);
      segW.setValue(cur.w);
    }
  }, []);

  useEffect(() => {
    if (!segReady.current) return;
    const target = segLayouts[activeSegIndex];
    if (!target) return;
    const ease = { duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: false };
    Animated.timing(segX, { toValue: target.x, ...ease }).start();
    Animated.timing(segW, { toValue: target.w, ...ease }).start();
  }, [activeSegIndex]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      <FadeMask>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status bar spacer */}
        <View style={{ height: insets.top }} />

        {/* Header aurora — scrolls with content, behind everything */}
        <View style={styles.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={PROFIEL_AURORA_COLORS} animated />
        </View>

        {/* Title */}
        <Text style={styles.title}>Profiel</Text>

        {/* Avatar + info header */}
        <Pressable style={styles.avatarSection} onPress={handleOpenCamera} disabled={uploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.fotoWijzigen}>
            {uploadingAvatar ? 'Uploaden...' : 'Foto Wijzigen'}
          </Text>
        </Pressable>

        {/* Name display */}
        <Text style={styles.displayName}>
          {user?.user_metadata?.full_name || '-'}
        </Text>

        {/* ── PROFIEL section ── */}
        <AnimatedCard index={0}>
        <Text style={styles.sectionHeader}>PROFIEL</Text>
        <View style={styles.card}>
          {editingName ? (
            <View style={styles.row}>
              <Ionicons name="person-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
              <TextInput
                style={styles.editInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                placeholder="Naam"
                placeholderTextColor="#848484"
              />
              <Pressable onPress={handleSaveName} disabled={saving} style={styles.editBtn}>
                <Text style={styles.editBtnText}>{saving ? '...' : 'Opslaan'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={styles.editBtn}>
                <Text style={styles.editCancelText}>Annuleren</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.row} onPress={handleStartEdit}>
              <Ionicons name="person-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Naam</Text>
              <Text style={styles.rowValue}>{user?.user_metadata?.full_name || '-'}</Text>
            </Pressable>
          )}
          {!canChangeName() && !editingName && (
            <Text style={styles.nameWarning}>
              Nog {daysUntilChange()} dagen tot je je naam weer kunt wijzigen
            </Text>
          )}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>E-mail</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={() => setGenderModalVisible(true)}>
            <Ionicons name="person-circle-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Geslacht</Text>
            <Text style={[styles.rowValue, !gender && styles.rowValueUnset]}>{genderLabel(gender)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#848484" style={{ marginLeft: 4 }} />
          </Pressable>
        </View>
        </AnimatedCard>

        {/* Gender picker modal */}
        <Modal
          visible={genderModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGenderModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setGenderModalVisible(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Geslacht</Text>
              {genderOptions.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && <View style={styles.modalDivider} />}
                  <Pressable
                    style={styles.modalOption}
                    onPress={() => handleSelectGender(opt.value)}
                  >
                    <Ionicons name={opt.icon} size={20} color={gender === opt.value ? '#00BEAE' : '#FFFFFF'} style={{ marginRight: 12 }} />
                    <Text style={[styles.modalOptionText, gender === opt.value && styles.modalOptionActive]}>
                      {opt.label}
                    </Text>
                    {gender === opt.value && (
                      <Ionicons name="checkmark" size={18} color="#00BEAE" style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                </React.Fragment>
              ))}
              <Pressable style={styles.modalCancel} onPress={() => setGenderModalVisible(false)}>
                <Text style={styles.modalCancelText}>Annuleren</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── WEERGAVE section ── */}
        <AnimatedCard index={1}>
        <Text style={styles.sectionHeader}>WEERGAVE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="color-palette-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Thema</Text>
            <View style={styles.segmented}>
              <Animated.View style={[styles.segIndicator, { left: segX, width: segW }]} />
              {themeOptions.map((opt, i) => (
                <Pressable
                  key={opt.key}
                  style={styles.segmentBtn}
                  onPress={() => setPreference(opt.key)}
                  onLayout={(e) => onSegLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
                >
                  <Text style={[styles.segmentText, preference === opt.key && styles.segmentActiveText]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Versie</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>
        </AnimatedCard>

        {/* ── Uitloggen ── */}
        <AnimatedCard index={2}>
        <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Uitloggen</Text>
        </Pressable>
        </AnimatedCard>

        {/* ── Account verwijderen ── */}
        <AnimatedCard index={3}>
          <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>Account verwijderen</Text>
          </Pressable>
        </AnimatedCard>
      </ScrollView>
      </FadeMask>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    content: {
      paddingBottom: 120,
    },

    // Aurora — same framing as home tab
    auroraWrap: {
      position: 'absolute',
      left: -20,
      top: 0,
      zIndex: 0,
    },

    // Title
    title: {
      fontFamily: 'Unbounded',
      fontSize: 24,
      fontWeight: '400',
      color: '#FFFFFF',
      paddingHorizontal: s(21),
      paddingTop: s(10),
    },

    // Avatar hero
    avatarSection: {
      alignItems: 'center',
      marginTop: s(30),
    },
    avatar: {
      width: s(105),
      height: s(105),
      borderRadius: 9999,
    },
    avatarPlaceholder: {
      backgroundColor: '#D9D9D9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontFamily: 'Unbounded',
      fontSize: 36,
      fontWeight: '600',
      color: '#333',
    },
    fotoWijzigen: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      color: '#00BEAE',
      marginTop: s(12),
    },

    // Display name
    displayName: {
      fontFamily: 'Unbounded',
      fontSize: 24,
      fontWeight: '400',
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: s(16),
      paddingHorizontal: s(20),
    },

    // Section header
    sectionHeader: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      fontWeight: '400',
      color: '#848484',
      marginLeft: s(22),
      marginTop: s(28),
      marginBottom: s(8),
    },

    // Card
    card: {
      marginHorizontal: s(23),
      borderRadius: 25,
      backgroundColor: 'rgba(78, 78, 78, 0.2)',
      overflow: 'hidden',
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s(16),
      minHeight: s(55),
    },
    rowIcon: {
      marginRight: s(12),
      width: 20,
    },
    rowLabel: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      fontWeight: '400',
      color: '#FFFFFF',
      flex: 1,
    },
    rowValue: {
      fontFamily: 'Unbounded',
      fontSize: 12,
      fontWeight: '400',
      color: '#848484',
      flexShrink: 1,
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(78, 78, 78, 0.3)',
      marginLeft: s(48),
    },

    // Edit name
    editInput: {
      fontFamily: 'Unbounded',
      flex: 1,
      fontSize: 14,
      color: '#FFFFFF',
      marginRight: 8,
    },
    editBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    editBtnText: {
      fontFamily: 'Unbounded',
      color: '#00BEAE',
      fontSize: 12,
      fontWeight: '600',
    },
    editCancelText: {
      fontFamily: 'Unbounded',
      color: '#848484',
      fontSize: 12,
    },
    nameWarning: {
      fontFamily: 'Unbounded',
      color: '#848484',
      fontSize: 11,
      paddingHorizontal: s(74),
      paddingBottom: s(8),
    },

    // Theme segmented
    segmented: {
      flexDirection: 'row',
      borderRadius: 8,
      backgroundColor: 'rgba(78, 78, 78, 0.3)',
      padding: 2,
    },
    segIndicator: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      borderRadius: 6,
      backgroundColor: 'rgba(0, 190, 174, 0.2)',
    },
    segmentBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    segmentText: {
      fontFamily: 'Unbounded',
      fontSize: 11,
      fontWeight: '400',
      color: '#848484',
    },
    segmentActiveText: {
      color: '#00BEAE',
      fontWeight: '600',
    },

    // Logout
    logoutBtn: {
      marginHorizontal: s(24),
      marginTop: s(28),
      height: s(50),
      borderRadius: 25,
      backgroundColor: 'rgba(78, 78, 78, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: {
      fontFamily: 'Unbounded',
      fontSize: 16,
      fontWeight: '400',
      color: '#EB5466',
    },

    // Row value unset state
    rowValueUnset: {
      color: '#555',
      fontStyle: 'italic',
    },

    // Gender modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: '#1A1A2E',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: s(20),
      paddingTop: s(24),
      paddingBottom: s(36),
    },
    modalTitle: {
      fontFamily: 'Unbounded',
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: s(20),
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: s(14),
    },
    modalOptionText: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      color: '#FFFFFF',
    },
    modalOptionActive: {
      color: '#00BEAE',
      fontWeight: '600',
    },
    modalDivider: {
      height: 1,
      backgroundColor: 'rgba(78, 78, 78, 0.3)',
    },
    modalCancel: {
      marginTop: s(20),
      height: s(50),
      borderRadius: 25,
      backgroundColor: 'rgba(78, 78, 78, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      color: '#848484',
    },

    // Delete account
    deleteBtn: {
      marginHorizontal: s(24),
      marginTop: s(12),
      height: s(50),
      borderRadius: 25,
      backgroundColor: 'rgba(78, 78, 78, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      fontWeight: '400',
      color: '#EB5466',
    },
  });
}
