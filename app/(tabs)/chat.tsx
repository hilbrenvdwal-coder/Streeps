import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, View, Text, Pressable, FlatList, Image, TextInput,
  Dimensions, Animated, Easing, ScrollView, Alert, Platform, PanResponder,
  Keyboard, Share, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { supabase } from '@/src/lib/supabase';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import { useConversations, useChatMessages, useContacts, startDM, sendGiftMessage, type ConversationPreview } from '@/src/hooks/useChat';
import { useNavBarAnim } from './_layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path, G } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import CameraModal from '@/src/components/CameraModal';
import { AnimatedCard } from '@/src/components/AnimatedCard';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const CHAT_AURORA_COLORS = ['#FF0085', '#00BEAE', '#FF00F5', '#00FE96'];

const SENDER_COLORS = [
  '#00BEAE', '#FF6B6B', '#4A6CF7', '#FFD93D', '#FF85C8',
  '#6BFFF0', '#C084FC', '#F97316', '#34D399', '#F472B6',
  '#38BDF8', '#FACC15', '#A78BFA', '#FB923C', '#2DD4BF',
];

function getSenderColor(userId: string, conversationId: string): string {
  let hash = 0;
  const key = userId + conversationId;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

// Format for chat bubbles: minutes → then HH:mm after 1 hour
function formatMessageTime(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'nu';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return time;
  const dayMs = 7 * 24 * 60 * 60 * 1000;
  if (diff < dayMs) {
    const day = d.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '');
    return `${day} ${time}`;
  }
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Format for overview list: minutes → hours → days → weeks → date
function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'nu';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}u`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'gisteren';
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ── Press scale animation hook ──
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.timing(scale, {
      toValue: 0.85, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.1, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]).start();
  };
  return { scale, onPressIn, onPressOut };
}

// ── Swipe-to-dismiss hook for overlays ──
function useSwipeDismiss(onDismiss: () => void, overlayAnim?: Animated.Value) {
  const swipeX = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && gs.moveX < 80 && Math.abs(gs.dy) < 25,
      onPanResponderMove: (_, gs) => { if (gs.dx > 0) swipeX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80 || gs.vx > 0.5) {
          const remaining = SCREEN_W - gs.dx;
          const velocity = Math.max(gs.vx, 0.5);
          const duration = Math.min(remaining / velocity, 300);
          const anims: Animated.CompositeAnimation[] = [
            Animated.timing(swipeX, { toValue: SCREEN_W, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ];
          if (overlayAnim) {
            anims.push(Animated.timing(overlayAnim, { toValue: 0, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }));
          }
          Animated.parallel(anims).start(() => {
            swipeX.setValue(0);
            onDismiss();
          });
        } else {
          Animated.spring(swipeX, { toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  return { swipeX, panHandlers: pan.panHandlers };
}

// ── Top fade mask wrapper ──
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

// ── Animated message bubble (native driver: opacity + translateY) ──
function AnimatedBubble({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

// ── Animated gift aurora (15 layers, each independently animated) ──
// SVG: 390×165 → container: 320×135
const GA_S = 1;
const GIFT_SHAPES: { src: any; cx: number; cy: number; w: number; h: number; dur: number; dx: number; dy: number; sc: number }[] = [
  // g0: center star — 3 layers (teal, green, white)
  { src: require('@/assets/figma/gift-aurora-0-0.png'), cx: 190.5, cy: 83.3, w: 449.4, h: 147.4, dur: 6000, dx: 3, dy: 1, sc: 1.03 },
  { src: require('@/assets/figma/gift-aurora-0-1.png'), cx: 184.5, cy: 85.8, w: 449.4, h: 147.4, dur: 5200, dx: -2, dy: 1.5, sc: 1.04 },
  { src: require('@/assets/figma/gift-aurora-0-2.png'), cx: 188.5, cy: 82.8, w: 449.4, h: 147.4, dur: 4500, dx: 1.5, dy: -1, sc: 1.02 },
  // g1: top-left blob
  { src: require('@/assets/figma/gift-aurora-1-0.png'), cx: 120.6, cy: 27.4, w: 90.5, h: 76.2, dur: 3800, dx: -3, dy: 2, sc: 1.06 },
  { src: require('@/assets/figma/gift-aurora-1-1.png'), cx: 120.5, cy: 26.8, w: 90.5, h: 76.2, dur: 4200, dx: 2, dy: -1.5, sc: 1.05 },
  { src: require('@/assets/figma/gift-aurora-1-2.png'), cx: 122.5, cy: 32.4, w: 90.5, h: 76.2, dur: 3500, dx: -1, dy: 2.5, sc: 1.04 },
  // g2: top-right blob
  { src: require('@/assets/figma/gift-aurora-2-0.png'), cx: 268.3, cy: 40.7, w: 79.7, h: 75.1, dur: 4000, dx: 2.5, dy: -2, sc: 1.06 },
  { src: require('@/assets/figma/gift-aurora-2-1.png'), cx: 275.1, cy: 34.4, w: 79.7, h: 75.1, dur: 3600, dx: -1.5, dy: 1.5, sc: 1.05 },
  { src: require('@/assets/figma/gift-aurora-2-2.png'), cx: 275.1, cy: 34.4, w: 79.7, h: 75.1, dur: 4400, dx: 2, dy: 1, sc: 1.03 },
  // g3: bottom-right blob
  { src: require('@/assets/figma/gift-aurora-3-0.png'), cx: 328.0, cy: 128.2, w: 103.5, h: 77.1, dur: 4600, dx: -2, dy: 2.5, sc: 1.05 },
  { src: require('@/assets/figma/gift-aurora-3-1.png'), cx: 333.7, cy: 124.1, w: 103.5, h: 77.1, dur: 3900, dx: 1.5, dy: -1.5, sc: 1.04 },
  { src: require('@/assets/figma/gift-aurora-3-2.png'), cx: 331.1, cy: 122.1, w: 103.5, h: 77.1, dur: 5000, dx: -1, dy: 1, sc: 1.03 },
  // g4: bottom-left blob
  { src: require('@/assets/figma/gift-aurora-4-0.png'), cx: 57.8, cy: 131.1, w: 118.1, h: 84.8, dur: 4100, dx: 3, dy: -2, sc: 1.05 },
  { src: require('@/assets/figma/gift-aurora-4-1.png'), cx: 61.9, cy: 135.5, w: 118.1, h: 84.8, dur: 3700, dx: -2, dy: 1.5, sc: 1.06 },
  { src: require('@/assets/figma/gift-aurora-4-2.png'), cx: 54.6, cy: 133.3, w: 118.1, h: 84.8, dur: 4800, dx: 1.5, dy: -1, sc: 1.03 },
];

function GiftAuroraLayer({ shape, index }: { shape: typeof GIFT_SHAPES[0]; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered fade-in: each layer fades in 60ms after the previous
    const delay = index * 60;
    Animated.timing(fadeIn, {
      toValue: 1, duration: 600, delay, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start();

    // Start loop after fade-in delay, with random phase for organic feel
    setTimeout(() => {
      anim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: shape.dur / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: shape.dur / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, delay);
  }, []);

  const tx = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, shape.dx, 0] });
  const ty = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, shape.dy, 0] });
  const sc = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, shape.sc, 1] });
  const pulse = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.88, 1, 0.88] });
  // Combine fade-in with pulse opacity
  const op = Animated.multiply(fadeIn, pulse);

  const lw = shape.w * GA_S;
  const lh = shape.h * GA_S;

  return (
    <Animated.Image
      source={shape.src}
      resizeMode="contain"
      style={{
        position: 'absolute',
        left: shape.cx * GA_S, top: shape.cy * GA_S,
        width: lw, height: lh,
        opacity: op,
        transform: [{ translateX: -lw / 2 }, { translateY: -lh / 2 }, { translateX: tx }, { translateY: ty }, { scale: sc }],
      }}
    />
  );
}

function GiftAurora() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {GIFT_SHAPES.map((s, i) => <GiftAuroraLayer key={i} shape={s} index={i} />)}
    </View>
  );
}

// ── Gift overlay (full-screen, consistent with other overlays) ──
function GiftOverlay({ conversationId, type, groupId, otherUserId, otherUserName, onClose, onSend, cachedData }: {
  conversationId: string; type: 'dm' | 'group'; groupId?: string | null; otherUserId?: string | null; otherUserName?: string;
  onClose: () => void;
  onSend: (recipientId: string, recipientName: string, groupId: string, category: number, quantity: number, categoryName: string) => void;
  cachedData?: { group: any; members: any[]; activeCategories: { category: number; name: string }[] };
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: goSwipeX, panHandlers: goPan } = useSwipeDismiss(onClose, anim);

  const [members, setMembers] = useState<any[]>([]);
  const [activeCategories, setActiveCategories] = useState<{ category: number; name: string }[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set(otherUserId ? [otherUserId] : []));
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Number animation — layer stack (same approach as CounterControl)
  type QtyLayer = { key: number; value: number; opacity: Animated.Value; scale: Animated.Value };
  const qtyKeyCounter = useRef(0);
  const [qtyLayers, setQtyLayers] = useState<QtyLayer[]>(() => [{
    key: 0, value: quantity, opacity: new Animated.Value(1), scale: new Animated.Value(1),
  }]);
  const qtyLayersRef = useRef(qtyLayers);
  qtyLayersRef.current = qtyLayers;

  const removeQtyLayer = useCallback((key: number) => {
    setQtyLayers(prev => prev.filter(l => l.key !== key));
  }, []);

  const qtyRef = useRef(quantity);
  qtyRef.current = quantity;

  const handleQtyChange = useCallback((delta: number) => {
    const cur = qtyRef.current;
    const next = Math.max(1, Math.min(10, cur + delta));
    if (next === cur) return;
    setQuantity(next);
  }, []);

  useEffect(() => {
    const current = qtyLayersRef.current;
    const topLayer = current[current.length - 1];
    if (topLayer && topLayer.value === quantity) return;

    // Fade out existing layers
    current.forEach(layer => {
      Animated.timing(layer.opacity, {
        toValue: 0, duration: 225, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) removeQtyLayer(layer.key); });
    });

    // Add new layer
    const newKey = ++qtyKeyCounter.current;
    const newLayer: QtyLayer = {
      key: newKey, value: quantity,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1.5),
    };
    setQtyLayers(prev => [...prev, newLayer]);

    Animated.parallel([
      Animated.timing(newLayer.opacity, { toValue: 1, duration: 33, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(newLayer.scale, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [quantity]);

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    if (cachedData) {
      // Use prefetched data — instant display
      setActiveCategories(cachedData.activeCategories);
      if (cachedData.activeCategories.length > 0) setSelectedCategory(cachedData.activeCategories[0].category);
      const otherMembers = (cachedData.members || [])
        .filter((m: any) => m.user_id !== user?.id)
        .map((m: any) => m.profile || { id: m.user_id, full_name: 'Onbekend', avatar_url: null });
      setMembers(otherMembers);
      if (type === 'dm' && otherUserId) {
        setSelectedRecipients(new Set([otherUserId]));
      }
    } else if (groupId) {
      fetchGroupData();
    }
  }, []);

  const fetchGroupData = async () => {
    if (!groupId || !user) return;
    const [{ data: g }, { data: gm }, { data: drinksData }] = await Promise.all([
      supabase.from('groups').select('name, name_category_1, name_category_2, name_category_3, name_category_4').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id').eq('group_id', groupId),
      supabase.from('drinks').select('category').eq('group_id', groupId).eq('is_available', true),
    ]);

    // Active categories: only those with drinks (same logic as home.tsx)
    if (g && drinksData) {
      const catsWithDrinks = new Set(drinksData.map((d: any) => d.category));
      const catNames = [g.name_category_1, g.name_category_2, g.name_category_3, g.name_category_4];
      const cats = ([1, 2, 3, 4] as const)
        .filter((cat) => catsWithDrinks.has(cat))
        .map((cat) => ({ category: cat, name: catNames[cat - 1] || `Categorie ${cat}` }));
      setActiveCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].category);
    }

    if (gm) {
      const userIds = gm.map((m: any) => m.user_id).filter((id: string) => id !== user.id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
      setMembers(profiles || []);
      if (type === 'dm' && otherUserId) {
        setSelectedRecipients(new Set([otherUserId]));
      }
    }
  };

  const handleClose = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(onClose);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRecipients.size === members.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(members.map((m) => m.id)));
    }
  };

  const handleConfirm = () => {
    if (selectedRecipients.size === 0 || !groupId || !selectedCategory) return;
    const cat = activeCategories.find((c) => c.category === selectedCategory);
    const catName = cat?.name || 'streepje';
    // Build recipient names for the message
    const names = members.filter((m) => selectedRecipients.has(m.id)).map((m) => m.full_name);
    const recipientName = names.length <= 2 ? names.join(' en ') : `${names.length} personen`;
    // Send for each recipient
    for (const rid of selectedRecipients) {
      const rName = members.find((m) => m.id === rid)?.full_name || '?';
      onSend(rid, rName, groupId, selectedCategory, quantity, catName);
    }
  };

  const selectedCatName = activeCategories.find((c) => c.category === selectedCategory)?.name || 'streepje';
  const allSelected = members.length > 0 && selectedRecipients.size === members.length;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={go.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>
      <Animated.View style={[go.content, {
        paddingTop: insets.top + 12,
        opacity: anim,
        transform: [{ translateX: Animated.add(goSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
      }]} pointerEvents="auto" {...goPan}>
        {/* Header */}
        <View style={go.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={go.title}>Doneer</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Ontvanger */}
          {type === 'group' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={go.sectionHeader}>AAN WIE?</Text>
                <Pressable onPress={selectAll} hitSlop={8}>
                  <Text style={[go.selectAllText, allSelected && { color: '#00BEAE' }]}>{allSelected ? 'Deselecteer' : 'Iedereen'}</Text>
                </Pressable>
              </View>
              <View style={go.card}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 14 }}>
                  {members.map((m) => {
                    const selected = selectedRecipients.has(m.id);
                    return (
                      <Pressable key={m.id} style={[go.recipientItem, selected && go.recipientSelected]} onPress={() => toggleRecipient(m.id)}>
                        <View>
                          {m.avatar_url ? (
                            <Image source={{ uri: m.avatar_url }} style={go.recipientAvatar} />
                          ) : (
                            <View style={[go.recipientAvatar, go.recipientAvatarFallback]}>
                              <Text style={go.recipientAvatarText}>{m.full_name?.[0]?.toUpperCase()}</Text>
                            </View>
                          )}
                          {selected && (
                            <View style={go.checkBadge}>
                              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                        <Text style={[go.recipientName, selected && { color: '#FFFFFF' }]} numberOfLines={1}>{m.full_name?.split(' ')[0]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
          {type === 'dm' && (
            <>
              <Text style={go.sectionHeader}>AAN</Text>
              <View style={go.card}>
                <View style={go.dmRow}>
                  <View style={[go.recipientAvatar, go.recipientAvatarFallback]}>
                    <Text style={go.recipientAvatarText}>{otherUserName?.[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={go.dmName}>{otherUserName}</Text>
                </View>
              </View>
            </>
          )}

          {/* Categorie */}
          <Text style={go.sectionHeader}>WELK STREEPJE?</Text>
          <View style={go.catRow}>
            {activeCategories.map((cat) => (
              <Pressable key={cat.category} style={[go.catPill, selectedCategory === cat.category && go.catPillActive]} onPress={() => setSelectedCategory(cat.category)}>
                <Text style={[go.catPillText, selectedCategory === cat.category && go.catPillTextActive]}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>

          {/* Hoeveelheid */}
          <Text style={go.sectionHeader}>HOEVEEL?</Text>
          <View style={go.qtyRow}>
            <Pressable style={go.qtyBtn} onPress={() => handleQtyChange(-1)}>
              <Ionicons name="remove" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={go.qtyDisplay}>
              {qtyLayers.map((layer, i) => (
                <Animated.Text
                  key={layer.key}
                  style={[go.qtyValue, i > 0 && go.qtyValueOverlay, {
                    opacity: layer.opacity,
                    transform: [{ scale: layer.scale as any }],
                  }]}
                >
                  {layer.value}
                </Animated.Text>
              ))}
            </View>
            <Pressable style={go.qtyBtn} onPress={() => handleQtyChange(1)}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Bevestig */}
          <Pressable style={[go.confirmBtn, (selectedRecipients.size === 0 || !selectedCategory) && { opacity: 0.4 }]} onPress={handleConfirm} disabled={selectedRecipients.size === 0 || !selectedCategory}>
            <Ionicons name="gift" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={go.confirmText}>Doneer {quantity} {selectedCatName}{selectedRecipients.size > 1 ? ` aan ${selectedRecipients.size}` : ''}</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const go = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF' },
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: 'rgba(78,78,78,0.2)', borderRadius: 25, overflow: 'hidden' },
  recipientItem: { alignItems: 'center', width: 64, paddingVertical: 4, borderRadius: 16 },
  recipientSelected: { backgroundColor: 'rgba(0,217,163,0.2)' },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22 },
  recipientAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  recipientAvatarText: { color: '#333', fontSize: 16, fontWeight: '600' },
  recipientName: { fontFamily: 'Unbounded', fontSize: 10, color: '#848484', marginTop: 4, textAlign: 'center' },
  checkBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#00BEAE', alignItems: 'center', justifyContent: 'center' },
  selectAllText: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginRight: 4, marginTop: 24, marginBottom: 8 },
  dmRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  dmName: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF' },
  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catPill: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.2)' },
  catPillActive: { backgroundColor: '#00BEAE' },
  catPillText: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484' },
  catPillTextActive: { color: '#FFFFFF' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 8 },
  qtyBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(78,78,78,0.2)', alignItems: 'center', justifyContent: 'center' },
  qtyDisplay: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontFamily: 'Unbounded', fontSize: 36, color: '#FFFFFF', textAlign: 'center' },
  qtyValueOverlay: { position: 'absolute' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 25, backgroundColor: '#00BEAE', marginTop: 28 },
  confirmText: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF' },
});

// ── Heart badge overlay ──
function HeartBadge({ count, isMine }: { count: number; isMine: boolean }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[
      dt.heartBadge,
      isMine ? dt.heartBadgeMine : dt.heartBadgeOther,
      { transform: [{ scale: scaleAnim }] },
    ]}>
      <Text style={dt.heartEmoji}>{count > 1 ? `❤️ ${count}` : '❤️'}</Text>
    </Animated.View>
  );
}

function ShimmerText({ text, style }: { text: string; style: any }) {
  const shimmerX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.delay(2000),
      ])
    ).start();
  }, []);
  const translateX = shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  return (
    <MaskedView maskElement={<Text style={[style, { color: '#00BEAE' }]}>{text}</Text>}>
      <Text style={[style, { color: '#00BEAE' }]}>{text}</Text>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.8)', 'white', 'rgba(255,255,255,0.8)', 'transparent']}
          locations={[0, 0.35, 0.5, 0.65, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { width: 60 }]}
        />
      </Animated.View>
    </MaskedView>
  );
}

// ── Memoized chat bubble (prevents re-render when messages array changes) ──
const ChatBubble = React.memo(({ item, nextCreatedAt, isMine, type, conversationId, isNew, likedBy, onDoubleTap }: {
  item: any; nextCreatedAt: string | null; isMine: boolean;
  type: 'dm' | 'group'; conversationId: string; isNew: boolean;
  likedBy: string[]; onDoubleTap: () => void;
}) => {
  const lastTapRef = useRef(0);
  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleTap();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap]);

  const showTime = !nextCreatedAt || (
    Math.abs(new Date(item.created_at).getTime() - new Date(nextCreatedAt).getTime()) > 5 * 60 * 1000
  );
  const hasLikes = likedBy.length > 0;

  if (item.message_type === 'gift') {
    const giftEl = (
      <View>
        {showTime && <Text style={dt.timeSeparator}>{formatMessageTime(item.created_at)}</Text>}
        <View style={dt.giftWrap}>
          <GiftAurora />
          <Text style={dt.giftTitle}>{item.content}</Text>
        </View>
        <Text style={dt.giftSubtitle}>Wees eens gul en doe hetzelfde.</Text>
      </View>
    );
    return isNew ? <AnimatedBubble>{giftEl}</AnimatedBubble> : giftEl;
  }

  // ── Image message ──
  if (item.message_type === 'image' && item.metadata?.image_url) {
    const imgEl = (
      <View>
        {showTime && <Text style={dt.timeSeparator}>{formatMessageTime(item.created_at)}</Text>}
        {!isMine && type === 'group' && (
          <Text style={[dt.bubbleSender, { color: getSenderColor(item.user_id, conversationId) }]}>
            {item.profile?.full_name || 'Onbekend'}
          </Text>
        )}
        <View style={!isMine && type === 'group' ? { flexDirection: 'row', alignItems: 'flex-end' } : undefined}>
          {!isMine && type === 'group' && (
            item.profile?.avatar_url ? (
              <Image source={{ uri: item.profile.avatar_url }} style={dt.bubbleAvatar} />
            ) : (
              <View style={[dt.bubbleAvatar, dt.bubbleAvatarFallback]}>
                <Text style={dt.bubbleAvatarText}>{(item.profile?.full_name || '?')[0]?.toUpperCase()}</Text>
              </View>
            )
          )}
          <Pressable onPress={handlePress}>
            <View style={[{ marginBottom: 8, maxWidth: 240, overflow: 'visible' }, isMine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }, hasLikes && { marginBottom: 18 }]}>
              <View style={{ borderRadius: 16, overflow: 'hidden' }}>
                <Image source={{ uri: item.metadata.image_url }} style={{ width: 240, height: 180 }} resizeMode="cover" />
              </View>
              {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
            </View>
          </Pressable>
        </View>
      </View>
    );
    return isNew ? <AnimatedBubble>{imgEl}</AnimatedBubble> : imgEl;
  }

  const senderName = item.profile?.full_name || 'Onbekend';
  const isBot = item.profile?.full_name === 'Streeps Bot';
  const bubble = (
    <View>
      {showTime && <Text style={dt.timeSeparator}>{formatMessageTime(item.created_at)}</Text>}
      {!isMine && type === 'group' ? (
        <>
          {isBot ? (
            <ShimmerText text="Streeps Bot" style={[dt.bubbleSender, { marginLeft: 28 }]} />
          ) : (
            <Text style={[dt.bubbleSender, { color: getSenderColor(item.user_id, conversationId) }]}>{senderName}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {isBot ? (
              <View style={[dt.bubbleAvatar, { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }]}>
                <BotIcon size={20} color="#00BEAE" />
              </View>
            ) : item.profile?.avatar_url ? (
              <Image source={{ uri: item.profile.avatar_url }} style={dt.bubbleAvatar} />
            ) : (
              <View style={[dt.bubbleAvatar, dt.bubbleAvatarFallback]}>
                <Text style={dt.bubbleAvatarText}>{senderName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Pressable onPress={handlePress}>
              <View style={[dt.bubble, dt.bubbleOther, hasLikes && { marginBottom: 18 }]}>
                <Text style={dt.bubbleText}>{item.content}</Text>
                {hasLikes && <HeartBadge count={likedBy.length} isMine={false} />}
              </View>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={handlePress}>
          <View style={[dt.bubble, isMine ? dt.bubbleMine : dt.bubbleOther, hasLikes && { marginBottom: 18 }]}>
            <Text style={[dt.bubbleText, isMine && { color: '#FFFFFF' }]}>{item.content}</Text>
            {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
          </View>
        </Pressable>
      )}
    </View>
  );
  return isNew ? <AnimatedBubble>{bubble}</AnimatedBubble> : bubble;
});

// ── Skeleton bot bubble with green glow ──
function SkeletonBotBubble() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, []);

  const barOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={{ marginBottom: 8 }}>
      <ShimmerText text="Streeps Bot" style={[dt.bubbleSender, { marginLeft: 28 }]} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={[dt.bubbleAvatar, { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }]}>
          <BotIcon size={20} color="#00BEAE" />
        </View>
        <Animated.View style={[dt.bubble, dt.bubbleOther, {
          shadowColor: '#00FE96',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 8,
          shadowOpacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }),
          elevation: 6,
          borderWidth: 1,
          borderColor: 'rgba(0,190,174,0.25)',
          minWidth: 140,
        }]}>
          <Animated.View style={{ opacity: barOpacity }}>
            <View style={{ width: 110, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,190,174,0.3)', marginBottom: 8 }} />
            <View style={{ width: 80, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,190,174,0.3)', marginBottom: 8 }} />
            <View style={{ width: 50, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,190,174,0.3)' }} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Camera / photo picker overlay (delegates to CameraModal) ──
function CameraOverlay({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (uri: string) => void }) {
  return (
    <CameraModal
      visible={visible}
      onClose={onClose}
      onImageCaptured={(uri) => { onSend(uri); onClose(); }}
    />
  );
}

const AnimatedG = Animated.createAnimatedComponent(G);

function BotIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const eyeX = useRef(new Animated.Value(0)).current;
  const eyeY = useRef(new Animated.Value(0)).current;
  const blinkOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const look = Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(eyeX, { toValue: 2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.delay(1000),
      Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: -2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: -1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(2000),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: -2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(2500),
    ]));

    const blink = Animated.loop(Animated.sequence([
      Animated.delay(3000),
      Animated.timing(blinkOpacity, { toValue: 0, duration: 70, useNativeDriver: false }),
      Animated.timing(blinkOpacity, { toValue: 1, duration: 70, useNativeDriver: false }),
      Animated.delay(5000),
      Animated.timing(blinkOpacity, { toValue: 0, duration: 70, useNativeDriver: false }),
      Animated.timing(blinkOpacity, { toValue: 1, duration: 70, useNativeDriver: false }),
      Animated.delay(2500),
    ]));

    look.start();
    blink.start();
    return () => { look.stop(); blink.stop(); };
  }, []);

  return (
    <Svg width={size} height={size} viewBox="3.87 -1.5 31 33">
      <Path
        d="M 19.37,0 c -8.544,0 -15.5,6.955 -15.5,15.5 V 26.3 c 0,2.594 2.103,4.697 4.697,4.697 3.956,0 7.001,0 10.802,0 8.544,0 15.5,-6.955 15.5,-15.5 0,-8.544 -6.955,-15.5 -15.5,-15.5 z m 0,2.814 c 7.022,0 12.689,5.663 12.689,12.689 0,7.021 -5.663,12.689 -12.689,12.689 H 9.507 A 2.824,2.824 45 0 1 6.676,25.362 v -9.862 c 0,-7.021 5.663,-12.689 12.689,-12.689 z"
        fill={color}
      />
      <AnimatedG translateX={eyeX} translateY={eyeY} opacity={blinkOpacity}>
        <Path d="M 16.353,11.175 v 6" stroke={color} strokeWidth={3.132} strokeLinecap="round" fill="none" />
        <Path d="M 24.353,11.175 v 6" stroke={color} strokeWidth={3.132} strokeLinecap="round" fill="none" />
      </AnimatedG>
    </Svg>
  );
}

// ── Chat detail view (inline, not a separate screen) ──

function ChatDetail({ conversationId, name, avatarUrl, onBack, type, navBarHeight, bottomInset, onProfilePress, onGroupPress, groupId, otherUserId, onGiftPress, botEnabled }: {
  conversationId: string; name: string; avatarUrl: string | null; onBack: () => void;
  type: 'dm' | 'group'; navBarHeight: number; bottomInset: number; onProfilePress?: () => void; onGroupPress?: () => void;
  groupId?: string | null; otherUserId?: string | null; onGiftPress?: () => void; botEnabled?: boolean;
}) {
  const { user } = useAuth();
  const { messages, loadingMore, hasMore, loadMore, sendMessage, sendImage, reactions, toggleLike } = useChatMessages(conversationId);
  const [text, setText] = useState('');
  const seenIds = useRef(new Set<string>()).current;
  const initialLoadDone = useRef(false);
  const prevMsgCountRef = useRef(0);
  const sendBtnAnim = useRef(new Animated.Value(0)).current;
  const [aiMode, setAiMode] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const aiModeAnim = useRef(new Animated.Value(0)).current;
  const BOT_SPLASH_TEXTS = useRef([
    'Wie gaat het hardst?',
    'Roast iemand',
    'Meeste streepjes?',
    'Drinkadvies?',
    'Wat is de stand?',
    'Feitje over bier',
    'Wie moet bijdrinken?',
    'Bedenk een drinkspel',
    'Rate mijn avond',
    'Daag iemand uit',
    'Wie is de lightweight?',
    'Maak een ranking',
    'Wie haakt eerst af?',
    'Excuus voor nog eentje',
    'Welk drankje past bij mij?',
    'Wie verdient een shotje?',
    'Verzin een toast',
    'Te laat of niet?',
    'Hot take over de groep',
    'Wat zou jij drinken?',
  ]).current;
  const [botSplash, setBotSplash] = useState(() => BOT_SPLASH_TEXTS[Math.floor(Math.random() * BOT_SPLASH_TEXTS.length)]);
  const giftPress = usePressScale();
  const sendPress = usePressScale();
  const sendDmPress = usePressScale();
  const aiPress = usePressScale();
  const cameraPress = usePressScale();
  const [showCamera, setShowCamera] = useState(false);

  // Keyboard tracking — iOS only (Android uses adjustResize)
  const restBottom = bottomInset || 12;
  const bottomAnim = useRef(new Animated.Value(restBottom)).current;
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(bottomAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(bottomAnim, {
        toValue: restBottom,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [restBottom]);

  // Clear bot skeleton when bot response arrives
  useEffect(() => {
    if (!waitingForBot) return;
    if (messages[0]?.profile?.full_name === 'Streeps Bot' && !messages[0]?.id.startsWith('temp-')) {
      setWaitingForBot(false);
    }
  }, [messages, waitingForBot]);

  // Seed seenIds: bulk-add on initial load + pagination to prevent animation
  // Only single realtime messages (count grew by exactly 1) should animate
  if (messages.length > 0) {
    if (!initialLoadDone.current) {
      messages.forEach((m) => seenIds.add(m.id));
      initialLoadDone.current = true;
    } else if (messages.length > prevMsgCountRef.current + 1) {
      // Bulk addition (pagination or cache load) — mark all as seen
      messages.forEach((m) => seenIds.add(m.id));
    }
  }
  prevMsgCountRef.current = messages.length;

  const hasText = text.trim().length > 0;

  // Animate button cross-fade
  useEffect(() => {
    Animated.timing(sendBtnAnim, {
      toValue: hasText ? 1 : 0, duration: 200, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }).start();
  }, [hasText]);

  // Turn off AI mode if bot gets disabled
  useEffect(() => {
    if (botEnabled === false && aiMode) setAiMode(false);
  }, [botEnabled]);

  // Animate AI mode glow
  useEffect(() => {
    Animated.timing(aiModeAnim, {
      toValue: aiMode ? 1 : 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
    }).start();
  }, [aiMode]);

  const toggleAiMode = () => { setBotSplash(BOT_SPLASH_TEXTS[Math.floor(Math.random() * BOT_SPLASH_TEXTS.length)]); setAiMode(prev => !prev); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const glowBorderWidth = aiModeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] });
  const glowBorderColor = aiModeAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#00BEAE'] });
  const glowMargin = aiModeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  const glowShadowOpacity = aiModeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(aiMode ? `@bot ${text}` : text);
    setText('');
    if (aiMode) setWaitingForBot(true);
  };

  const giftOpacity = sendBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const sendOpacity = sendBtnAnim;
  const sendScale = sendBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const aiSlide = sendBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 46] });

  const inputBar = (
    <View style={dt.inputBar}>
      <Animated.View style={[dt.inputGlowWrap, { shadowOpacity: glowShadowOpacity }]}>
        <Animated.View style={[dt.inputBlurWrap, { borderWidth: glowBorderWidth, borderColor: glowBorderColor, margin: glowMargin }]}>
          <BlurView intensity={50} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
          <TextInput
            style={[dt.input, { paddingRight: onGiftPress ? 140 : 56 }]}
            value={text}
            onChangeText={setText}
            placeholder={aiMode ? botSplash : 'Bericht...'}
            placeholderTextColor={aiMode ? '#00BEAE' : '#848484'}
            multiline
          />
          {onGiftPress ? (
            <>
              {/* AI button — leftmost (visible when bot is enabled) */}
              {botEnabled !== false && (
                <Animated.View style={[dt.actionBtn, { position: 'absolute', right: 98, bottom: 0, transform: [{ translateX: aiSlide }, { scale: aiPress.scale }] }]}>
                  <Pressable style={dt.actionBtnInner} onPress={toggleAiMode} onPressIn={aiPress.onPressIn} onPressOut={aiPress.onPressOut}>
                    <BotIcon size={22} color={aiMode ? '#00BEB4' : '#FFFFFF'} />
                  </Pressable>
                </Animated.View>
              )}
              {/* Gift button — middle (fades out when typing) */}
              <Animated.View style={[dt.actionBtn, { backgroundColor: '#00BEAE', position: 'absolute', right: 52, bottom: 0, opacity: giftOpacity, transform: [{ scale: giftPress.scale }] }]} pointerEvents={hasText ? 'none' : 'auto'}>
                <Pressable style={dt.actionBtnInner} onPress={onGiftPress} onPressIn={giftPress.onPressIn} onPressOut={giftPress.onPressOut}>
                  <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
              {/* Camera button — rightmost (fades out when typing) */}
              <Animated.View style={[dt.actionBtn, { backgroundColor: 'rgba(78,78,78,0.4)', position: 'absolute', right: 0, bottom: 0, opacity: giftOpacity, transform: [{ scale: cameraPress.scale }] }]} pointerEvents={hasText ? 'none' : 'auto'}>
                <Pressable style={dt.actionBtnInner} onPress={() => { Keyboard.dismiss(); setShowCamera(true); }} onPressIn={cameraPress.onPressIn} onPressOut={cameraPress.onPressOut}>
                  <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
              {/* Send button (fades in when typing, overlays camera position) */}
              <Animated.View style={[dt.actionBtn, { backgroundColor: '#FF0085', position: 'absolute', right: 0, bottom: 0, opacity: sendOpacity, transform: [{ scale: Animated.multiply(sendScale, sendPress.scale) }] }]} pointerEvents={hasText ? 'auto' : 'none'}>
                <Pressable style={dt.actionBtnInner} onPress={handleSend} onPressIn={sendPress.onPressIn} onPressOut={sendPress.onPressOut}>
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
            </>
          ) : (
            /* DM: send button appears inside input when typing */
            <Animated.View style={[dt.actionBtn, { backgroundColor: '#FF0085', position: 'absolute', right: 0, bottom: 0, opacity: sendOpacity, transform: [{ scale: Animated.multiply(sendScale, sendDmPress.scale) }] }]} pointerEvents={hasText ? 'auto' : 'none'}>
              <Pressable style={dt.actionBtnInner} onPress={handleSend} onPressIn={sendDmPress.onPressIn} onPressOut={sendDmPress.onPressOut}>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );

  const messageList = (
    <FadeMask>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 68, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => { if (hasMore && !loadingMore) loadMore(); }}
        onEndReachedThreshold={0.3}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={waitingForBot ? <SkeletonBotBubble /> : null}
        ListFooterComponent={loadingMore ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#FF0085" />
          </View>
        ) : null}
        renderItem={({ item, index }) => {
          const isMine = item.user_id === user?.id;
          const isNew = !isMine && !seenIds.has(item.id);
          seenIds.add(item.id);
          const next = index < messages.length - 1 ? messages[index + 1] : null;
          return (
            <ChatBubble
              item={item}
              nextCreatedAt={next?.created_at ?? null}
              isMine={isMine}
              type={type}
              conversationId={conversationId}
              isNew={isNew}
              likedBy={reactions[item.id] || []}
              onDoubleTap={() => toggleLike(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={dt.empty}>Nog geen berichten</Text>
        }
      />
    </FadeMask>
  );

  return (
    <View style={dt.container}>
      {/* Header */}
      <View style={dt.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable style={dt.headerProfile} onPress={onProfilePress || onGroupPress} disabled={!onProfilePress && !onGroupPress}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={dt.headerAvatar} />
          ) : (
            <View style={[dt.headerAvatar, dt.headerAvatarFallback]}>
              <Text style={dt.headerAvatarText}>{name[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={dt.headerName} numberOfLines={1}>{name}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {messageList}
      </View>
      <Animated.View style={{ height: Platform.OS === 'ios' ? bottomAnim : restBottom }} />
      <Animated.View style={[dt.inputBarWrap, { bottom: Platform.OS === 'ios' ? bottomAnim : restBottom }]}>
        {inputBar}
      </Animated.View>
      <CameraOverlay visible={showCamera} onClose={() => setShowCamera(false)} onSend={(uri) => sendImage(uri)} />
    </View>
  );
}

const dt = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#333', fontSize: 14, fontWeight: '600' },
  headerName: { fontFamily: 'Unbounded', fontSize: 18, color: '#FFFFFF', flex: 1 },
  bubble: { maxWidth: '82%', marginBottom: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#FF0085', borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: 'rgba(78,78,78,0.3)', borderBottomLeftRadius: 4 },
  bubbleSender: { fontFamily: 'Unbounded', fontSize: 11, color: '#00BEAE', marginBottom: 4, marginLeft: 28 },
  bubbleAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 8 },
  bubbleAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarText: { fontSize: 9, fontWeight: '600', color: '#333' },
  bubbleText: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  timeSeparator: { fontFamily: 'Unbounded', fontSize: 10, color: '#848484', textAlign: 'center', marginVertical: 12 },
  empty: { fontFamily: 'Unbounded', color: '#848484', textAlign: 'center', paddingTop: 60, fontSize: 14 },
  inputBarWrap: { position: 'absolute', left: 0, right: 0 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  inputGlowWrap: { flex: 1, borderRadius: 27, shadowColor: '#00FE96', shadowOffset: { width: 0, height: 0 }, shadowRadius: 6.5, elevation: 8 },
  inputBlurWrap: { flex: 1, borderRadius: 25, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  input: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, minHeight: 50, maxHeight: 120 },
  sendBtn: { width: 52, height: 52, borderRadius: 25, backgroundColor: '#FF0085', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', margin: 6 },
  actionBtnInner: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  giftWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 20, width: 390, height: 165 },
  giftTitle: { fontFamily: 'Unbounded', fontSize: 12, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', lineHeight: 18, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  giftSubtitle: { fontFamily: 'Unbounded', fontSize: 10, color: '#848484', textAlign: 'center', marginTop: -5, marginBottom: 16, alignSelf: 'center' },
  heartBadge: { position: 'absolute', bottom: -14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(40,40,40,0.9)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)' },
  heartBadgeMine: { right: 8 },
  heartBadgeOther: { left: 8 },
  heartEmoji: { fontSize: 13 },
});

// ── Profiel overlay (full features from profiel.tsx) ──
function ProfileOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: poSwipeX, panHandlers: poPan } = useSwipeDismiss(onClose, anim);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Animated theme indicator
  const segLayouts = useRef<{ x: number; w: number }[]>([]).current;
  const segX = useRef(new Animated.Value(0)).current;
  const segW = useRef(new Animated.Value(0)).current;
  const segReady = useRef(false);

  const themeOptions = [
    { key: 'system' as const, label: 'Systeem' },
    { key: 'light' as const, label: 'Licht' },
    { key: 'dark' as const, label: 'Donker' },
  ];
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

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name_changed_at, avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setNameChangedAt(data.name_changed_at); setAvatarUrl(data.avatar_url); }
      });
  }, [user]);

  const animateClose = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setShow(false); onClose(); }
    });
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      poSwipeX.setValue(0);
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    } else if (show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => { if (finished) setShow(false); });
    }
  }, [visible]);

  const canChangeName = () => {
    if (!nameChangedAt) return true;
    const diff = (Date.now() - new Date(nameChangedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 30;
  };
  const daysUntilChange = () => {
    if (!nameChangedAt) return 0;
    const next = new Date(nameChangedAt).getTime() + 30 * 86400000;
    return Math.ceil((next - Date.now()) / 86400000);
  };

  const handleStartEdit = () => {
    if (!canChangeName()) { Alert.alert('Naam wijzigen niet mogelijk', `Nog ${daysUntilChange()} dagen wachten.`); return; }
    setNewName(user?.user_metadata?.full_name || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    if (newName.trim() === (user?.user_metadata?.full_name || '')) { setEditingName(false); return; }
    const confirmed = await new Promise<boolean>((r) =>
      Alert.alert('Naam wijzigen', 'Je kunt je naam maar 1x per maand wijzigen. Doorgaan?', [
        { text: 'Annuleren', style: 'cancel', onPress: () => r(false) },
        { text: 'Wijzigen', onPress: () => r(true) },
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

  const [cameraVisible, setCameraVisible] = useState(false);
  const handleOpenCamera = () => setCameraVisible(true);
  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (error) { Alert.alert('Upload mislukt', error.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={po.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={animateClose} />
      </Animated.View>
      <Animated.View style={[po.content, { paddingTop: insets.top + 12, opacity: anim, transform: [{ translateX: Animated.add(poSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] })) }] }]} pointerEvents="auto" {...poPan}>
        <View style={po.header}>
          <Pressable onPress={animateClose} hitSlop={12}><Ionicons name="chevron-back" size={24} color="#FFFFFF" /></Pressable>
          <Text style={po.title}>Profiel</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Avatar */}
          <Pressable style={po.avatarSection} onPress={handleOpenCamera} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={po.avatar} />
            ) : (
              <View style={[po.avatar, po.avatarFallback]}>
                <Text style={po.avatarInitial}>{(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={po.fotoWijzigen}>{uploadingAvatar ? 'Uploaden...' : 'Foto Wijzigen'}</Text>
          </Pressable>

          <Text style={po.displayName}>{user?.user_metadata?.full_name || '-'}</Text>

          {/* PROFIEL section */}
          <Text style={po.sectionHeader}>PROFIEL</Text>
          <View style={po.card}>
            {editingName ? (
              <View style={po.row}>
                <Ionicons name="person-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
                <TextInput style={po.editInput} value={newName} onChangeText={setNewName} autoFocus placeholder="Naam" placeholderTextColor="#848484" />
                <Pressable onPress={handleSaveName} disabled={saving} style={po.editBtn}>
                  <Text style={po.editBtnText}>{saving ? '...' : 'Opslaan'}</Text>
                </Pressable>
                <Pressable onPress={() => setEditingName(false)} style={po.editBtn}>
                  <Text style={po.editCancelText}>Annuleren</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={po.row} onPress={handleStartEdit}>
                <Ionicons name="person-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
                <Text style={po.rowLabel}>Naam</Text>
                <Text style={po.rowValue}>{user?.user_metadata?.full_name || '-'}</Text>
              </Pressable>
            )}
            {!canChangeName() && !editingName && (
              <Text style={po.nameWarning}>Nog {daysUntilChange()} dagen tot je je naam weer kunt wijzigen</Text>
            )}
            <View style={po.divider} />
            <View style={po.row}>
              <Ionicons name="mail-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
              <Text style={po.rowLabel}>E-mail</Text>
              <Text style={po.rowValue} numberOfLines={1}>{user?.email || '-'}</Text>
            </View>
          </View>

          {/* WEERGAVE section */}
          <Text style={po.sectionHeader}>WEERGAVE</Text>
          <View style={po.card}>
            <View style={po.row}>
              <Ionicons name="color-palette-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
              <Text style={po.rowLabel}>Thema</Text>
              <View style={po.segmented}>
                <Animated.View style={[po.segIndicator, { left: segX, width: segW }]} />
                {themeOptions.map((opt, i) => (
                  <Pressable key={opt.key} style={po.segBtn} onPress={() => setPreference(opt.key)}
                    onLayout={(e) => onSegLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}>
                    <Text style={[po.segText, preference === opt.key && po.segActiveText]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={po.divider} />
            <View style={po.row}>
              <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
              <Text style={po.rowLabel}>Versie</Text>
              <Text style={po.rowValue}>1.0.0</Text>
            </View>
          </View>

          {/* Uitloggen */}
          <Pressable style={po.logoutBtn} onPress={() => {
            Alert.alert('Uitloggen', 'Weet je het zeker?', [
              { text: 'Annuleren', style: 'cancel' },
              { text: 'Uitloggen', style: 'destructive', onPress: signOut },
            ]);
          }}>
            <Text style={po.logoutText}>Uitloggen</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />
    </View>
  );
}

const po = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF' },

  // Avatar
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatar: { width: 105, height: 105, borderRadius: 9999 },
  avatarFallback: { backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Unbounded', fontSize: 36, fontWeight: '600', color: '#333' },
  fotoWijzigen: { fontFamily: 'Unbounded', fontSize: 14, color: '#00BEAE', marginTop: 12 },
  displayName: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF', textAlign: 'center', marginTop: 8 },

  // Sections
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: 'rgba(78,78,78,0.2)', borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(78,78,78,0.3)', marginLeft: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 55 },
  rowIcon: { marginRight: 12, width: 20 },
  rowLabel: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', flex: 1 },
  rowValue: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', flexShrink: 1 },

  // Edit name
  editInput: { fontFamily: 'Unbounded', flex: 1, fontSize: 14, color: '#FFFFFF', marginRight: 8 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontFamily: 'Unbounded', color: '#00BEAE', fontSize: 12, fontWeight: '600' },
  editCancelText: { fontFamily: 'Unbounded', color: '#848484', fontSize: 12 },
  nameWarning: { fontFamily: 'Unbounded', color: '#848484', fontSize: 11, paddingHorizontal: 48, paddingBottom: 8 },

  // Theme
  segmented: { flexDirection: 'row', borderRadius: 8, backgroundColor: 'rgba(78,78,78,0.3)', padding: 2 },
  segIndicator: { position: 'absolute', top: 2, bottom: 2, borderRadius: 6, backgroundColor: 'rgba(0,190,174,0.2)' },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  segText: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484' },
  segActiveText: { color: '#00BEAE', fontWeight: '600' },

  // Logout
  logoutBtn: { marginTop: 32, height: 50, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: 'Unbounded', fontSize: 16, color: '#EB5466' },
});

// ── User profile overlay (view other people's profiles) ──
function UserProfileOverlay({ visible, userId, onClose, cachedData, onFriendshipChange }: {
  visible: boolean; userId: string | null; onClose: () => void;
  cachedData?: { profile: any; sharedGroups: any[]; friendshipStatus: string | null; friendshipId: string | null };
  onFriendshipChange?: () => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: upSwipeX, panHandlers: upPan } = useSwipeDismiss(onClose, anim);

  const [profile, setProfile] = useState<any>(null);
  const [sharedGroups, setSharedGroups] = useState<any[]>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  // Avatar zoom state
  const [avatarZoomed, setAvatarZoomed] = useState(false);
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const avatarRef = useRef<View>(null);
  const [avatarLayout, setAvatarLayout] = useState<{ x: number; y: number; size: number } | null>(null);

  const handleAvatarPress = () => {
    if (!profile?.avatar_url) return;
    avatarRef.current?.measureInWindow((_x, y, w) => {
      // X is always screen center (avatar is centered), ignore measured X which may include animated translateX offset
      setAvatarLayout({ x: SCREEN_W / 2, y: y + w / 2, size: w });
      setAvatarZoomed(true);
      zoomAnim.setValue(0);
      Animated.timing(zoomAnim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    });
  };

  const handleAvatarClose = () => {
    Animated.timing(zoomAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setAvatarZoomed(false);
    });
  };

  const animateClose = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setShow(false); onClose(); }
    });
  }, [onClose]);

  useEffect(() => {
    if (visible && userId) {
      upSwipeX.setValue(0);
      // Use cached data immediately if available
      if (cachedData) {
        setProfile(cachedData.profile);
        setSharedGroups(cachedData.sharedGroups);
        setFriendshipStatus(cachedData.friendshipStatus);
        setFriendshipId(cachedData.friendshipId);
      } else {
        fetchProfile();
      }
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    } else if (show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => { if (finished) setShow(false); });
    }
  }, [visible, userId]);

  const fetchProfile = async () => {
    if (!userId || !user) return;
    const [{ data: p }, { data: theirGroups }, { data: myGroups }, { data: f }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', userId).single(),
      supabase.from('group_members').select('group_id').eq('user_id', userId),
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
      supabase.from('friendships').select('id, status, user_id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle(),
    ]);
    setProfile(p);
    const myGroupIds = new Set((myGroups || []).map((g) => g.group_id));
    const sharedIds = (theirGroups || []).filter((g) => myGroupIds.has(g.group_id)).map((g) => g.group_id);
    if (sharedIds.length > 0) {
      const { data: groups } = await supabase.from('groups').select('id, name').in('id', sharedIds);
      setSharedGroups(groups || []);
    } else {
      setSharedGroups([]);
    }
    const status = f?.status === 'pending' && f.user_id !== user.id ? 'pending_incoming' : (f?.status ?? null);
    setFriendshipStatus(status);
    setFriendshipId(f?.id ?? null);
  };

  const handleAddFriend = async () => {
    if (!user || !userId) return;
    const { data } = await supabase.from('friendships').insert({ user_id: user.id, friend_id: userId }).select('id').single();
    setFriendshipStatus('pending');
    if (data) setFriendshipId(data.id);
    onFriendshipChange?.();
  };

  const handleAcceptFriend = async () => {
    if (!friendshipId) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setFriendshipStatus('accepted');
    onFriendshipChange?.();
  };

  const handleCancelFriend = async () => {
    if (!friendshipId) return;
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setFriendshipStatus(null);
    setFriendshipId(null);
    onFriendshipChange?.();
  };

  const handleRemoveFriend = () => {
    Alert.alert('Vriend verwijderen', `Weet je zeker dat je ${profile?.full_name || 'deze persoon'} wilt verwijderen als vriend?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: handleCancelFriend },
    ]);
  };

  if (!show || !userId) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={up.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={animateClose} />
      </Animated.View>
      <Animated.View style={[up.content, {
        paddingTop: insets.top + 12,
        opacity: anim,
        transform: [{ translateX: Animated.add(upSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
      }]} pointerEvents="auto" {...upPan}>
        <View style={up.header}>
          <Pressable onPress={animateClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={up.title}>Profiel</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Avatar */}
          <View style={up.avatarSection}>
            <Pressable onPress={handleAvatarPress} ref={avatarRef}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={up.avatar} />
              ) : (
                <View style={[up.avatar, up.avatarFallback]}>
                  <Text style={up.avatarInitial}>{profile?.full_name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            </Pressable>
          </View>
          <Text style={up.displayName}>{profile?.full_name || 'Onbekend'}</Text>

          {/* Shared groups */}
          {sharedGroups.length > 0 && (
            <>
              <Text style={up.sectionHeader}>GEDEELDE GROEPEN</Text>
              <View style={up.card}>
                {sharedGroups.map((g, i) => (
                  <React.Fragment key={g.id}>
                    {i > 0 && <View style={up.divider} />}
                    <View style={up.groupRow}>
                      <Text style={up.groupName}>{g.name}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Friend status / add button */}
          <AnimatedFriendButton
            status={friendshipStatus}
            onAdd={handleAddFriend}
            onCancel={handleCancelFriend}
            onAccept={handleAcceptFriend}
            onRemove={handleRemoveFriend}
            userId={userId}
          />
        </ScrollView>
      </Animated.View>

      {/* Avatar zoom overlay */}
      {avatarZoomed && avatarLayout && profile?.avatar_url && (() => {
        const targetSize = SCREEN_W - 40;
        const scaleFrom = avatarLayout.size / targetSize;
        const centerX = SCREEN_W / 2;
        const centerY = SCREEN_H / 2;
        const translateXFrom = avatarLayout.x - centerX;
        const translateYFrom = avatarLayout.y - centerY;
        return (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.85)', opacity: zoomAnim }]} pointerEvents="auto">
              <Pressable style={StyleSheet.absoluteFillObject} onPress={handleAvatarClose} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={{
              position: 'absolute',
              left: centerX - targetSize / 2,
              top: centerY - targetSize / 2,
              width: targetSize,
              height: targetSize,
              borderRadius: targetSize / 2,
              overflow: 'hidden',
              transform: [
                { translateX: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [translateXFrom, 0] }) },
                { translateY: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [translateYFrom, 0] }) },
                { scale: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) },
              ],
            }}>
              <Image source={{ uri: profile.avatar_url }} style={{ width: targetSize, height: targetSize }} />
            </Animated.View>
          </View>
        );
      })()}
    </View>
  );
}

const up = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF' },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatar: { width: 105, height: 105, borderRadius: 9999 },
  avatarFallback: { backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Unbounded', fontSize: 36, fontWeight: '600', color: '#333' },
  displayName: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF', textAlign: 'center', marginTop: 8 },
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: 'rgba(78,78,78,0.2)', borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(78,78,78,0.3)', marginLeft: 16 },
  groupRow: { paddingHorizontal: 16, paddingVertical: 14 },
  groupName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  friendBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  friendBadgeText: { fontFamily: 'Unbounded', fontSize: 14, color: '#00BEAE' },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, height: 50, borderRadius: 25, backgroundColor: '#FF0085' },
  addFriendBtnText: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
});

// ── Animated friend button for profile overlay ──
function AnimatedFriendButton({ status, onAdd, onCancel, onAccept, onRemove, userId }: { status: string | null; onAdd: () => void; onCancel: () => void; onAccept?: () => void; onRemove?: () => void; userId?: string | null }) {
  const progress = useRef(new Animated.Value(status === 'pending' ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const prevUserId = useRef(userId);
  const prevStatus = useRef(status);

  useEffect(() => {
    const userChanged = userId !== prevUserId.current;
    prevUserId.current = userId;

    if (userChanged) {
      // Profiel-wissel: instant reset, geen animatie
      progress.setValue(status === 'pending' ? 1 : 0);
      bounce.setValue(0);
      prevStatus.current = status;
      return;
    }

    // Zelfde profiel, status veranderd door gebruikersactie
    if (status === prevStatus.current) return;
    const wasPending = prevStatus.current === 'pending';
    prevStatus.current = status;

    if (status === 'pending') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.sequence([
          Animated.spring(bounce, { toValue: 1, damping: 8, stiffness: 400, mass: 0.8, useNativeDriver: false }),
          Animated.spring(bounce, { toValue: 0, damping: 12, stiffness: 200, useNativeDriver: false }),
        ]),
      ]).start();
    } else if (status === null && wasPending) {
      Animated.timing(progress, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }
  }, [userId, status]);

  const btnWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [280, 250] });
  const btnBg = progress.interpolate({ inputRange: [0, 1], outputRange: ['#FF0085', 'rgba(78,78,78,0.2)'] });
  const btnHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [50, 48] });
  const bounceScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const addOpacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const pendingOpacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  if (status === 'accepted') {
    return (
      <View style={{ alignItems: 'center', marginTop: 24, gap: 12 }}>
        <View style={up.friendBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#00BEAE" />
          <Text style={up.friendBadgeText}>Vrienden</Text>
        </View>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={{ fontFamily: 'Unbounded', fontSize: 12, color: '#848484' }}>Vriend verwijderen</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (status === 'pending_incoming') {
    return (
      <View style={{ alignSelf: 'center', marginTop: 24 }}>
        <Pressable onPress={onAccept} style={{
          width: 280, height: 50, borderRadius: 25, backgroundColor: '#00BEAE',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={up.addFriendBtnText}>Accepteren</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View style={{ alignSelf: 'center', marginTop: 24, transform: [{ scale: bounceScale }] }}>
      <Pressable onPress={status === 'pending' ? onCancel : onAdd}>
        <Animated.View style={{
          width: btnWidth,
          height: btnHeight,
          borderRadius: 25,
          backgroundColor: btnBg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <Animated.View style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', opacity: addOpacity }}>
            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={up.addFriendBtnText}>Voeg toe als vriend</Text>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pendingOpacity }}>
            <Ionicons name="time-outline" size={18} color="#848484" />
            <Text style={[up.friendBadgeText, { color: '#848484' }]}>Verzoek verstuurd</Text>
            <Ionicons name="close" size={16} color="#848484" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Group profile overlay ──
function GroupProfileOverlay({ visible, groupId, onClose, onViewProfile, cachedData, onBotToggle }: {
  visible: boolean; groupId: string | null; onClose: () => void;
  onViewProfile: (userId: string) => void;
  cachedData?: { group: any; members: any[]; activeCategories?: any[] };
  onBotToggle?: (groupId: string, enabled: boolean) => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: gpSwipeX, panHandlers: gpPan } = useSwipeDismiss(onClose, anim);

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [botEnabled, setBotEnabled] = useState(true);

  const isAdmin = members.some((m) => m.user_id === user?.id && m.is_admin);

  const handleToggleBot = async (value: boolean) => {
    setBotEnabled(value);
    if (groupId) {
      await supabase.from('groups').update({ bot_enabled: value }).eq('id', groupId);
      onBotToggle?.(groupId, value);
    }
  };

  const animateClose = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setShow(false); onClose(); }
    });
  }, [onClose]);

  useEffect(() => {
    if (visible && groupId) {
      gpSwipeX.setValue(0);
      if (cachedData) {
        setGroup(cachedData.group);
        setMembers(cachedData.members);
        setBotEnabled(cachedData.group?.bot_enabled !== false);
      } else {
        fetchGroup();
      }
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    } else if (show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => { if (finished) setShow(false); });
    }
  }, [visible, groupId]);

  const fetchGroup = async () => {
    if (!groupId) return;
    const [{ data: g }, { data: gm }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id, is_admin, joined_at').eq('group_id', groupId),
    ]);
    setGroup(g);
    setBotEnabled(g?.bot_enabled !== false);
    if (gm && gm.length > 0) {
      const userIds = gm.map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      setMembers(gm.map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) })));
    }
  };

  const handleShare = async () => {
    if (!group) return;
    try {
      await Share.share({ message: `Join ${group.name} op Streeps! Code: ${group.invite_code}` });
    } catch {}
  };

  if (!show || !groupId) return null;

  const createdDate = group?.created_at
    ? new Date(group.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={gp.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={animateClose} />
      </Animated.View>
      <Animated.View style={[gp.content, {
        paddingTop: insets.top + 12,
        opacity: anim,
        transform: [{ translateX: Animated.add(gpSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
      }]} pointerEvents="auto" {...gpPan}>
        <View style={gp.header}>
          <Pressable onPress={animateClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={gp.title}>Groep</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Avatar */}
          <View style={gp.avatarSection}>
            {group?.avatar_url ? (
              <Image source={{ uri: group.avatar_url }} style={gp.avatar} />
            ) : (
              <View style={[gp.avatar, gp.avatarFallback]}>
                <Text style={gp.avatarInitial}>{group?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </View>
          <Text style={gp.displayName}>{group?.name || ''}</Text>
          <Text style={gp.memberCount}>{members.length} {members.length === 1 ? 'lid' : 'leden'}</Text>

          {/* Leden */}
          <Text style={gp.sectionHeader}>LEDEN</Text>
          <View style={gp.card}>
            {members.map((m, i) => (
              <React.Fragment key={m.user_id}>
                {i > 0 && <View style={gp.divider} />}
                <Pressable style={gp.memberRow} onPress={() => { if (m.user_id !== user?.id) onViewProfile(m.user_id); }}>
                  {m.profile?.avatar_url ? (
                    <Image source={{ uri: m.profile.avatar_url }} style={gp.memberAvatar} />
                  ) : (
                    <View style={[gp.memberAvatar, gp.memberAvatarFallback]}>
                      <Text style={gp.memberAvatarText}>{m.profile?.full_name?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                  )}
                  <Text style={gp.memberName} numberOfLines={1}>{m.profile?.full_name || 'Onbekend'}</Text>
                  {m.user_id === user?.id && <Text style={gp.youBadge}>Jij</Text>}
                  {m.is_admin && (
                    <View style={gp.adminBadge}>
                      <Text style={gp.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  {m.user_id !== user?.id && <Ionicons name="chevron-forward" size={16} color="#848484" />}
                </Pressable>
              </React.Fragment>
            ))}
          </View>

          {/* Uitnodigen */}
          <Text style={gp.sectionHeader}>UITNODIGEN</Text>
          <View style={gp.card}>
            <View style={gp.inviteRow}>
              <Ionicons name="key-outline" size={20} color="#FFFFFF" style={{ marginRight: 12, width: 20 }} />
              <Text style={gp.inviteCode}>{group?.invite_code || ''}</Text>
            </View>
            <View style={gp.divider} />
            <Pressable style={gp.inviteRow} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#00BEAE" style={{ marginRight: 12, width: 20 }} />
              <Text style={gp.shareText}>Deel uitnodiging</Text>
            </Pressable>
          </View>

          {/* Instellingen (admin only) */}
          {isAdmin && (
            <>
              <Text style={gp.sectionHeader}>INSTELLINGEN</Text>
              <View style={gp.card}>
                <View style={gp.settingRow}>
                  <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <BotIcon size={20} color="#FFFFFF" />
                  </View>
                  <Text style={gp.settingLabel}>Bot (@bot)</Text>
                  <Switch
                    value={botEnabled}
                    onValueChange={handleToggleBot}
                    trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                    thumbColor="#FFFFFF"
                    style={{ transform: [{ translateY: -1 }] }}
                  />
                </View>
              </View>
            </>
          )}

          {/* Aangemaakt */}
          {createdDate ? (
            <Text style={gp.createdAt}>Aangemaakt op {createdDate}</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const gp = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF' },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatar: { width: 105, height: 105, borderRadius: 9999 },
  avatarFallback: { backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Unbounded', fontSize: 36, fontWeight: '600', color: '#333' },
  displayName: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF', textAlign: 'center', marginTop: 8 },
  memberCount: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484', textAlign: 'center', marginTop: 4 },
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: 'rgba(78,78,78,0.2)', borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(78,78,78,0.3)', marginLeft: 64 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  memberAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#333', fontSize: 14, fontWeight: '600' },
  memberName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', flex: 1 },
  youBadge: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484', marginRight: 8 },
  adminBadge: { backgroundColor: 'rgba(0,190,174,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  adminBadgeText: { fontFamily: 'Unbounded', fontSize: 10, color: '#00BEAE', fontWeight: '600' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 55 },
  inviteCode: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', letterSpacing: 2 },
  shareText: { fontFamily: 'Unbounded', fontSize: 14, color: '#00BEAE' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 55 },
  settingLabel: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', flex: 1, lineHeight: 20 },
  createdAt: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', textAlign: 'center', marginTop: 24 },
});

// ── Animated row wrapper for fade-out + collapse ──
function AnimatedRow({ removing, onRemoved, children }: { removing: boolean; onRemoved: () => void; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const measuredHeight = useRef(0);
  const heightAnim = useRef(new Animated.Value(1)).current;

  const onLayout = useCallback((e: any) => {
    if (measuredHeight.current === 0) {
      measuredHeight.current = e.nativeEvent.layout.height;
    }
  }, []);

  useEffect(() => {
    if (removing) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(scale, { toValue: 0.95, duration: 200, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: 0, duration: 250, delay: 100, useNativeDriver: false }),
      ]).start(() => onRemoved());
    }
  }, [removing]);

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, measuredHeight.current || 84],
  });

  return (
    <Animated.View style={{ opacity, maxHeight: removing ? maxHeight : undefined, overflow: 'hidden' }} onLayout={onLayout}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// ── Animated accept/reject buttons for incoming requests ──
function AnimatedAcceptReject({ accepting, onAccept, onReject, onAnimationComplete }: { accepting: boolean; onAccept: () => void; onReject: () => void; onAnimationComplete?: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const wasAccepting = useRef(false);

  useEffect(() => {
    if (accepting && !wasAccepting.current) {
      wasAccepting.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(content, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.spring(bounce, { toValue: 1, damping: 8, stiffness: 400, mass: 0.8, useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 0, damping: 12, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => { if (finished && onAnimationComplete) onAnimationComplete(); });
    }
  }, [accepting]);

  const btnWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 36] });
  const btnBg = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', '#00BEAE'] });
  const btnsOpacity = content.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });
  const checkOpacity = content.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const bounceScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  return (
    <Animated.View style={{ transform: [{ scale: bounceScale }] }}>
      <Animated.View style={{
        width: btnWidth, height: 36, borderRadius: 18,
        backgroundColor: btnBg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {/* Original buttons (fade out) */}
        <Animated.View style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: btnsOpacity }}>
          <Pressable style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00BEAE', alignItems: 'center', justifyContent: 'center' }} onPress={onAccept} disabled={accepting}>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(78,78,78,0.3)', alignItems: 'center', justifyContent: 'center' }} onPress={onReject} disabled={accepting}>
            <Ionicons name="close" size={18} color="#848484" />
          </Pressable>
        </Animated.View>
        {/* Checkmark (fade in) */}
        <Animated.View style={{ position: 'absolute', opacity: checkOpacity }}>
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Animated button: single button morphs from wide pink → round grey ──
const ADD_BTN_W = 110;
const SENT_BTN_W = 36;

function AnimatedSuggestionButton({ pending, onAdd }: { pending: boolean; onAdd: () => void }) {
  // JS driver: width + backgroundColor (can't use native driver for these)
  const progress = useRef(new Animated.Value(pending ? 1 : 0)).current;
  // Native driver: content opacity transitions
  const content = useRef(new Animated.Value(pending ? 1 : 0)).current;
  // Native driver: scale pulse
  const bounce = useRef(new Animated.Value(0)).current;
  const wasPending = useRef(pending);

  useEffect(() => {
    if (pending && !wasPending.current) {
      wasPending.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(content, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.spring(bounce, { toValue: 1, damping: 8, stiffness: 400, mass: 0.8, useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 0, damping: 12, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (!pending && wasPending.current) {
      wasPending.current = false;
      Animated.parallel([
        Animated.timing(progress, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(content, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [pending]);

  // Button shape (JS driver)
  const btnWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [ADD_BTN_W, SENT_BTN_W] });
  const btnBg = progress.interpolate({ inputRange: [0, 1], outputRange: ['#FF0085', 'rgba(78,78,78,0.3)'] });

  // Content opacity (native driver)
  const addContentOpacity = content.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const checkOpacity = content.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  // Scale pulse (native driver)
  const bounceScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  return (
    <Animated.View style={{ transform: [{ scale: bounceScale }] }}>
      <Pressable onPress={pending ? undefined : onAdd} disabled={pending}>
        <Animated.View style={{
          width: btnWidth,
          height: 36,
          borderRadius: 18,
          backgroundColor: btnBg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Add content: icon + text */}
          <Animated.View style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, opacity: addContentOpacity }}>
            <Ionicons name="person-add" size={14} color="#FFFFFF" />
            <Text style={ap.addBtnText}>Voeg toe</Text>
          </Animated.View>
          {/* Check content: checkmark */}
          <Animated.View style={{ position: 'absolute', opacity: checkOpacity }}>
            <Ionicons name="checkmark" size={18} color="#848484" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Stagger fade-in for person rows after loading ──
function StaggerPersonRow({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, delay: index * 60, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Skeleton loader for person rows ──
function SkeletonPersonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  return (
    <Animated.View style={[ap.personRow, { opacity }]}>
      <View style={[ap.personAvatar, { backgroundColor: 'rgba(78,78,78,0.4)' }]} />
      <View style={{ flex: 1 }}>
        <View style={{ width: 120, height: 13, borderRadius: 6, backgroundColor: 'rgba(78,78,78,0.4)' }} />
        <View style={{ width: 80, height: 11, borderRadius: 5, backgroundColor: 'rgba(78,78,78,0.4)', marginTop: 6 }} />
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(78,78,78,0.3)' }} />
    </Animated.View>
  );
}

// ── Add people / friend requests overlay ──
function AddPeopleOverlay({ visible, onClose, onFriendshipChange, onViewProfile, refreshKey }: { visible: boolean; onClose: () => void; onFriendshipChange: () => void; onViewProfile: (userId: string) => void; refreshKey?: number }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: apSwipeX, panHandlers: apPan } = useSwipeDismiss(onClose, anim);
  const [tab, setTab] = useState<'suggest' | 'requests'>('suggest');

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // Swipeable tab pager
  const AP_TABS = [
    { key: 'suggest' as const, label: 'Toevoegen' },
    { key: 'requests' as const, label: 'Verzoeken' },
  ];
  const apPagerRef = useRef<ScrollView>(null);
  const apScrollX = useRef(new Animated.Value(0)).current;
  const apTabLayouts = useRef<{ x: number; w: number }[]>([]).current;
  const apTabReady = useRef(false);
  const [apTabLayoutsReady, setApTabLayoutsReady] = useState(false);

  const onApTabLayout = useCallback((index: number, x: number, w: number) => {
    apTabLayouts[index] = { x, w };
    if (apTabLayouts.filter(Boolean).length === AP_TABS.length && !apTabReady.current) {
      apTabReady.current = true;
      setApTabLayoutsReady(true);
    }
  }, []);

  const apTabX = apTabLayoutsReady && apTabLayouts[0] && apTabLayouts[1]
    ? apScrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [apTabLayouts[0].x, apTabLayouts[1].x], extrapolate: 'clamp' })
    : new Animated.Value(0);
  const apTabW = apTabLayoutsReady && apTabLayouts[0] && apTabLayouts[1]
    ? apScrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [apTabLayouts[0].w, apTabLayouts[1].w], extrapolate: 'clamp' })
    : new Animated.Value(0);

  const handleApTabPress = (index: number) => {
    setTab(AP_TABS[index].key);
    apPagerRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
  };

  const animateClose = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setShow(false); onClose(); }
    });
  }, [onClose]);

  // Animation (same as ProfileOverlay)
  useEffect(() => {
    if (visible) {
      apSwipeX.setValue(0);
      setTab('suggest');
      apScrollX.setValue(0);
      apPagerRef.current?.scrollTo({ x: 0, animated: false });
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
      fetchData();
    } else if (show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => { if (finished) setShow(false); });
    }
  }, [visible]);

  // Refetch when friendship changes from profile overlay
  useEffect(() => {
    if (show && refreshKey) fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    if (!user) return;
    setLoadingSuggestions(true);

    // 1. Get my groups
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);
    const myGroupIds = (myGroups || []).map((g) => g.group_id);

    // 2. Get my friendships (accepted + pending)
    const { data: myFriendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id, status')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    const friendMap = new Map<string, { status: string; outgoing: boolean }>();
    const pendingOutgoingIds = new Set<string>();
    (myFriendships || []).forEach((f) => {
      const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
      const outgoing = f.user_id === user.id;
      friendMap.set(otherId, { status: f.status, outgoing });
      if (f.status === 'pending' && outgoing) pendingOutgoingIds.add(otherId);
    });
    setPendingIds(pendingOutgoingIds);

    // 3. Get all members of my groups (excluding me and existing friends)
    if (myGroupIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('user_id, group_id')
        .in('group_id', myGroupIds)
        .neq('user_id', user.id);

      // Get group names
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', myGroupIds);
      const groupNameMap = new Map((groups || []).map((g) => [g.id, g.name]));

      // Build suggestions: people not yet friends (keep pending outgoing)
      const suggestionMap = new Map<string, { userId: string; reasons: string[] }>();
      (groupMembers || []).forEach((m) => {
        const f = friendMap.get(m.user_id);
        if (f && (f.status === 'accepted' || (f.status === 'pending' && !f.outgoing))) return;
        const existing = suggestionMap.get(m.user_id);
        const groupName = groupNameMap.get(m.group_id) || '';
        if (existing) {
          if (!existing.reasons.includes(`Zit in ${groupName}`)) {
            existing.reasons.push(`Zit in ${groupName}`);
          }
        } else {
          suggestionMap.set(m.user_id, { userId: m.user_id, reasons: [`Zit in ${groupName}`] });
        }
      });

      // Check mutual friends for each suggestion
      const suggestionIds = [...suggestionMap.keys()];
      if (suggestionIds.length > 0) {
        const { data: theirFriends } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(suggestionIds.map((id) => `user_id.eq.${id},friend_id.eq.${id}`).join(','));

        const myFriendIds = new Set<string>();
        friendMap.forEach((f, id) => { if (f.status === 'accepted') myFriendIds.add(id); });

        (theirFriends || []).forEach((f) => {
          const personId = suggestionIds.includes(f.user_id) ? f.user_id : f.friend_id;
          const theirFriendId = f.user_id === personId ? f.friend_id : f.user_id;
          if (myFriendIds.has(theirFriendId) && suggestionMap.has(personId)) {
            // mutual friend found - we won't add names to keep it simple
            const s = suggestionMap.get(personId)!;
            const mutualLabel = 'Gemeenschappelijke vrienden';
            if (!s.reasons.includes(mutualLabel)) s.reasons.push(mutualLabel);
          }
        });
      }

      // Fetch profiles
      const allIds = [...suggestionMap.keys()];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', allIds);
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
        setSuggestions(allIds.map((id) => ({
          ...profileMap.get(id),
          reasons: suggestionMap.get(id)?.reasons || [],
        })).filter((s) => s.full_name));
      } else {
        setSuggestions([]);
      }
    }

    // 4. Get pending friend requests TO me
    const { data: pendingRequests } = await supabase
      .from('friendships')
      .select('id, user_id, created_at')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (pendingRequests && pendingRequests.length > 0) {
      const reqUserIds = pendingRequests.map((r) => r.user_id);
      const { data: reqProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', reqUserIds);
      const reqProfileMap = new Map((reqProfiles || []).map((p) => [p.id, p]));
      setRequests(pendingRequests.map((r) => ({
        ...r,
        profile: reqProfileMap.get(r.user_id),
      })));
    } else {
      setRequests([]);
    }

    // 5. Get pending friend requests FROM me (outgoing)
    const { data: outgoing } = await supabase
      .from('friendships')
      .select('id, friend_id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (outgoing && outgoing.length > 0) {
      const outIds = outgoing.map((r) => r.friend_id);
      const { data: outProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', outIds);
      const outProfileMap = new Map((outProfiles || []).map((p) => [p.id, p]));
      setOutgoingRequests(outgoing.map((r) => ({
        ...r,
        profile: outProfileMap.get(r.friend_id),
      })));
    } else {
      setOutgoingRequests([]);
    }

    setLoadingSuggestions(false);
  };

  const handleAddFriend = async (userId: string) => {
    if (!user) return;
    const { data } = await supabase.from('friendships').insert({ user_id: user.id, friend_id: userId }).select('id, friend_id, created_at').single();
    setPendingIds((prev) => new Set(prev).add(userId));
    if (data) {
      const person = suggestions.find((s) => s.id === userId);
      setOutgoingRequests((prev) => [...prev, { ...data, profile: person ? { id: person.id, full_name: person.full_name, avatar_url: person.avatar_url } : null }]);
    }
    onFriendshipChange();
  };

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());

  const handleAccept = (friendshipId: string) => {
    setAcceptingIds((prev) => new Set(prev).add(friendshipId));
    supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId).then(() => {
      onFriendshipChange();
    });
  };

  const handleAcceptAnimDone = (friendshipId: string) => {
    setRemovingIds((prev) => new Set(prev).add(friendshipId));
  };

  const handleReject = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setRemovingIds((prev) => new Set(prev).add(friendshipId));
    onFriendshipChange();
  };

  const handleCancelOutgoing = async (friendshipId: string, friendId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setRemovingIds((prev) => new Set(prev).add(friendshipId));
    setPendingIds((prev) => { const next = new Set(prev); next.delete(friendId); return next; });
    onFriendshipChange();
  };

  const finalizeRemoval = (friendshipId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    setOutgoingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    setRemovingIds((prev) => { const next = new Set(prev); next.delete(friendshipId); return next; });
  };

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={ap.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={animateClose} />
      </Animated.View>
      <Animated.View style={[ap.content, {
        paddingTop: insets.top + 12,
        paddingHorizontal: 0,
        opacity: anim,
        transform: [{ translateX: Animated.add(apSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
      }]} pointerEvents="auto">
        {/* Header */}
        <View style={[ap.header, { paddingHorizontal: 20 }]} {...apPan}>
          <Pressable onPress={animateClose} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={ap.title}>Vrienden toevoegen</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab switcher */}
        <View style={[ap.tabBar, { marginHorizontal: 20 }]}>
          <Animated.View style={[ap.tabIndicator, { left: apTabX, width: apTabW }]} />
          {AP_TABS.map((t, i) => {
            const labelText = t.label + (t.key === 'requests' && requests.length > 0 ? ` (${requests.length})` : '');
            const activeOpacity = apScrollX.interpolate({
              inputRange: [0, SCREEN_W],
              outputRange: i === 0 ? [1, 0] : [0, 1],
              extrapolate: 'clamp',
            });
            return (
              <Pressable
                key={t.key}
                style={ap.tabBtn}
                onPress={() => handleApTabPress(i)}
                onLayout={(e) => onApTabLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
              >
                <Text style={ap.tabText}>{labelText}</Text>
                <Animated.Text style={[ap.tabText, ap.tabTextActive, { position: 'absolute', opacity: activeOpacity }]}>
                  {labelText}
                </Animated.Text>
              </Pressable>
            );
          })}
        </View>

        {/* Swipeable content pager */}
        <Animated.ScrollView
          ref={apPagerRef as any}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: apScrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            if (AP_TABS[page]) setTab(AP_TABS[page].key);
          }}
          style={{ flex: 1 }}
        >
          {/* Page 0: Toevoegen */}
          <ScrollView style={{ width: SCREEN_W }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}>
            {loadingSuggestions && suggestions.length === 0 ? (
              <View style={ap.card}>
                {[0, 1, 2, 3].map((i) => (
                  <React.Fragment key={`skel-${i}`}>
                    <SkeletonPersonRow />
                    {i < 3 && <View style={ap.divider} />}
                  </React.Fragment>
                ))}
              </View>
            ) : suggestions.length === 0 ? (
              <Text style={ap.emptyText}>Geen suggesties gevonden</Text>
            ) : (
              <View style={ap.card}>
                {suggestions.map((person, i) => (
                  <StaggerPersonRow key={person.id} index={i}>
                    <Pressable style={ap.personRow} onPress={() => onViewProfile(person.id)}>
                      {person.avatar_url ? (
                        <Image source={{ uri: person.avatar_url }} style={ap.personAvatar} />
                      ) : (
                        <View style={[ap.personAvatar, ap.personAvatarFallback]}>
                          <Text style={ap.personAvatarText}>{person.full_name?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={ap.personName}>{person.full_name}</Text>
                        <Text style={ap.personReason} numberOfLines={1}>{person.reasons.join(' · ')}</Text>
                      </View>
                      <AnimatedSuggestionButton pending={pendingIds.has(person.id)} onAdd={() => handleAddFriend(person.id)} />
                    </Pressable>
                  </StaggerPersonRow>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Page 1: Verzoeken */}
          <ScrollView style={{ width: SCREEN_W }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}>
            {requests.length === 0 && outgoingRequests.length === 0 ? (
              <Text style={ap.emptyText}>Geen openstaande verzoeken</Text>
            ) : (
              <>
                {requests.length > 0 && (
                  <>
                    <Text style={ap.sectionLabel}>Ontvangen</Text>
                    <View style={ap.card}>
                      {requests.map((req, i) => (
                        <AnimatedRow key={req.id} removing={removingIds.has(req.id)} onRemoved={() => finalizeRemoval(req.id)}>
                          <Pressable style={ap.personRow} onPress={() => req.profile?.id && onViewProfile(req.profile.id)}>
                            {req.profile?.avatar_url ? (
                              <Image source={{ uri: req.profile.avatar_url }} style={ap.personAvatar} />
                            ) : (
                              <View style={[ap.personAvatar, ap.personAvatarFallback]}>
                                <Text style={ap.personAvatarText}>{req.profile?.full_name?.[0]?.toUpperCase() || '?'}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={ap.personName}>{req.profile?.full_name || 'Onbekend'}</Text>
                              <Text style={ap.personReason}>Wil je toevoegen als vriend</Text>
                            </View>
                            <AnimatedAcceptReject
                              accepting={acceptingIds.has(req.id)}
                              onAccept={() => handleAccept(req.id)}
                              onReject={() => handleReject(req.id)}
                              onAnimationComplete={() => handleAcceptAnimDone(req.id)}
                            />
                          </Pressable>
                        </AnimatedRow>
                      ))}
                    </View>
                  </>
                )}
                {outgoingRequests.length > 0 && (
                  <>
                    <Text style={[ap.sectionLabel, requests.length > 0 && { marginTop: 20 }]}>Verzonden</Text>
                    <View style={ap.card}>
                      {outgoingRequests.map((req, i) => (
                        <AnimatedRow key={req.id} removing={removingIds.has(req.id)} onRemoved={() => finalizeRemoval(req.id)}>
                          <Pressable style={ap.personRow} onPress={() => req.profile?.id && onViewProfile(req.profile.id)}>
                            {req.profile?.avatar_url ? (
                              <Image source={{ uri: req.profile.avatar_url }} style={ap.personAvatar} />
                            ) : (
                              <View style={[ap.personAvatar, ap.personAvatarFallback]}>
                                <Text style={ap.personAvatarText}>{req.profile?.full_name?.[0]?.toUpperCase() || '?'}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={ap.personName}>{req.profile?.full_name || 'Onbekend'}</Text>
                              <Text style={ap.personReason}>Verzoek verstuurd</Text>
                            </View>
                            <Pressable style={ap.rejectBtn} onPress={() => handleCancelOutgoing(req.id, req.friend_id)}>
                              <Ionicons name="close" size={18} color="#848484" />
                            </Pressable>
                          </Pressable>
                        </AnimatedRow>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </Animated.ScrollView>
      </Animated.View>
      {/* Edge swipe zone for dismiss (over the ScrollView) */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30 }} {...apPan} />
    </View>
  );
}

const ap = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF' },

  // Tabs
  tabBar: { flexDirection: 'row', height: 50, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.4)', padding: 5, alignItems: 'center', marginBottom: 20 },
  tabIndicator: { position: 'absolute', top: 5, bottom: 5, borderRadius: 20, backgroundColor: 'rgba(255,0,77,0.19)' },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 20 },
  tabText: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484' },
  tabTextActive: { color: '#FF004D' },

  // Card
  card: { borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(78,78,78,0.3)', marginLeft: 80 },

  // Person row
  personRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  personAvatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  personAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: '#333', fontSize: 20, fontWeight: '600' },
  personName: { fontFamily: 'Unbounded', fontSize: 13, color: '#FFFFFF' },
  personReason: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484', marginTop: 2 },

  // Buttons
  addBtn: { flexDirection: 'row', height: 36, borderRadius: 18, backgroundColor: '#FF0085', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 5 },
  addBtnText: { fontFamily: 'Unbounded', fontSize: 11, color: '#FFFFFF' },
  sentBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(78,78,78,0.3)', alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#00BEAE', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  rejectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(78,78,78,0.3)', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },

  sectionLabel: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginBottom: 8, marginLeft: 4 },
  emptyText: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', textAlign: 'center', paddingTop: 40 },
});

// ── Skeleton loading for conversation list ──
const SKELETON_WIDTHS = [
  { name: '55%', preview: '75%' },
  { name: '70%', preview: '60%' },
  { name: '45%', preview: '85%' },
  { name: '60%', preview: '50%' },
  { name: '50%', preview: '70%' },
  { name: '65%', preview: '65%' },
  { name: '40%', preview: '80%' },
];

function ConversationSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ opacity }}>
      {SKELETON_WIDTHS.map((widths, i) => (
        <View key={i} style={sk.row}>
          <View style={sk.avatar} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={[sk.nameLine, { width: widths.name }]} />
              <View style={sk.timeLine} />
            </View>
            <View style={[sk.previewLine, { width: widths.preview }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  nameLine: { height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)' },
  timeLine: { width: 32, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)' },
  previewLine: { height: 12, borderRadius: 6, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
});

// ── Main chat screen ──
export default function ChatScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations, loading, refresh, markAsRead } = useConversations();
  const { contacts, refresh: refreshContacts } = useContacts();

  // Refresh conversations silently when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Manual pull-to-refresh (shows spinner only on user gesture)
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const handleManualRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await refresh();
    setIsManualRefresh(false);
  }, [refresh]);
  const navBarAnim = useNavBarAnim();
  const router = useRouter();
  const params = useLocalSearchParams<{ openDmUserId?: string; openDmName?: string; openDmConvId?: string; openDmAvatar?: string }>();
  const [friendshipRefreshKey, setFriendshipRefreshKey] = useState(0);

  // States
  const [showProfile, setShowProfile] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeConv, setActiveConv] = useState<ConversationPreview | null>(null);
  const activeConvRef = useRef<ConversationPreview | null>(null);
  const markAsReadRef = useRef(markAsRead);
  markAsReadRef.current = markAsRead;
  const [showingChat, setShowingChat] = useState(false);
  const [closingConv, setClosingConv] = useState<ConversationPreview | null>(null);
  const [showAddPeople, setShowAddPeople] = useState(false);

  const openAddPeople = useCallback(() => {
    setShowAddPeople(true);
    Animated.timing(navBarAnim, {
      toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start();
  }, [navBarAnim]);

  const closeAddPeople = useCallback(() => {
    setShowAddPeople(false);
    Animated.timing(navBarAnim, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true,
    }).start();
  }, [navBarAnim]);

  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewGroupId, setViewGroupId] = useState<string | null>(null);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [botEnabledMap, setBotEnabledMap] = useState<Record<string, boolean>>({});
  const profileCache = useRef<Record<string, { profile: any; sharedGroups: any[]; friendshipStatus: string | null; friendshipId: string | null }>>({}).current;
  const groupProfileCache = useRef<Record<string, { group: any; members: any[]; activeCategories: { category: number; name: string }[] }>>({}).current;

  // Fetch pending incoming friend request count
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      setPendingRequestCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase.channel('pending-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${user.id}` }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, friendshipRefreshKey]);

  // Prefetch profile data for DM chats
  const prefetchProfile = useCallback(async (userId: string) => {
    if (!user || profileCache[userId]) return;
    const [{ data: p }, { data: theirGroups }, { data: myGroups }, { data: f }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', userId).single(),
      supabase.from('group_members').select('group_id').eq('user_id', userId),
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
      supabase.from('friendships').select('id, status, user_id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle(),
    ]);
    const myGroupIds = new Set((myGroups || []).map((g) => g.group_id));
    const sharedIds = (theirGroups || []).filter((g) => myGroupIds.has(g.group_id)).map((g) => g.group_id);
    let sharedGroups: any[] = [];
    if (sharedIds.length > 0) {
      const { data: groups } = await supabase.from('groups').select('id, name').in('id', sharedIds);
      sharedGroups = groups || [];
    }
    const status = f?.status === 'pending' && f.user_id !== user.id ? 'pending_incoming' : (f?.status ?? null);
    profileCache[userId] = {
      profile: p,
      sharedGroups,
      friendshipStatus: status,
      friendshipId: f?.id ?? null,
    };
  }, [user]);

  const prefetchGroup = useCallback(async (groupId: string) => {
    if (groupProfileCache[groupId]) return;
    const [{ data: g }, { data: gm }, { data: drinksData }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id, is_admin, joined_at').eq('group_id', groupId),
      supabase.from('drinks').select('category').eq('group_id', groupId).eq('is_available', true),
    ]);
    let members: any[] = [];
    if (gm && gm.length > 0) {
      const userIds = gm.map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      members = gm.map((m: any) => ({ ...m, profile: profileMap.get(m.user_id) }));
    }
    // Compute active categories from drinks
    const catsWithDrinks = new Set((drinksData || []).map((d: any) => d.category));
    const catNames = g ? [g.name_category_1, g.name_category_2, g.name_category_3, g.name_category_4] : [];
    const activeCategories = ([1, 2, 3, 4] as const)
      .filter((cat) => catsWithDrinks.has(cat))
      .map((cat) => ({ category: cat, name: catNames[cat - 1] || `Categorie ${cat}` }));
    groupProfileCache[groupId] = { group: g, members, activeCategories };
    if (g) setBotEnabledMap((prev) => ({ ...prev, [groupId]: g.bot_enabled !== false }));
  }, []);

  // Animations
  const searchAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const navBarHeight = 77 + (insets.bottom || 12) / 2;

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => { if (data) setAvatarUrl(data.avatar_url); });
  }, [user]);

  // ── Open / close chat with animation ──
  const openChat = useCallback((conv: ConversationPreview) => {
    markAsRead(conv.id);
    setActiveConv(conv);
    activeConvRef.current = conv;
    setShowingChat(true);
    slideAnim.setValue(0);
    swipeX.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(navBarAnim, {
        toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
    // Prefetch profile/group data
    if (conv.type === 'dm' && conv.other_user_id) {
      prefetchProfile(conv.other_user_id);
    } else if (conv.type === 'group' && conv.group_id) {
      prefetchGroup(conv.group_id);
    }
  }, [prefetchProfile, prefetchGroup, navBarAnim]);

  // Open DM from route params (e.g. from home screen "Stuur bericht")
  useEffect(() => {
    if (params.openDmConvId && params.openDmUserId) {
      openChat({
        id: params.openDmConvId,
        type: 'dm',
        group_id: null,
        other_user_id: params.openDmUserId,
        name: params.openDmName || '',
        avatar_url: params.openDmAvatar || null,
        last_message: null,
        last_message_at: null,
        last_message_by: null,
        unread: 0,
      });
      router.setParams({ openDmConvId: undefined, openDmUserId: undefined, openDmName: undefined, openDmAvatar: undefined });
    }
  }, [params.openDmConvId]);

  const closeChat = useCallback(() => {
    const convId = activeConv?.id;
    if (convId) markAsRead(convId); // lokaal direct unread=0 + DB write start
    setClosingConv(activeConv);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(navBarAnim, {
        toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true,
      }),
    ]).start(() => {
      swipeX.setValue(0);
      setShowingChat(false);
      setActiveConv(null);
      activeConvRef.current = null;
      setClosingConv(null);
      refresh();
    });
  }, [activeConv, refresh, markAsRead, navBarAnim]);

  // ── Swipe-back PanResponder (same pattern as home.tsx) ──
  const chatPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 8 && gs.moveX < 60 && Math.abs(gs.dy) < 25,
      onPanResponderMove: (_, gs) => { if (gs.dx > 0) swipeX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80 || gs.vx > 0.5) {
          const convId = activeConvRef.current?.id;
          if (convId) markAsReadRef.current(convId); // lokaal direct unread=0
          const remaining = SCREEN_W - gs.dx;
          const velocity = Math.max(gs.vx, 0.5);
          const duration = Math.min(remaining / velocity, 300);
          Animated.parallel([
            Animated.timing(swipeX, {
              toValue: SCREEN_W, duration, easing: Easing.out(Easing.ease), useNativeDriver: true,
            }),
            Animated.timing(navBarAnim, {
              toValue: 0, duration, easing: Easing.out(Easing.ease), useNativeDriver: true,
            }),
          ]).start(() => {
            slideAnim.setValue(0);
            swipeX.setValue(0);
            setShowingChat(false);
            setActiveConv(null);
            activeConvRef.current = null;
            setClosingConv(null);
            refresh();
          });
        } else {
          Animated.spring(swipeX, {
            toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleContactPress = async (contactId: string, contactName: string, contactAvatar: string | null) => {
    if (!user) return;
    try {
      const convId = await startDM(contactId, user.id);
      openChat({
        id: convId, type: 'dm', group_id: null, other_user_id: contactId, name: contactName, avatar_url: contactAvatar,
        last_message: null, last_message_at: null, last_message_by: null, unread: 0,
      });
    } catch (e) {
      console.error('Error starting DM:', e);
    }
  };

  const toggleSearch = () => {
    const next = !searchVisible;
    setSearchVisible(next);
    Animated.timing(searchAnim, {
      toValue: next ? 1 : 0, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
    }).start(() => { if (!next) setSearchText(''); });
  };

  const filtered = searchText
    ? conversations.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
    : conversations;

  const currentConv = activeConv || closingConv;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      {/* ── Conversation list (always mounted) ── */}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Aurora */}
        <View style={cs.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={CHAT_AURORA_COLORS} animated gentle />
        </View>

        {/* Header: avatar + title + search */}
        <View style={cs.header}>
          <Pressable onPress={() => setShowProfile(true)}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={cs.myAvatar} />
            ) : (
              <View style={[cs.myAvatar, cs.myAvatarFallback]}>
                <Text style={cs.myAvatarText}>{(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <Text style={cs.title}>Berichten</Text>
          <Pressable onPress={openAddPeople} hitSlop={12} style={{ marginRight: 6 }}>
            <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
            {pendingRequestCount > 0 && (
              <View style={{
                position: 'absolute', top: -4, right: -4,
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: '#00BEAE',
              }} />
            )}
          </Pressable>
          <Pressable onPress={toggleSearch} hitSlop={12}>
            <Ionicons name={searchVisible ? 'close-outline' : 'search-outline'} size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Search bar */}
        <Animated.View style={[cs.searchWrap, {
          height: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] }),
          opacity: searchAnim,
          marginBottom: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
        }]}>
          <TextInput
            style={cs.searchInput}
            placeholder="Zoek conversatie..."
            placeholderTextColor="#848484"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus={searchVisible}
          />
        </Animated.View>

        {/* Contacts row */}
        {contacts.length > 0 && (
          <View style={{ paddingBottom: 16 }}>
            <Text style={cs.contactsLabel}>Vrienden</Text>
            <FlatList
              horizontal
              data={contacts}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
              renderItem={({ item }) => (
                <Pressable style={cs.contactItem} onPress={() => setViewProfileUserId(item.id)}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={cs.contactAvatar} />
                  ) : (
                    <View style={[cs.contactAvatar, cs.contactAvatarFallback]}>
                      <Text style={cs.contactAvatarText}>{item.full_name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={cs.contactName} numberOfLines={1}>{item.full_name.split(' ')[0]}</Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Conversation list */}
        <FadeMask>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            refreshing={isManualRefresh}
            onRefresh={handleManualRefresh}
            contentContainerStyle={{ paddingTop: 32, paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? (
                <ConversationSkeleton />
              ) : (
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Text style={cs.emptyText}>Nog geen berichten</Text>
                  <Text style={cs.emptySubtext}>Tik op een lid in je groep en stuur een bericht</Text>
                </View>
              )
            }
            renderItem={({ item, index }) => (
              <AnimatedCard index={index} enabled={index < 15}>
              <Pressable
                style={cs.convRow}
                onPress={() => openChat(item)}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={cs.convAvatar} />
                ) : (
                  <View style={[cs.convAvatar, cs.convAvatarFallback]}>
                    <Text style={cs.convAvatarText}>{item.name[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    {item.type === 'group' && <Ionicons name="people" size={14} color="#848484" style={{ marginRight: 6 }} />}
                    <Text style={cs.convName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[cs.convTime, item.unread > 0 && { color: '#00BEAE' }]}>{formatTime(item.last_message_at)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.last_message ? (
                      <Text style={[cs.convPreview, item.unread > 0 && cs.convPreviewUnread]} numberOfLines={1}>
                        {item.type === 'group' && item.last_message_by ? `${item.last_message_by}: ` : ''}
                        {item.last_message}
                      </Text>
                    ) : null}
                    {item.unread > 0 && <View style={cs.unreadDot} />}
                  </View>
                </View>
              </Pressable>
              </AnimatedCard>
            )}
          />
        </FadeMask>
      </View>

      {/* ── Chat detail overlay (slides in from right) ── */}
      {showingChat && currentConv && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, {
            transform: [{
              translateX: Animated.add(
                swipeX,
                slideAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_W, 0] })
              ),
            }],
          }]}
          {...chatPan.panHandlers}
        >
          <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />
          <View style={{ height: insets.top }} />
          <ChatDetail
            conversationId={currentConv.id}
            name={currentConv.name}
            avatarUrl={currentConv.avatar_url}
            onBack={closeChat}
            type={currentConv.type}
            navBarHeight={navBarHeight}
            bottomInset={insets.bottom}
            groupId={currentConv.group_id}
            otherUserId={currentConv.other_user_id}
            onProfilePress={currentConv.other_user_id ? () => setViewProfileUserId(currentConv.other_user_id) : undefined}
            onGroupPress={currentConv.type === 'group' && currentConv.group_id ? () => setViewGroupId(currentConv.group_id) : undefined}
            onGiftPress={currentConv.type === 'group' ? () => { Keyboard.dismiss(); setShowGiftOverlay(true); } : undefined}
            botEnabled={currentConv.group_id ? botEnabledMap[currentConv.group_id] : undefined}
          />
        </Animated.View>
      )}

      {/* Profile overlay */}
      <ProfileOverlay visible={showProfile} onClose={() => setShowProfile(false)} />
      <AddPeopleOverlay visible={showAddPeople} onClose={closeAddPeople} onFriendshipChange={refreshContacts} onViewProfile={(id) => setViewProfileUserId(id)} refreshKey={friendshipRefreshKey} />
      <UserProfileOverlay visible={!!viewProfileUserId} userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} cachedData={viewProfileUserId ? profileCache[viewProfileUserId] : undefined} onFriendshipChange={() => { refreshContacts(); setFriendshipRefreshKey((k) => k + 1); }} />
      <GroupProfileOverlay visible={!!viewGroupId} groupId={viewGroupId} onClose={() => setViewGroupId(null)} onViewProfile={(id) => { setViewGroupId(null); setTimeout(() => setViewProfileUserId(id), 250); }} cachedData={viewGroupId ? groupProfileCache[viewGroupId] : undefined} onBotToggle={(gid, enabled) => setBotEnabledMap((prev) => ({ ...prev, [gid]: enabled }))} />
      {showGiftOverlay && currentConv && (
        <GiftOverlay
          conversationId={currentConv.id}
          type={currentConv.type}
          groupId={currentConv.group_id}
          otherUserId={currentConv.other_user_id}
          otherUserName={currentConv.type === 'dm' ? currentConv.name : undefined}
          cachedData={currentConv.group_id ? groupProfileCache[currentConv.group_id] : undefined}
          onClose={() => setShowGiftOverlay(false)}
          onSend={async (recipientId, recipientName, gId, category, quantity, categoryName) => {
            if (!user) return;
            // Called once per recipient by GiftOverlay
            await sendGiftMessage(user.id, user.user_metadata?.full_name || 'Iemand', currentConv.id, recipientId, recipientName, gId, category, quantity, categoryName);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowGiftOverlay(false); }, 100);
          }}
        />
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  auroraWrap: { position: 'absolute', left: -20, top: 0, zIndex: 0 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 14 },
  myAvatar: { width: 40, height: 40, borderRadius: 20 },
  myAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  myAvatarText: { color: '#333', fontSize: 16, fontWeight: '600' },
  title: { fontFamily: 'Unbounded', fontSize: 24, color: '#FFFFFF', flex: 1 },

  // Search
  searchWrap: { marginHorizontal: 20, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.3)', overflow: 'hidden' },
  searchInput: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', paddingHorizontal: 20, height: 52 },

  // Conversation list
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  convAvatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  convAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  convAvatarText: { color: '#333', fontSize: 18, fontWeight: '600' },
  convName: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', flex: 1, marginRight: 8 },
  convTime: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484' },
  convPreview: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginTop: 3, flex: 1 },
  convPreviewUnread: { color: '#FFFFFF', fontWeight: '600' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00BEAE', marginLeft: 10 },

  // Contacts
  contactsLabel: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484', paddingHorizontal: 20, marginBottom: 10 },
  contactItem: { alignItems: 'center', width: 64 },
  contactAvatar: { width: 52, height: 52, borderRadius: 26 },
  contactAvatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: '#333', fontSize: 18, fontWeight: '600' },
  contactName: { fontFamily: 'Unbounded', fontSize: 11, color: '#FFFFFF', marginTop: 6, textAlign: 'center' },

  // Empty
  emptyText: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF' },
  emptySubtext: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484', marginTop: 6 },
});
