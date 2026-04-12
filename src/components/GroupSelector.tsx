import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing as REasing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
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
  const morphProgress = useSharedValue(0);
  const hourglassRotation = useSharedValue(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const actionRowRef = useRef<View>(null);

  // Auto-scroll to input when keyboard opens
  useEffect(() => {
    if (keyboardHeight > 0 && inlineMode !== 'none') {
      setTimeout(() => {
        actionRowRef.current?.measureInWindow((_x, y, _w, h) => {
          const actionBottom = y + h;
          const screenH = Dimensions.get('window').height;
          const visibleBottom = screenH - keyboardHeight;
          if (actionBottom > visibleBottom) {
            scrollRef.current?.scrollToEnd({ animated: true });
          }
        });
      }, 100);
    }
  }, [keyboardHeight, inlineMode]);

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
    setInlineMode(mode);
    if (mode !== 'none') {
      morphProgress.value = withTiming(1, { duration: 300, easing: REasing.out(REasing.cubic) });
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      morphProgress.value = withTiming(0, { duration: 250, easing: REasing.in(REasing.cubic) });
      setNewName('');
      setJoinCode('');
    }
  }, []);

  // De knop die NIET gekozen is: fade + shrink weg
  const hiddenButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0, 0.3], [1, 0]),
    transform: [{ scale: interpolate(morphProgress.value, [0, 0.4], [1, 0.8]) }],
    flex: interpolate(morphProgress.value, [0, 0.4], [1, 0]),
    maxWidth: interpolate(morphProgress.value, [0, 0.4], [200, 0]),
    marginLeft: interpolate(morphProgress.value, [0, 0.4], [0, -12]),
    overflow: 'hidden' as const,
  }));

  // Het input veld: fade + expand in
  const inputFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0.15, 0.5], [0, 1]),
    flex: interpolate(morphProgress.value, [0, 0.4, 1], [0.001, 0.5, 1]),
    overflow: 'hidden' as const,
  }));

  // Zandloper rotatie
  const hourglassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${hourglassRotation.value}deg` }],
  }));

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    morphProgress.value = 0;
    hourglassRotation.value = 0;
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
    hourglassRotation.value = 0;
    hourglassRotation.value = withRepeat(
      withTiming(180, { duration: 1000, easing: REasing.linear }),
      -1,
      false
    );
    setSubmitting(true);
    const result = await onCreate(newName.trim());
    setSubmitting(false);
    cancelAnimation(hourglassRotation);
    hourglassRotation.value = withTiming(0, { duration: 200 });
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
    hourglassRotation.value = 0;
    hourglassRotation.value = withRepeat(
      withTiming(180, { duration: 1000, easing: REasing.linear }),
      -1,
      false
    );
    setSubmitting(true);
    const result = await onJoin(joinCode.trim());
    setSubmitting(false);
    cancelAnimation(hourglassRotation);
    hourglassRotation.value = withTiming(0, { duration: 200 });
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

  const screenH = Dimensions.get('window').height;
  const overlayTop = insets.top + 13;
  const reservedSpace = 240;
  const availableForList = keyboardHeight > 0
    ? screenH - overlayTop - keyboardHeight - reservedSpace
    : 300;
  const scrollMaxHeight = Math.max(80, Math.min(availableForList, 300));

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
                  <Image source={{ uri: currentGroup.avatar_url }} style={st.headerAvatar} transition={200} cachePolicy="memory-disk" />
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
                style={{ maxHeight: scrollMaxHeight }}
                maskElement={
                  <View style={{ flex: 1 }}>
                    <LinearGradient colors={['transparent', '#000']} style={{ height: 20 }} />
                    <View style={{ flex: 1, backgroundColor: '#000' }} />
                    <LinearGradient colors={['#000', 'transparent']} style={{ height: 20 }} />
                  </View>
                }
              >
                <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 8 }}>
                  {otherGroups.map((group) => (
                    <Pressable key={group.id} style={st.groupRow} onPress={() => handleSelect(group.id)}>
                      {group.avatar_url ? (
                        <Image source={{ uri: group.avatar_url }} style={st.groupAvatar} transition={200} cachePolicy="memory-disk" />
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
              <View ref={actionRowRef} style={st.actionRow}>
                {/* Input field — geanimeerd */}
                {isActive && (
                  <ReAnimated.View style={[st.inlineInputWrap, inputFieldStyle]}>
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
                  </ReAnimated.View>
                )}

                {/* Active circle button — altijd direct naast input */}
                {isCreate && (
                  <Pressable
                    style={[st.circleBtn, { backgroundColor: t.brand.magenta }]}
                    onPress={handleCreate}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ReAnimated.View style={hourglassStyle}>
                        <Ionicons name="hourglass" size={20} color="#FFFFFF" />
                      </ReAnimated.View>
                    ) : (
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                    )}
                  </Pressable>
                )}
                {isJoin && (
                  <Pressable
                    style={[st.circleBtn, { backgroundColor: t.brand.cyan }]}
                    onPress={handleJoin}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ReAnimated.View style={hourglassStyle}>
                        <Ionicons name="hourglass" size={20} color="#1A1A2E" />
                      </ReAnimated.View>
                    ) : (
                      <Ionicons name="arrow-forward" size={20} color="#1A1A2E" />
                    )}
                  </Pressable>
                )}

                {/* Default: beide pill-knoppen */}
                {!isActive && (
                  <>
                    <Pressable
                      style={[st.actionBtn, { backgroundColor: t.brand.magenta }]}
                      onPress={() => switchInlineMode('create')}
                    >
                      <Text style={st.actionText}>+ Nieuw</Text>
                    </Pressable>
                    <Pressable
                      style={[st.actionBtn, { backgroundColor: t.brand.cyan }]}
                      onPress={() => switchInlineMode('join')}
                    >
                      <Text style={[st.actionText, { color: '#1A1A2E' }]}>Deelnemen</Text>
                    </Pressable>
                  </>
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
