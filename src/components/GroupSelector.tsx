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
  AppState,
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
  withSequence,
  cancelAnimation,
  interpolate,
  Extrapolation,
  Easing as ReEasing,
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
  last_tally_at?: string | null;
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

// Action row fixed height so absolute-positioned layers can fill it cleanly
const ACTION_ROW_HEIGHT = 48;

const isGroupLive = (lastTallyAt: string | null | undefined) => {
  if (!lastTallyAt) return false;
  return Date.now() - new Date(lastTallyAt).getTime() < 10 * 60 * 1000;
};

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

  // ── Tick: force re-render every 30s while visible so isGroupLive() stays accurate ──
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => forceTick(t => t + 1), 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') forceTick(t => t + 1);
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [visible]);

  // Overlay animation (old Animated API — Fix C would migrate these, we leave them)
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  // Inline create/join
  const [inlineMode, setInlineMode] = useState<'none' | 'create' | 'join'>('none');
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const hourglassRotation = useSharedValue(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const actionRowRef = useRef<View>(null);

  // ── Morph animation shared values ──────────────────────────────────────────
  // morphProgress: 0 = pills visible, 1 = input+circle visible
  const morphProgress = useSharedValue(0);
  // modeProgress: -1 = create-circle visible, 0 = none, 1 = join-circle visible
  // We use two separate values so each circle can animate independently.
  const createProgress = useSharedValue(0); // 0→1 when mode = 'create'
  const joinProgress = useSharedValue(0);   // 0→1 when mode = 'join'

  const MORPH_DURATION = 340;
  const MORPH_EASING = ReEasing.out(ReEasing.cubic);

  // Pills layer: visible when morphProgress = 0, hidden when morphProgress = 1
  // Slides ~32px to the left while fading + scaling down
  const pillsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(morphProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(morphProgress.value, [0, 1], [1, 0.8], Extrapolation.CLAMP);
    const translateX = interpolate(morphProgress.value, [0, 1], [0, -32], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateX }, { scale }],
      pointerEvents: morphProgress.value > 0.5 ? 'none' : 'auto',
    };
  });

  // Input layer: visible when morphProgress = 1, hidden when morphProgress = 0
  // Slides in from ~32px to the right while fading + scaling up
  const inputLayerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(morphProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(morphProgress.value, [0, 1], [0.9, 1], Extrapolation.CLAMP);
    const translateX = interpolate(morphProgress.value, [0, 1], [32, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateX }, { scale }],
      pointerEvents: morphProgress.value > 0.5 ? 'auto' : 'none',
    };
  });

  // Create circle button
  const createCircleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(createProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(createProgress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
      pointerEvents: createProgress.value > 0.5 ? 'auto' : 'none',
    };
  });

  // Join circle button
  const joinCircleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(joinProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const scale = interpolate(joinProgress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
      pointerEvents: joinProgress.value > 0.5 ? 'auto' : 'none',
    };
  });

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

  // Hourglass flip animation — rotates 180° in bursts with pauses, while submitting
  const hourglassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${hourglassRotation.value}deg` }],
  }));

  useEffect(() => {
    if (submitting) {
      hourglassRotation.value = 0;
      hourglassRotation.value = withRepeat(
        withSequence(
          withTiming(180, { duration: 150, easing: ReEasing.out(ReEasing.cubic) }),
          withTiming(180, { duration: 350 }),
          withTiming(360, { duration: 150, easing: ReEasing.out(ReEasing.cubic) }),
          withTiming(360, { duration: 350 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(hourglassRotation);
      hourglassRotation.value = withTiming(0, { duration: 200 });
    }
  }, [submitting]);

  // Open overlay
  useEffect(() => {
    if (visible) {
      setShowOpen(true);
      setInlineMode('none');
      // Reset morph to default (pills)
      morphProgress.value = 0;
      createProgress.value = 0;
      joinProgress.value = 0;
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

    const timingCfg = { duration: MORPH_DURATION, easing: MORPH_EASING };
    if (mode === 'create') {
      morphProgress.value = withTiming(1, timingCfg);
      createProgress.value = withTiming(1, timingCfg);
      joinProgress.value = withTiming(0, timingCfg);
      setTimeout(() => inputRef.current?.focus(), 180);
    } else if (mode === 'join') {
      morphProgress.value = withTiming(1, timingCfg);
      createProgress.value = withTiming(0, timingCfg);
      joinProgress.value = withTiming(1, timingCfg);
      setTimeout(() => inputRef.current?.focus(), 180);
    } else {
      // Dismiss back to pills
      morphProgress.value = withTiming(0, timingCfg);
      createProgress.value = withTiming(0, timingCfg);
      joinProgress.value = withTiming(0, timingCfg);
      setNewName('');
      setJoinCode('');
    }
  }, []);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
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
    setSubmitting(true);
    const result = await onCreate(newName.trim());
    setSubmitting(false);
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
    setSubmitting(true);
    const result = await onJoin(joinCode.trim());
    setSubmitting(false);
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
                        <View style={st.groupMetaRow}>
                          <Text style={st.groupMeta}>{group.member_count} leden</Text>
                          {isGroupLive(group.last_tally_at) && (
                            <View style={st.liveBadge}>
                              <View style={st.liveDot} />
                              <Text style={st.liveBadgeText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                  {otherGroups.length === 0 && (
                    <Text style={st.emptyText}>Geen andere groepen</Text>
                  )}
                </ScrollView>
              </MaskedView>

              {/* ── Action row ── */}
              {/*
                Layout:
                  - Fixed height container with position: 'relative' and overflow: 'hidden'
                  - Layer 1 (pills): flex row with two pill buttons, animates opacity+scale out
                  - Layer 2 (input): absolute fill, animates opacity+scale in
                  - Layer 3 (circle create): absolute right, animates opacity+scale in when mode=create
                  - Layer 4 (circle join): absolute right, animates opacity+scale in when mode=join
                All layers always mounted — only opacity/scale driven by morphProgress.
              */}
              <View ref={actionRowRef} style={st.actionRow}>

                {/* Layer 1: Pills — always mounted, fades out on morph (pointerEvents via animated style) */}
                <ReAnimated.View style={[st.pillsLayer, pillsStyle]}>
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
                </ReAnimated.View>

                {/* Layer 2: Input field — absolute, fades in on morph (pointerEvents via animated style) */}
                <ReAnimated.View style={[st.inputLayer, inputLayerStyle]}>
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
                      editable={isActive}
                      focusable={isActive}
                      importantForAccessibility={isActive ? 'yes' : 'no-hide-descendants'}
                    />
                  </View>
                </ReAnimated.View>

                {/* Layer 3: Create circle button — absolute right, fades in when mode=create */}
                <ReAnimated.View style={[st.circleLayer, createCircleStyle]}>
                  <Pressable
                    style={[st.circleBtn, { backgroundColor: t.brand.magenta }]}
                    onPress={handleCreate}
                    disabled={submitting && isCreate}
                  >
                    <ReAnimated.View style={hourglassStyle}>
                      <Ionicons name={submitting ? 'hourglass' : 'arrow-forward'} size={22} color="#FFFFFF" />
                    </ReAnimated.View>
                  </Pressable>
                </ReAnimated.View>

                {/* Layer 4: Join circle button — absolute right, fades in when mode=join */}
                <ReAnimated.View style={[st.circleLayer, joinCircleStyle]}>
                  <Pressable
                    style={[st.circleBtn, { backgroundColor: t.brand.cyan }]}
                    onPress={handleJoin}
                    disabled={submitting && isJoin}
                  >
                    <ReAnimated.View style={hourglassStyle}>
                      <Ionicons name={submitting ? 'hourglass' : 'arrow-forward'} size={22} color="#1A1A2E" />
                    </ReAnimated.View>
                  </Pressable>
                </ReAnimated.View>

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
  groupsList: { marginTop: 16, padding: 16, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  groupAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  groupAvatarFallback: { backgroundColor: '#F1F1F1' },
  groupAvatarText: { color: '#333', fontSize: 18, fontWeight: '600' },
  groupName: { fontFamily: 'Unbounded', fontSize: 32, fontWeight: '400', color: '#FFFFFF' },
  groupMeta: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginTop: 2 },
  groupMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(0,254,150,0.15)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FE96' },
  liveBadgeText: { fontFamily: 'Unbounded', fontSize: 9, fontWeight: '700', color: '#00FE96', letterSpacing: 0.5 },
  emptyText: { fontFamily: 'Unbounded', color: '#848484', textAlign: 'center', paddingVertical: 20, fontSize: 14 },

  // Action row — fixed height, relative position for absolute layers
  actionRow: {
    height: ACTION_ROW_HEIGHT,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  // Pills layer — flex row filling the action row
  pillsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  // Input layer — absolute fill (leaves room for circle on the right)
  inputLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Right side reserved for the circle button (48px) + 12px gap
    right: ACTION_ROW_HEIGHT + 12,
    bottom: 0,
    justifyContent: 'center',
  },

  // Circle button layer — absolute right
  circleLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: ACTION_ROW_HEIGHT,
    height: ACTION_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionBtn: {
    flex: 1,
    height: ACTION_ROW_HEIGHT,
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
    width: ACTION_ROW_HEIGHT,
    height: ACTION_ROW_HEIGHT,
    borderRadius: ACTION_ROW_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inline input
  inlineInputWrap: {
    flex: 1,
    height: ACTION_ROW_HEIGHT,
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
    height: ACTION_ROW_HEIGHT,
  },
});
