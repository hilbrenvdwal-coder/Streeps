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
  LayoutAnimation,
  UIManager,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import type { Theme } from '@/src/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SPRING_LAYOUT = LayoutAnimation.create(
  300,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.scaleXY,
);

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
  visible?: boolean;
  onClose?: () => void;
  hideBar?: boolean;
  currentGroup?: { name: string; avatar_url?: string | null } | null;
  activeCount?: number;
  onCreated?: (group: { id: string; name: string; invite_code: string }) => void;
}

export default function GroupSelector({
  groups,
  selectedId,
  onSelect,
  onCreate,
  onJoin,
  theme: t,
  visible,
  onClose,
  hideBar,
  currentGroup,
  activeCount = 0,
  onCreated,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showOpen, setShowOpen] = useState(false);

  // Overlay animation
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  // Inline create/join
  const [inlineMode, setInlineMode] = useState<'none' | 'create' | 'join'>('none');
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  // Open overlay
  useEffect(() => {
    if (visible) {
      setShowOpen(true);
      setInlineMode('none');
      scrimOpacity.setValue(0);
      listAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(listAnim, { toValue: 1, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const switchInlineMode = useCallback((mode: 'none' | 'create' | 'join') => {
    LayoutAnimation.configureNext(SPRING_LAYOUT);
    setInlineMode(mode);
    if (mode !== 'none') {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setNewName('');
      setJoinCode('');
    }
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(listAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setInlineMode('none');
      setNewName('');
      setJoinCode('');
      setShowOpen(false);
      onClose?.();
    });
  }, [onClose]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    handleClose();
  }, [onSelect, handleClose]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    spinAnim.setValue(0);
    Animated.timing(spinAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setSubmitting(true);
    const result = await onCreate(newName.trim());
    setSubmitting(false);
    spinAnim.setValue(0);
    if (result && 'error' in result && result.error) { Alert.alert('Fout', result.error as string); return; }
    setNewName('');
    setInlineMode('none');
    if (result && 'data' in result && result.data) {
      onSelect(result.data.id);
      onCreated?.(result.data);
    }
    handleClose();
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    spinAnim.setValue(0);
    Animated.timing(spinAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setSubmitting(true);
    const result = await onJoin(joinCode.trim());
    setSubmitting(false);
    spinAnim.setValue(0);
    if (result.error) { Alert.alert('Fout', result.error); return; }
    setJoinCode('');
    setInlineMode('none');
    handleClose();
  };

  const otherGroups = groups.filter((g) => g.id !== selectedId);

  const listStyle = {
    opacity: listAnim,
    transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  const isCreate = inlineMode === 'create';
  const isJoin = inlineMode === 'join';
  const isActive = inlineMode !== 'none';

  return (
    <>
      {showOpen && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Frosted scrim */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
            <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
            <View style={st.scrim} />
            <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
          </Animated.View>

          {/* Overlay card */}
          <View style={[st.overlayCard, { top: insets.top + 13, marginHorizontal: 20 }]} pointerEvents="box-none">
            {/* Header replica */}
            <Pressable style={st.headerReplica} onPress={handleClose} pointerEvents="auto">
              <View style={st.headerRow}>
                {currentGroup?.avatar_url ? (
                  <Image source={{ uri: currentGroup.avatar_url }} style={st.headerAvatar} />
                ) : (
                  <View style={[st.headerAvatar, st.headerAvatarFallback]}>
                    <Text style={st.headerAvatarText}>{currentGroup?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                )}
                <Text style={st.headerName} numberOfLines={1}>{currentGroup?.name ?? ''}</Text>
                <Ionicons name="chevron-up" size={20} color="#848484" style={{ marginLeft: 8 }} />
              </View>
              <Text style={st.headerActive}>{activeCount} actief</Text>
            </Pressable>

            {/* Groups list */}
            <Animated.View style={[st.groupsList, listStyle]} pointerEvents="auto">
              <MaskedView
                style={{ maxHeight: 300 }}
                maskElement={
                  <View style={{ flex: 1 }}>
                    <LinearGradient colors={['transparent', '#000']} style={{ height: 20 }} />
                    <View style={{ flex: 1, backgroundColor: '#000' }} />
                    <LinearGradient colors={['#000', 'transparent']} style={{ height: 20 }} />
                  </View>
                }
              >
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 8, paddingBottom: keyboardHeight > 0 ? keyboardHeight : 8 }}>
                  {otherGroups.map((group) => (
                    <Pressable key={group.id} style={st.groupRow} onPress={() => handleSelect(group.id)}>
                      {group.avatar_url ? (
                        <Image source={{ uri: group.avatar_url }} style={st.groupAvatar} />
                      ) : (
                        <View style={[st.groupAvatar, st.groupAvatarFallback]}>
                          <Text style={st.groupAvatarText}>{group.name[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={st.groupName}>{group.name}</Text>
                        <Text style={st.groupMeta}>{group.member_count} leden</Text>
                      </View>
                    </Pressable>
                  ))}
                  {otherGroups.length === 0 && (
                    <Text style={st.emptyText}>Geen andere groepen</Text>
                  )}
                </ScrollView>
              </MaskedView>

              {/* ── Action row ── */}
              <View style={st.actionRow}>
                {/* Input field — always mounted, flex 0 or 1 */}
                {isActive && (
                  <View style={st.inlineInputWrap}>
                    <TextInput
                      ref={inputRef}
                      style={st.inlineInput}
                      placeholder={isCreate ? 'Groepsnaam' : 'Uitnodigingscode'}
                      placeholderTextColor="#848484"
                      value={isCreate ? newName : joinCode}
                      onChangeText={isCreate ? setNewName : setJoinCode}
                      autoCapitalize={isJoin ? 'none' : 'sentences'}
                      returnKeyType="done"
                      onSubmitEditing={isCreate ? handleCreate : handleJoin}
                    />
                  </View>
                )}

                {/* "Nieuwe groep" button — pill or circle */}
                {(!isJoin) && (
                  <Pressable
                    style={isCreate
                      ? [st.circleBtn, { backgroundColor: '#FF004D' }]
                      : [st.actionBtn, { backgroundColor: '#FF004D' }]
                    }
                    onPress={isCreate ? handleCreate : () => switchInlineMode('create')}
                    disabled={submitting && isCreate}
                  >
                    {isCreate ? (
                      <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name={submitting ? 'hourglass' : 'arrow-forward'} size={22} color="#FFFFFF" />
                      </Animated.View>
                    ) : (
                      <Text style={st.actionText}>+ Nieuw</Text>
                    )}
                  </Pressable>
                )}

                {/* "Deelnemen" button — pill or circle */}
                {(!isCreate) && (
                  <Pressable
                    style={isJoin
                      ? [st.circleBtn, { backgroundColor: '#00BEAE' }]
                      : [st.actionBtn, { backgroundColor: '#00BEAE' }]
                    }
                    onPress={isJoin ? handleJoin : () => switchInlineMode('join')}
                    disabled={submitting && isJoin}
                  >
                    {isJoin ? (
                      <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name={submitting ? 'hourglass' : 'arrow-forward'} size={22} color="#1A1A2E" />
                      </Animated.View>
                    ) : (
                      <Text style={[st.actionText, { color: '#1A1A2E' }]}>Deelnemen</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  overlayCard: { position: 'absolute', left: 0, right: 0, zIndex: 10 },

  // Header replica
  headerReplica: { paddingHorizontal: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  headerAvatarFallback: { backgroundColor: '#F1F1F1' },
  headerAvatarText: { color: '#333', fontSize: 24, fontWeight: '600' },
  headerName: { fontFamily: 'Unbounded', fontSize: 32, fontWeight: '400', color: '#FFFFFF', flexShrink: 1 },
  headerActive: { fontFamily: 'Unbounded', fontSize: 20, fontWeight: '400', color: '#FFFFFF', marginTop: 12, paddingLeft: 10 },

  // Groups list
  groupsList: { marginTop: 16, backgroundColor: 'rgba(78, 78, 78, 0.4)', borderRadius: 25, padding: 16, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  groupAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  groupAvatarFallback: { backgroundColor: '#F1F1F1' },
  groupAvatarText: { color: '#333', fontSize: 18, fontWeight: '600' },
  groupName: { fontFamily: 'Unbounded', fontSize: 32, fontWeight: '400', color: '#FFFFFF' },
  groupMeta: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginTop: 2 },
  emptyText: { fontFamily: 'Unbounded', color: '#848484', textAlign: 'center', paddingVertical: 20, fontSize: 14 },

  // Action row
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: 'Unbounded',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Circle submit button
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inline input
  inlineInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    backgroundColor: 'rgba(78, 78, 78, 0.4)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inlineInput: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    paddingHorizontal: 20,
    height: 48,
  },
});
