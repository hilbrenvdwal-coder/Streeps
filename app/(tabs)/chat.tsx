import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, View, Text, Pressable, FlatList, TextInput,
  Dimensions, Animated, Easing, ScrollView, Alert, Platform, PanResponder,
  Keyboard, ActivityIndicator, Switch, Modal, InteractionManager,
  AppState, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, streepsMagenta, brand, colors as themeColors, radius as themeRadius, space as themeSpace, typography as themeTypography } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { useConversations, useChatMessages, useContacts, startDM, sendGiftMessage, type ConversationPreview } from '@/src/hooks/useChat';
import { useFollows } from '@/src/hooks/useFollows';
import { useNavBarAnim } from './_layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaskedView from '@react-native-masked-view/masked-view';
import BotIcon from '@/src/components/BotIcon';
import GroupProfileOverlay from '@/src/components/GroupProfileOverlay';
import { useSwipeDismiss } from '@/src/hooks/useSwipeDismiss';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import CameraModal from '@/src/components/CameraModal';
import ImageLightbox, { type ImageLayout } from '@/src/components/ImageLightbox';
import { AnimatedCard } from '@/src/components/AnimatedCard';
import { preloadConversation, scheduleUnload, cancelUnload } from '@/src/hooks/useMessagePreloadCache';
import { BOT_UUID, BOT_DEFAULT_NAME } from '@/src/constants/bot';
import { type BotSettings } from '@/src/constants/botSettings';
import FeedbackOverlay from '@/src/components/FeedbackOverlay';

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

/**
 * Parse een bericht-string en return een array van React nodes waarin **text**
 * als vetgedrukt is gerenderd. Gebruikt binnen een <Text> parent.
 */
function renderMessageText(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.length >= 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
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
type GiftDrink = { id: string; name: string; emoji: string | null; price_override: number | null; category: number };

function GiftOverlay({ conversationId, type, groupId, otherUserId, otherUserName, onClose, onSend, cachedData }: {
  conversationId: string; type: 'dm' | 'group'; groupId?: string | null; otherUserId?: string | null; otherUserName?: string;
  onClose: () => void;
  onSend: (
    recipientId: string,
    recipientName: string,
    groupId: string,
    category: number,
    quantity: number,
    labelName: string,
    drinkId?: string | null,
  ) => void;
  cachedData?: { group: any; members: any[]; activeCategories: { category: number; name: string }[]; drinks?: GiftDrink[] };
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: goSwipeX, scrimOpacity: goScrimOpacity, panHandlers: goPan } = useSwipeDismiss(onClose, anim);

  const [members, setMembers] = useState<any[]>([]);
  const [activeCategories, setActiveCategories] = useState<{ category: number; name: string }[]>([]);
  const [drinks, setDrinks] = useState<GiftDrink[]>([]);
  const [groupData, setGroupData] = useState<any | null>(cachedData?.group ?? null);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set(otherUserId ? [otherUserId] : []));
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedDrink, setSelectedDrink] = useState<GiftDrink | null>(null);
  const [quantity, setQuantity] = useState(1);

  const drinkMode = !!groupData?.drinks_as_categories;

  const getCategoryPrice = (group: any, cat: number): number => {
    if (!group) return 0;
    switch (cat) {
      case 1: return group.price_category_1 ?? 0;
      case 2: return group.price_category_2 ?? 0;
      case 3: return group.price_category_3 ?? 0;
      case 4: return group.price_category_4 ?? 0;
      default: return 0;
    }
  };

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
      if (cachedData.group) setGroupData(cachedData.group);
      if (cachedData.drinks) {
        setDrinks(cachedData.drinks);
        if (cachedData.group?.drinks_as_categories && cachedData.drinks.length > 0) {
          setSelectedDrink(cachedData.drinks[0]);
        }
      }
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
      supabase.from('groups').select('name, name_category_1, name_category_2, name_category_3, name_category_4, price_category_1, price_category_2, price_category_3, price_category_4, drinks_as_categories').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id').eq('group_id', groupId),
      supabase.from('drinks').select('id, name, emoji, price_override, category').eq('group_id', groupId).eq('is_available', true),
    ]);

    if (g) setGroupData(g);

    // Active categories: only those with drinks (same logic as home.tsx)
    if (g && drinksData) {
      const catsWithDrinks = new Set(drinksData.map((d: any) => d.category));
      const catNames = [g.name_category_1, g.name_category_2, g.name_category_3, g.name_category_4];
      const cats = ([1, 2, 3, 4] as const)
        .filter((cat) => catsWithDrinks.has(cat))
        .map((cat) => ({ category: cat, name: catNames[cat - 1] || `Categorie ${cat}` }));
      setActiveCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].category);

      // Drink-mode: full drinks list
      if (g.drinks_as_categories) {
        const drinksFull: GiftDrink[] = drinksData.map((d: any) => ({
          id: d.id, name: d.name, emoji: d.emoji ?? null,
          price_override: d.price_override ?? null, category: d.category ?? 1,
        }));
        setDrinks(drinksFull);
        if (drinksFull.length > 0) setSelectedDrink(drinksFull[0]);
      }
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
    if (selectedRecipients.size === 0 || !groupId) return;
    if (drinkMode) {
      if (!selectedDrink) return;
      const labelName = selectedDrink.name;
      for (const rid of selectedRecipients) {
        const rName = members.find((m) => m.id === rid)?.full_name || '?';
        onSend(rid, rName, groupId, selectedDrink.category, quantity, labelName, selectedDrink.id);
      }
    } else {
      if (!selectedCategory) return;
      const cat = activeCategories.find((c) => c.category === selectedCategory);
      const catName = cat?.name || 'streepje';
      for (const rid of selectedRecipients) {
        const rName = members.find((m) => m.id === rid)?.full_name || '?';
        onSend(rid, rName, groupId, selectedCategory, quantity, catName, null);
      }
    }
  };

  const selectedCatName = activeCategories.find((c) => c.category === selectedCategory)?.name || 'streepje';
  const selectedLabelName = drinkMode ? (selectedDrink?.name || 'drankje') : selectedCatName;
  const confirmDisabled = selectedRecipients.size === 0 || (drinkMode ? !selectedDrink : !selectedCategory);
  const allSelected = members.length > 0 && selectedRecipients.size === members.length;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: goScrimOpacity }]} pointerEvents="auto">
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
                            <Image source={{ uri: m.avatar_url }} style={go.recipientAvatar} transition={200} cachePolicy="memory-disk" />
                          ) : (
                            <AvatarPlaceholder size={44} label={m.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={22} fontSize={16} />
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
                  <AvatarPlaceholder size={44} label={otherUserName?.[0]?.toUpperCase() ?? '?'} borderRadius={22} fontSize={16} />
                  <Text style={go.dmName}>{otherUserName}</Text>
                </View>
              </View>
            </>
          )}

          {/* Categorie / Drank */}
          <Text style={go.sectionHeader}>{drinkMode ? 'WELKE DRANK?' : 'WELK STREEPJE?'}</Text>
          {drinkMode ? (
            <View style={go.catRow}>
              {drinks.map((d) => {
                const active = selectedDrink?.id === d.id;
                const price = d.price_override ?? getCategoryPrice(groupData, d.category);
                const priceLabel = `€${(price / 100).toFixed(2).replace('.', ',')}`;
                return (
                  <Pressable
                    key={d.id}
                    style={[go.catPill, active && go.catPillActive]}
                    onPress={() => setSelectedDrink(d)}
                  >
                    <Text style={[go.catPillText, active && go.catPillTextActive]}>
                      {d.emoji ? `${d.emoji} ` : ''}{d.name} · {priceLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={go.catRow}>
              {activeCategories.map((cat) => (
                <Pressable key={cat.category} style={[go.catPill, selectedCategory === cat.category && go.catPillActive]} onPress={() => setSelectedCategory(cat.category)}>
                  <Text style={[go.catPillText, selectedCategory === cat.category && go.catPillTextActive]}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

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
          <Pressable style={[go.confirmBtn, confirmDisabled && { opacity: 0.4 }]} onPress={handleConfirm} disabled={confirmDisabled}>
            <Ionicons name="gift" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={go.confirmText}>Doneer {quantity} {selectedLabelName}{selectedRecipients.size > 1 ? ` aan ${selectedRecipients.size}` : ''}</Text>
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
const ChatBubble = React.memo(({ item, nextCreatedAt, isMine, type, conversationId, isNew, likedBy, onDoubleTap, onImagePress, botName, onLongPress, isInDeleteMode, onDeletePress, onDismissDeleteMode }: {
  item: any; nextCreatedAt: string | null; isMine: boolean;
  type: 'dm' | 'group'; conversationId: string; isNew: boolean;
  likedBy: string[]; onDoubleTap: () => void;
  onImagePress?: (uri: string, origin: { x: number; y: number; width: number; height: number }) => void;
  botName?: string;
  onLongPress: () => void;
  isInDeleteMode: boolean;
  onDeletePress: () => void;
  onDismissDeleteMode: () => void;
}) => {
  const lastTapRef = useRef(0);
  const imageRef = useRef<View>(null);
  const [imageAspect, setImageAspect] = useState<number>(4 / 3);
  const [showDelete, setShowDelete] = useState(false);
  const deleteAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isInDeleteMode) {
      setShowDelete(true);
      Animated.timing(deleteAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (showDelete) {
      Animated.timing(deleteAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setShowDelete(false);
      });
    }
  }, [isInDeleteMode]);
  const bubbleOpacity = deleteAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const trashTranslateX = deleteAnim.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const trashOpacity = deleteAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const handlePress = useCallback(() => {
    if (isInDeleteMode) {
      onDismissDeleteMode();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleTap();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap, isInDeleteMode, onDismissDeleteMode]);

  // Image-only tap handler: single tap opens lightbox, double tap still likes.
  const handleImageTap = useCallback(() => {
    if (isInDeleteMode) {
      onDismissDeleteMode();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like
      onDoubleTap();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    const tapAt = now;
    setTimeout(() => {
      if (lastTapRef.current === tapAt) {
        lastTapRef.current = 0;
        const uri = item?.metadata?.image_url;
        if (!uri || !onImagePress) return;
        imageRef.current?.measureInWindow((x, y, w, h) => {
          onImagePress(uri, { x, y, width: w, height: h });
        });
      }
    }, 300);
  }, [onDoubleTap, onImagePress, item, isInDeleteMode, onDismissDeleteMode]);

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
    const IMG_MAX_W = 240;
    const IMG_MAX_H = 320;
    let imgW: number;
    let imgH: number;
    if (imageAspect >= IMG_MAX_W / IMG_MAX_H) {
      // Landscape/square → width-bound
      imgW = IMG_MAX_W;
      imgH = IMG_MAX_W / imageAspect;
    } else {
      // Portrait → height-bound
      imgH = IMG_MAX_H;
      imgW = IMG_MAX_H * imageAspect;
    }
    const imgEl = (
      <View>
        {showTime && <Text style={dt.timeSeparator}>{formatMessageTime(item.created_at)}</Text>}
        {!isMine && type === 'group' && (
          <Text style={[dt.bubbleSender, { color: getSenderColor(item.user_id, conversationId) }]}>
            {item.user_id === BOT_UUID ? (botName ?? BOT_DEFAULT_NAME) : (item.profile?.full_name || 'Onbekend')}
          </Text>
        )}
        {isMine ? (
          showDelete ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', maxWidth: '90%' }}>
              <Animated.View style={{ opacity: trashOpacity, transform: [{ translateX: trashTranslateX }] }}>
                <Pressable
                  onPress={onDeletePress}
                  hitSlop={12}
                  style={dt.deleteTrash}
                  accessibilityLabel="Verwijder bericht"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={22} color="#FF4D6D" />
                </Pressable>
              </Animated.View>
              <Pressable onPress={handleImageTap} onLongPress={onLongPress} delayLongPress={400} style={{ flexShrink: 1 }}>
                <Animated.View style={[{ marginBottom: 8, overflow: 'visible', alignSelf: 'flex-end' }, hasLikes && { marginBottom: 18 }, { opacity: bubbleOpacity }]}>
                  <View ref={imageRef} collapsable={false} style={{ width: imgW, height: imgH, borderRadius: 16, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: item.metadata.image_url }}
                      onLoad={(e: any) => {
                        const src = e?.source;
                        if (src && src.width && src.height) {
                          const next = src.width / src.height;
                          if (Math.abs(next - imageAspect) > 0.01) setImageAspect(next);
                        }
                      }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
                </Animated.View>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={handleImageTap} onLongPress={onLongPress} delayLongPress={400}>
              <View style={[{ marginBottom: 8, overflow: 'visible', alignSelf: 'flex-end' }, hasLikes && { marginBottom: 18 }]}>
                <View ref={imageRef} collapsable={false} style={{ width: imgW, height: imgH, borderRadius: 16, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: item.metadata.image_url }}
                    onLoad={(e: any) => {
                      const src = e?.source;
                      if (src && src.width && src.height) {
                        const next = src.width / src.height;
                        if (Math.abs(next - imageAspect) > 0.01) setImageAspect(next);
                      }
                    }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                </View>
                {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
              </View>
            </Pressable>
          )
        ) : (
          <View style={type === 'group' ? { flexDirection: 'row', alignItems: 'flex-end' } : undefined}>
            {type === 'group' && (
              item.profile?.avatar_url ? (
                <Image source={{ uri: item.profile.avatar_url }} style={dt.bubbleAvatar} transition={200} cachePolicy="memory-disk" />
              ) : (
                <AvatarPlaceholder size={20} label={(item.profile?.full_name || '?')[0]?.toUpperCase() ?? '?'} borderRadius={10} fontSize={9} style={dt.bubbleAvatar} />
              )
            )}
            <Pressable onPress={handleImageTap} delayLongPress={400}>
              <View style={[{ marginBottom: 8, overflow: 'visible', alignSelf: 'flex-start' }, hasLikes && { marginBottom: 18 }]}>
                <View ref={imageRef} collapsable={false} style={{ width: imgW, height: imgH, borderRadius: 16, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: item.metadata.image_url }}
                    onLoad={(e: any) => {
                      const src = e?.source;
                      if (src && src.width && src.height) {
                        const next = src.width / src.height;
                        if (Math.abs(next - imageAspect) > 0.01) setImageAspect(next);
                      }
                    }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                </View>
                {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
              </View>
            </Pressable>
          </View>
        )}
      </View>
    );
    return isNew ? <AnimatedBubble>{imgEl}</AnimatedBubble> : imgEl;
  }

  const isBot = item.user_id === BOT_UUID;
  const resolvedBotName = botName ?? BOT_DEFAULT_NAME;
  const senderName = isBot ? resolvedBotName : (item.profile?.full_name || 'Onbekend');
  const bubble = (
    <View>
      {showTime && <Text style={dt.timeSeparator}>{formatMessageTime(item.created_at)}</Text>}
      {!isMine && type === 'group' ? (
        <>
          {isBot ? (
            <ShimmerText text={resolvedBotName} style={[dt.bubbleSender, { marginLeft: 28 }]} />
          ) : (
            <Text style={[dt.bubbleSender, { color: getSenderColor(item.user_id, conversationId) }]}>{senderName}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {isBot ? (
              <View style={[dt.bubbleAvatar, { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }]}>
                <BotIcon size={20} color="#00BEAE" />
              </View>
            ) : item.profile?.avatar_url ? (
              <Image source={{ uri: item.profile.avatar_url }} style={dt.bubbleAvatar} transition={200} cachePolicy="memory-disk" />
            ) : (
              <AvatarPlaceholder size={20} label={senderName[0]?.toUpperCase() ?? '?'} borderRadius={10} fontSize={9} style={dt.bubbleAvatar} />
            )}
            <Pressable onPress={handlePress}>
              <View style={[dt.bubble, dt.bubbleOther, hasLikes && { marginBottom: 18 }]}>
                <Text style={dt.bubbleText}>{renderMessageText(item.content)}</Text>
                {hasLikes && <HeartBadge count={likedBy.length} isMine={false} />}
              </View>
            </Pressable>
          </View>
        </>
      ) : isMine ? (
        showDelete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', maxWidth: '90%' }}>
            <Animated.View style={{ opacity: trashOpacity, transform: [{ translateX: trashTranslateX }] }}>
              <Pressable
                onPress={onDeletePress}
                hitSlop={12}
                style={dt.deleteTrash}
                accessibilityLabel="Verwijder bericht"
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={22} color="#FF4D6D" />
              </Pressable>
            </Animated.View>
            <Pressable onPress={handlePress} onLongPress={onLongPress} delayLongPress={400} style={{ flexShrink: 1 }}>
              <Animated.View style={[dt.bubble, dt.bubbleMine, hasLikes && { marginBottom: 18 }, { maxWidth: undefined, alignSelf: 'auto', opacity: bubbleOpacity }]}>
                <Text style={[dt.bubbleText, { color: '#1A1A1A' }]}>{renderMessageText(item.content)}</Text>
                {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
              </Animated.View>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={handlePress} onLongPress={onLongPress} delayLongPress={400}>
            <View style={[dt.bubble, dt.bubbleMine, hasLikes && { marginBottom: 18 }]}>
              <Text style={[dt.bubbleText, { color: '#1A1A1A' }]}>{renderMessageText(item.content)}</Text>
              {hasLikes && <HeartBadge count={likedBy.length} isMine={isMine} />}
            </View>
          </Pressable>
        )
      ) : (
        <Pressable onPress={handlePress}>
          <View style={[dt.bubble, dt.bubbleOther, hasLikes && { marginBottom: 18 }]}>
            <Text style={dt.bubbleText}>{renderMessageText(item.content)}</Text>
            {hasLikes && <HeartBadge count={likedBy.length} isMine={false} />}
          </View>
        </Pressable>
      )}
    </View>
  );
  return isNew ? <AnimatedBubble>{bubble}</AnimatedBubble> : bubble;
});

// ── Skeleton bot bubble with green glow ──
function SkeletonBotBubble({ botName }: { botName?: string }) {
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
      <ShimmerText text={botName ?? BOT_DEFAULT_NAME} style={[dt.bubbleSender, { marginLeft: 28 }]} />
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
      square={false}
    />
  );
}

// ── Chat detail view (inline, not a separate screen) ──

function ChatDetail({ conversationId, name, avatarUrl, onBack, type, navBarHeight, bottomInset, onProfilePress, onGroupPress, groupId, otherUserId, onGiftPress, botEnabled, botName, adminOnlyChat, isGroupAdmin, lastTallyAt }: {
  conversationId: string; name: string; avatarUrl: string | null; onBack: () => void;
  type: 'dm' | 'group'; navBarHeight: number; bottomInset: number; onProfilePress?: () => void; onGroupPress?: () => void;
  groupId?: string | null; otherUserId?: string | null; onGiftPress?: () => void; botEnabled?: boolean;
  botName?: string;
  adminOnlyChat?: boolean;
  isGroupAdmin?: boolean;
  lastTallyAt?: string | null;
}) {
  const { user } = useAuth();
  const { messages, loading: messagesLoading, loadingMore, hasMore, loadMore, sendMessage, sendImage, reactions, toggleLike, deleteMessage } = useChatMessages(conversationId);
  const [text, setText] = useState('');
  const [deleteModeId, setDeleteModeId] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>()).current;
  const initialLoadDone = useRef(false);
  const prevMsgCountRef = useRef(0);

  const dismissDeleteMode = useCallback(() => setDeleteModeId(null), []);

  const handleLongPress = useCallback((messageId: string, createdAt: string, isMine: boolean, messageType: string) => {
    if (!isMine) return;
    if (messageType === 'gift') return;
    if (messageId.startsWith('temp-')) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs > 10 * 60 * 1000) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteModeId(messageId);
  }, []);

  const handleDeletePress = useCallback(async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      setDeleteModeId(null);
    } catch (e: any) {
      setDeleteModeId(null);
      const msg = e?.message ?? '';
      if (msg.includes('message_too_old')) {
        Alert.alert('Te oud', 'Dit bericht is te oud om te verwijderen.');
      } else {
        Alert.alert('Fout', 'Verwijderen mislukt.');
      }
    }
  }, [deleteMessage]);

  // LIVE indicator — true if a tally was added in this (group) conversation
  // within the last 10 min. Same logic as home.tsx. DMs have no tally signal,
  // so the badge never shows for them.
  const [isLive, setIsLive] = useState(false);
  useEffect(() => {
    const evaluate = () => {
      if (!lastTallyAt) {
        setIsLive(false);
        return null;
      }
      const age = Date.now() - new Date(lastTallyAt).getTime();
      if (age >= LIVE_WINDOW_MS) {
        setIsLive(false);
        return null;
      }
      setIsLive(true);
      return setTimeout(() => setIsLive(false), LIVE_WINDOW_MS - age);
    };
    let timer = evaluate();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (timer) clearTimeout(timer);
        timer = evaluate();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [lastTallyAt]);
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
  const [lightbox, setLightbox] = useState<{ uri: string; origin: ImageLayout } | null>(null);
  const handleImagePress = useCallback((uri: string, origin: ImageLayout) => {
    setLightbox({ uri, origin });
  }, []);

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
    if (messages[0]?.user_id === BOT_UUID && !messages[0]?.id.startsWith('temp-')) {
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

  const adminOnlyLocked = type === 'group' && adminOnlyChat === true && !isGroupAdmin;

  const lockedInputBar = (
    <View style={dt.inputBar}>
      <View style={dt.lockedInputWrap}>
        <BlurView intensity={50} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="lock-closed-outline" size={16} color="#848484" style={{ marginRight: 8 }} />
        <Text style={dt.lockedInputText}>Alleen admins kunnen in deze groep typen</Text>
      </View>
    </View>
  );

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
        extraData={deleteModeId}
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
        ListHeaderComponent={waitingForBot ? <SkeletonBotBubble botName={botName} /> : null}
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
              onImagePress={handleImagePress}
              botName={botName}
              onLongPress={() => handleLongPress(item.id, item.created_at, isMine, item.message_type)}
              isInDeleteMode={deleteModeId === item.id}
              onDeletePress={() => handleDeletePress(item.id)}
              onDismissDeleteMode={dismissDeleteMode}
            />
          );
        }}
        ListEmptyComponent={
          messagesLoading ? null : (
            <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', paddingTop: 40, paddingBottom: 20 }}>
              <Text style={dt.empty}>Nog geen berichten</Text>
              <Text style={[dt.empty, { fontSize: 13, color: '#00BEAE', marginTop: 2 }]}>Start het gesprek!</Text>
            </View>
          )
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
            <Image source={{ uri: avatarUrl }} style={dt.headerAvatar} transition={200} cachePolicy="memory-disk" />
          ) : (
            <AvatarPlaceholder size={36} label={name[0]?.toUpperCase() ?? '?'} borderRadius={18} fontSize={14} />
          )}
          <Text style={dt.headerName} numberOfLines={1}>{name}</Text>
          {isLive && (
            <View style={dt.headerLiveBadge}>
              <View style={dt.headerLiveDot} />
              <Text style={dt.headerLiveText}>LIVE</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {messageList}
      </View>
      <Animated.View style={{ height: Platform.OS === 'ios' ? bottomAnim : restBottom }} />
      <Animated.View style={[dt.inputBarWrap, { bottom: Platform.OS === 'ios' ? bottomAnim : restBottom }]}>
        {adminOnlyLocked ? lockedInputBar : inputBar}
      </Animated.View>
      <CameraOverlay visible={showCamera} onClose={() => setShowCamera(false)} onSend={(uri) => sendImage(uri)} />
      <ImageLightbox
        visible={!!lightbox}
        uri={lightbox?.uri ?? null}
        origin={lightbox?.origin ?? null}
        onClose={() => setLightbox(null)}
      />
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
  headerLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(0,254,150,0.15)',
    marginLeft: 4,
  },
  headerLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FE96' },
  headerLiveText: { fontFamily: 'Unbounded', fontSize: 9, fontWeight: '700', color: '#00FE96', letterSpacing: 0.5 },
  bubble: { maxWidth: '82%', marginBottom: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#D9D9D9', borderBottomRightRadius: 4 },
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
  lockedInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    minHeight: 50,
  },
  lockedInputText: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', textAlign: 'center' },
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
  deleteTrash: {
    marginRight: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Profiel overlay (full features from profiel.tsx) ──
function ProfileOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: poSwipeX, scrimOpacity: poScrimOpacity, panHandlers: poPan } = useSwipeDismiss(onClose, anim);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  const GENDER_OPTIONS = [
    { value: 'man', label: 'Man', icon: 'male-outline' as const },
    { value: 'vrouw', label: 'Vrouw', icon: 'female-outline' as const },
    { value: 'anders', label: 'Anders', icon: 'transgender-outline' as const },
    { value: 'onbekend', label: 'Zeg ik liever niet', icon: 'remove-circle-outline' as const },
  ];
  const genderLabel = (v: string | null) => GENDER_OPTIONS.find((o) => o.value === v)?.label || 'Niet ingesteld';
  const handleSelectGender = async (value: string) => {
    if (!user) return;
    setGender(value);
    setGenderModalVisible(false);
    await supabase.from('profiles').update({ gender: value }).eq('id', user.id);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name_changed_at, avatar_url, gender').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setNameChangedAt(data.name_changed_at);
          setAvatarUrl(data.avatar_url);
          setGender((data as any).gender ?? null);
        }
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

  const [feedbackOverlayVisible, setFeedbackOverlayVisible] = useState(false);

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
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: poScrimOpacity }]} pointerEvents="auto">
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
        <FadeMask>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 32, paddingBottom: 120 }}>
          {/* Avatar */}
          <Pressable style={po.avatarSection} onPress={handleOpenCamera} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={po.avatar} transition={200} cachePolicy="memory-disk" />
            ) : (
              <AvatarPlaceholder size={105} label={(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase() ?? '?'} borderRadius={9999} fontSize={36} />
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
            <View style={po.divider} />
            <Pressable style={po.row} onPress={() => setGenderModalVisible(true)}>
              <Ionicons name="person-circle-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
              <Text style={po.rowLabel}>Geslacht</Text>
              <Text style={[po.rowValue, !gender && { fontStyle: 'italic', color: '#555' }]}>{genderLabel(gender)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#848484" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          <Modal
            visible={genderModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setGenderModalVisible(false)}
          >
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }} onPress={() => setGenderModalVisible(false)}>
              <Pressable
                style={{ backgroundColor: '#1A1A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingBottom: 40, paddingHorizontal: 20 }}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={{ fontFamily: 'Unbounded', fontSize: 18, color: '#FFFFFF', textAlign: 'center', marginBottom: 16 }}>Geslacht</Text>
                {GENDER_OPTIONS.map((opt, i) => (
                  <React.Fragment key={opt.value}>
                    {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' }} />}
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}
                      onPress={() => handleSelectGender(opt.value)}
                    >
                      <Ionicons name={opt.icon} size={20} color={gender === opt.value ? '#00BEAE' : '#FFFFFF'} style={{ marginRight: 12 }} />
                      <Text style={{ fontFamily: 'Unbounded', fontSize: 15, color: gender === opt.value ? '#00BEAE' : '#FFFFFF', flex: 1 }}>
                        {opt.label}
                      </Text>
                      {gender === opt.value && (
                        <Ionicons name="checkmark" size={18} color="#00BEAE" />
                      )}
                    </Pressable>
                  </React.Fragment>
                ))}
                <Pressable style={{ marginTop: 16, paddingVertical: 12, alignItems: 'center' }} onPress={() => setGenderModalVisible(false)}>
                  <Text style={{ fontFamily: 'Unbounded', fontSize: 14, color: '#848484' }}>Annuleren</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* FEEDBACK */}
          <Text style={po.sectionHeader}>FEEDBACK</Text>
          <View style={po.card}>
            <Pressable style={po.row} onPress={() => setFeedbackOverlayVisible(true)}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#FFFFFF" style={po.rowIcon} />
              <Text style={po.rowLabel}>Ik heb een idee of probleem</Text>
              <Ionicons name="chevron-forward" size={16} color="#848484" style={{ marginLeft: 4 }} />
            </Pressable>
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
        </FadeMask>
      </Animated.View>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />

      <FeedbackOverlay
        visible={feedbackOverlayVisible}
        onClose={() => setFeedbackOverlayVisible(false)}
        userId={user?.id ?? null}
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
  card: { overflow: 'hidden' },
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
  const { swipeX: upSwipeX, scrimOpacity: upScrimOpacity, panHandlers: upPan } = useSwipeDismiss(onClose, anim);
  const { isFollowing, follow, unfollow, followedGroups } = useFollows();

  const [profile, setProfile] = useState<any>(null);
  const [sharedGroups, setSharedGroups] = useState<any[]>([]);
  // All groups the friend is a member of (for "Volg"-entrypoint). Only contains
  // public-safe metadata: id/name/avatar/member_count. NEVER exposes the member
  // list, tallies or any tally data from groups the current user is not in.
  const [theirGroups, setTheirGroups] = useState<Array<{ id: string; name: string; avatar_url: string | null; member_count: number }>>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

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
      // Clear stale state FIRST — prevents flash of old profile when switching users
      setProfile(null);
      setSharedGroups([]);
      setTheirGroups([]);
      setFriendshipStatus(null);
      setFriendshipId(null);
      // Use cached data immediately if available
      if (cachedData) {
        setProfile(cachedData.profile);
        setSharedGroups(cachedData.sharedGroups);
        setFriendshipStatus(cachedData.friendshipStatus);
        setFriendshipId(cachedData.friendshipId);
      }
      // Always fetch — cachedData doesn't include `theirGroups`, and we want
      // fresh friendship/group state. `fetchProfile` is a no-op re-setter if
      // the data matches what cachedData already provided.
      fetchIdRef.current += 1;
      const myFetchId = fetchIdRef.current;
      fetchProfile(myFetchId);
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    } else if (show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(({ finished }) => { if (finished) setShow(false); });
    }
  }, [visible, userId]);

  const fetchProfile = async (fetchId: number) => {
    if (!userId || !user) return;
    // Query A-D run in parallel: profile, friend's memberships (with group
    // metadata), my memberships (for `sharedGroups` back-compat), friendship.
    const [{ data: p }, { data: theirMemberships }, { data: myGroups }, { data: f }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', userId).single(),
      supabase
        .from('group_members')
        .select('group_id, groups(id, name, avatar_url)')
        .eq('user_id', userId),
      supabase.from('group_members').select('group_id').eq('user_id', user.id),
      supabase.from('friendships').select('id, status, user_id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle(),
    ]);
    if (fetchId !== fetchIdRef.current) return;
    setProfile(p);

    // Normalise the `groups(...)` PostgREST join (can be object or array).
    type GroupRow = { id: string; name: string; avatar_url: string | null };
    const pickGroup = (g: GroupRow | GroupRow[] | null | undefined): GroupRow | null => {
      if (!g) return null;
      if (Array.isArray(g)) return g[0] ?? null;
      return g;
    };
    const friendGroups: GroupRow[] = ((theirMemberships ?? []) as Array<{ group_id: string; groups: GroupRow | GroupRow[] | null }>)
      .map((row) => pickGroup(row.groups))
      .filter((g): g is GroupRow => g !== null);

    // Legacy `sharedGroups` output — still used elsewhere as a quick fallback.
    const myGroupIds = new Set((myGroups || []).map((g) => g.group_id));
    const sharedGroupsData = friendGroups
      .filter((g) => myGroupIds.has(g.id))
      .map(({ id, name }) => ({ id, name }));
    setSharedGroups(sharedGroupsData);

    // Enrich with member counts for the follow-entrypoint list. One batched
    // query: fetch all `group_members` rows for the friend's groups, then
    // count client-side. Avoids N+1 per group.
    const friendGroupIds = friendGroups.map((g) => g.id);
    if (friendGroupIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', friendGroupIds);
      if (fetchId !== fetchIdRef.current) return;
      const counts = new Map<string, number>();
      for (const row of (memberRows ?? []) as { group_id: string }[]) {
        counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
      }
      setTheirGroups(
        friendGroups.map((g) => ({
          id: g.id,
          name: g.name,
          avatar_url: g.avatar_url ?? null,
          member_count: counts.get(g.id) ?? 0,
        })),
      );
    } else {
      setTheirGroups([]);
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
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: upScrimOpacity }]} pointerEvents="auto">
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
                <Image source={{ uri: profile.avatar_url }} style={up.avatar} transition={200} cachePolicy="memory-disk" />
              ) : (
                <AvatarPlaceholder size={105} label={profile?.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={9999} fontSize={36} />
              )}
            </Pressable>
          </View>
          <Text style={up.displayName}>{profile?.full_name || 'Onbekend'}</Text>

          {/* Groups the friend is a member of — entrypoint to follow */}
          {theirGroups.length > 0 && (() => {
            const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'VRIEND';
            return (
              <>
                <Text style={up.sectionHeader}>{`GROEPEN VAN ${firstName.toUpperCase()}`}</Text>
                <View style={up.card}>
                  {theirGroups.map((g, i) => {
                    const followedEntry = followedGroups.find((fg) => fg.id === g.id);
                    const isMember = followedEntry?.isMember === true;
                    const isFollowed = isFollowing(g.id);
                    return (
                      <React.Fragment key={g.id}>
                        {i > 0 && <View style={up.divider} />}
                        <FriendGroupRow
                          group={g}
                          isMember={isMember}
                          isFollowed={isFollowed}
                          onFollow={() => follow(g.id).catch(() => undefined)}
                          onUnfollow={() => {
                            Alert.alert(
                              'Niet meer volgen?',
                              `Stop met het volgen van ${g.name}?`,
                              [
                                { text: 'Annuleren', style: 'cancel' },
                                {
                                  text: 'Niet meer volgen',
                                  style: 'destructive',
                                  onPress: () => { unfollow(g.id).catch(() => undefined); },
                                },
                              ],
                            );
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            );
          })()}

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
              <Image source={{ uri: profile.avatar_url }} style={{ width: targetSize, height: targetSize }} transition={200} cachePolicy="memory-disk" />
            </Animated.View>
          </View>
        );
      })()}
    </View>
  );
}

// Row component used inside `UserProfileOverlay` for the friend's groups list.
// Not extracted to a separate file per scope — visually inspired by
// FollowedGroupRow but simpler (no last-activity subline, no navigation on tap).
function FriendGroupRow({
  group,
  isMember,
  isFollowed,
  onFollow,
  onUnfollow,
}: {
  group: { id: string; name: string; avatar_url: string | null; member_count: number };
  isMember: boolean;
  isFollowed: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  const avatarSize = 40;
  return (
    <View style={friendGroupRow.row}>
      {group.avatar_url ? (
        <Image
          source={{ uri: group.avatar_url }}
          style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <AvatarPlaceholder
          size={avatarSize}
          label={group.name[0]?.toUpperCase() ?? '?'}
          borderRadius={avatarSize / 2}
          fontSize={16}
        />
      )}
      <View style={friendGroupRow.middle}>
        <Text style={friendGroupRow.name} numberOfLines={1}>{group.name}</Text>
        <Text style={friendGroupRow.sub} numberOfLines={1}>{`${group.member_count} leden`}</Text>
      </View>
      {isMember ? (
        <Text style={friendGroupRow.inlineInactiveText}>Jij zit erin</Text>
      ) : isFollowed ? (
        <Pressable
          onPress={onUnfollow}
          hitSlop={8}
          style={({ pressed }) => [friendGroupRow.followingPill, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Niet meer volgen"
        >
          <Text style={friendGroupRow.followingPillText}>Volgend</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onFollow}
          hitSlop={8}
          style={({ pressed }) => [friendGroupRow.followBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Volg ${group.name}`}
        >
          <Text style={friendGroupRow.followBtnText}>Volg</Text>
        </Pressable>
      )}
    </View>
  );
}

const friendGroupRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: themeSpace[4],
    paddingVertical: themeSpace[3],
    gap: themeSpace[3],
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: themeColors.dark.text.primary,
  },
  sub: {
    ...themeTypography.caption,
    color: brand.inactive,
    marginTop: 2,
  },
  inlineInactiveText: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    color: brand.inactive,
  },
  followingPill: {
    paddingHorizontal: themeSpace[3],
    paddingVertical: themeSpace[1],
    borderRadius: themeRadius.full,
    borderWidth: 1,
    borderColor: brand.cyan,
  },
  followingPillText: {
    ...themeTypography.captionMedium,
    color: brand.cyan,
  },
  followBtn: {
    paddingHorizontal: themeSpace[4],
    paddingVertical: themeSpace[2],
    borderRadius: themeRadius.full,
    backgroundColor: brand.cyan,
  },
  followBtnText: {
    ...themeTypography.captionMedium,
    color: themeColors.dark.text.primary,
  },
});

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
  const hasUserActed = useRef(false);

  useEffect(() => {
    const userChanged = userId !== prevUserId.current;
    prevUserId.current = userId;

    if (userChanged) {
      // Profiel-wissel: instant reset, geen animatie
      progress.setValue(status === 'pending' ? 1 : 0);
      bounce.setValue(0);
      prevStatus.current = status;
      hasUserActed.current = false;
      return;
    }

    if (status === prevStatus.current) return;

    const wasPending = prevStatus.current === 'pending';
    const didUserAct = hasUserActed.current;
    hasUserActed.current = false;
    prevStatus.current = status;

    if (!didUserAct) {
      // Data-driven change: instant sync, geen animatie
      progress.setValue(status === 'pending' ? 1 : 0);
      bounce.setValue(0);
      return;
    }

    // User-driven change: animatie afspelen
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

  const wrap = (cb?: () => void) => () => { hasUserActed.current = true; cb?.(); };

  if (status === 'accepted') {
    return (
      <View style={{ alignItems: 'center', marginTop: 24, gap: 12 }}>
        <View style={up.friendBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#00BEAE" />
          <Text style={up.friendBadgeText}>Vrienden</Text>
        </View>
        {onRemove && (
          <Pressable onPress={wrap(onRemove)} hitSlop={8}>
            <Text style={{ fontFamily: 'Unbounded', fontSize: 12, color: '#848484' }}>Vriend verwijderen</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (status === 'pending_incoming') {
    return (
      <View style={{ alignSelf: 'center', marginTop: 24 }}>
        <Pressable onPress={wrap(onAccept)} style={{
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
      <Pressable onPress={status === 'pending' ? wrap(onCancel) : wrap(onAdd)}>
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
  const { swipeX: apSwipeX, scrimOpacity: apScrimOpacity, panHandlers: apPan } = useSwipeDismiss(onClose, anim);
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
  };

  const handleCancelOutgoing = async (friendshipId: string, friendId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setRemovingIds((prev) => new Set(prev).add(friendshipId));
    setPendingIds((prev) => { const next = new Set(prev); next.delete(friendId); return next; });
  };

  const finalizeRemoval = (friendshipId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    setOutgoingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    setRemovingIds((prev) => { const next = new Set(prev); next.delete(friendshipId); return next; });
    onFriendshipChange();
  };

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: apScrimOpacity }]} pointerEvents="auto">
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
          <View style={{ width: SCREEN_W, flex: 1 }}>
          <FadeMask>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 32, paddingBottom: 120, paddingHorizontal: 20 }}>
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
                        <Image source={{ uri: person.avatar_url }} style={ap.personAvatar} transition={200} cachePolicy="memory-disk" />
                      ) : (
                        <AvatarPlaceholder size={52} label={person.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={26} fontSize={20} style={ap.personAvatar} />
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
          </FadeMask>
          </View>

          {/* Page 1: Verzoeken */}
          <View style={{ width: SCREEN_W, flex: 1 }}>
          <FadeMask>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 32, paddingBottom: 120, paddingHorizontal: 20 }}>
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
                              <Image source={{ uri: req.profile.avatar_url }} style={ap.personAvatar} transition={200} cachePolicy="memory-disk" />
                            ) : (
                              <AvatarPlaceholder size={52} label={req.profile?.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={26} fontSize={20} style={ap.personAvatar} />
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
                              <Image source={{ uri: req.profile.avatar_url }} style={ap.personAvatar} transition={200} cachePolicy="memory-disk" />
                            ) : (
                              <AvatarPlaceholder size={52} label={req.profile?.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={26} fontSize={20} style={ap.personAvatar} />
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
          </FadeMask>
          </View>
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
  tabIndicator: { position: 'absolute', top: 5, bottom: 5, borderRadius: 20, backgroundColor: streepsMagenta + '30' },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 20 },
  tabText: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484', fontWeight: '500' },
  tabTextActive: { color: streepsMagenta },

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
const LIVE_WINDOW_MS = 10 * 60 * 1000;
// LIVE = a tally was added in the group within the last 10 minutes.
// Only applies to group chats; DMs have no tally activity signal.
const isConvLive = (lastTallyAt: string | null | undefined) => {
  if (!lastTallyAt) return false;
  return Date.now() - new Date(lastTallyAt).getTime() < LIVE_WINDOW_MS;
};

export default function ChatScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations, loading, refresh, markAsRead } = useConversations();
  const { contacts, refresh: refreshContacts } = useContacts();

  // Tick every 30s so the LIVE badges in the overview re-evaluate.
  // Also force a tick when the app returns from background so stale
  // badges flip off immediately on resume.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') forceTick((t) => t + 1);
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

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
  const [botNameMap, setBotNameMap] = useState<Record<string, string>>({});
  const [adminOnlyChatMap, setAdminOnlyChatMap] = useState<Record<string, boolean>>({});
  const [groupAdminMap, setGroupAdminMap] = useState<Record<string, boolean>>({});
  const [drinksAsCategoriesMap, setDrinksAsCategoriesMap] = useState<Record<string, boolean>>({});
  const profileCache = useRef<Record<string, { profile: any; sharedGroups: any[]; friendshipStatus: string | null; friendshipId: string | null }>>({}).current;
  const groupProfileCache = useRef<Record<string, { group: any; members: any[]; activeCategories: { category: number; name: string }[]; drinks?: { id: string; name: string; emoji: string | null; price_override: number | null; category: number }[] }>>({}).current;

  // Preload messages for visible conversations
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50, minimumViewTime: 300 }).current;
  const onViewableItemsChanged = useCallback(({ changed }: { viewableItems: any[]; changed: any[] }) => {
    changed.forEach((token: any) => {
      const convId = token.item?.id;
      if (!convId) return;
      if (token.isViewable) { cancelUnload(convId); preloadConversation(convId); }
      else { scheduleUnload(convId); }
    });
  }, []);

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
      supabase.from('drinks').select('id, name, emoji, price_override, category').eq('group_id', groupId).eq('is_available', true),
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
    // Keep full drinks list for drink-mode gift selection
    const drinksFull = (drinksData || []).map((d: any) => ({
      id: d.id, name: d.name, emoji: d.emoji ?? null,
      price_override: d.price_override ?? null, category: d.category ?? 1,
    }));
    groupProfileCache[groupId] = { group: g, members, activeCategories, drinks: drinksFull };
    if (g) {
      setBotEnabledMap((prev) => ({ ...prev, [groupId]: g.bot_enabled !== false }));
      setBotNameMap((prev) => ({ ...prev, [groupId]: g.bot_name ?? BOT_DEFAULT_NAME }));
      setAdminOnlyChatMap((prev) => ({ ...prev, [groupId]: g.admin_only_chat === true }));
      setDrinksAsCategoriesMap((prev) => ({ ...prev, [groupId]: g.drinks_as_categories === true }));
    }
    if (user && members.length > 0) {
      const me = members.find((m: any) => m.user_id === user.id);
      setGroupAdminMap((prev) => ({ ...prev, [groupId]: !!me?.is_admin }));
    }
  }, [user]);

  // Animations
  const searchAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;

  const OVERVIEW_PARALLAX = -SCREEN_W * 0.3;

  const overviewTranslateX = useMemo(() => {
    const baseSlide = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, OVERVIEW_PARALLAX],
    });

    const swipeCorrection = swipeX.interpolate({
      inputRange: [0, SCREEN_W],
      outputRange: [0, -OVERVIEW_PARALLAX],
      extrapolate: 'clamp',
    });

    return Animated.add(baseSlide, swipeCorrection);
  }, [slideAnim, swipeX]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const navBarHeight = 77 + (insets.bottom || 12) / 2;

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => { if (data) setAvatarUrl(data.avatar_url); });
  }, [user]);

  // ── Open / close chat with animation ──
  const openChat = useCallback((conv: ConversationPreview) => {
    InteractionManager.runAfterInteractions(() => markAsRead(conv.id));
    setActiveConv(conv);
    activeConvRef.current = conv;
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
    // Mount ChatDetail after first frame to avoid jank during slide animation
    requestAnimationFrame(() => {
      setShowingChat(true);
    });
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
        last_tally_at: null,
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
        last_message: null, last_message_at: null, last_message_by: null, last_tally_at: null, unread: 0,
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
      <LinearGradient colors={[brand.bg.from, brand.bg.to]} style={StyleSheet.absoluteFillObject} />

      {/* ── Conversation list (always mounted) ── */}
      <Animated.View style={{ flex: 1, paddingTop: insets.top, transform: [{ translateX: overviewTranslateX }] }}>
        {/* Aurora */}
        <View style={cs.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={CHAT_AURORA_COLORS} animated gentle />
        </View>

        {/* Header: avatar + title + search */}
        <View style={cs.header}>
          <Pressable onPress={() => setShowProfile(true)}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={cs.myAvatar} transition={200} cachePolicy="memory-disk" />
            ) : (
              <AvatarPlaceholder size={40} label={(user?.user_metadata?.full_name ?? '?')[0]?.toUpperCase() ?? '?'} borderRadius={20} fontSize={16} />
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
                    <Image source={{ uri: item.avatar_url }} style={cs.contactAvatar} transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <AvatarPlaceholder size={52} label={item.full_name[0]?.toUpperCase() ?? '?'} borderRadius={26} fontSize={18} />
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
            contentContainerStyle={{ paddingTop: 24, paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
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
                  <Image source={{ uri: item.avatar_url }} style={cs.convAvatar} transition={200} cachePolicy="memory-disk" />
                ) : (
                  <AvatarPlaceholder size={54} label={item.name[0]?.toUpperCase() ?? '?'} borderRadius={27} fontSize={18} style={cs.convAvatar} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    {item.type === 'group' && <Ionicons name="people" size={14} color="#848484" style={{ marginRight: 6 }} />}
                    <Text style={cs.convName} numberOfLines={1}>{item.name}</Text>
                    {isConvLive(item.last_tally_at) && (
                      <View style={cs.liveBadge}>
                        <View style={cs.liveDot} />
                        <Text style={cs.liveBadgeText}>LIVE</Text>
                      </View>
                    )}
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
      </Animated.View>

      {/* ── Chat detail overlay (slides in from right) ── */}
      {showingChat && currentConv && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H,
            transform: [{
              translateX: Animated.add(
                swipeX,
                slideAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_W, 0] })
              ),
            }],
          }}
          {...chatPan.panHandlers}
        >
          <LinearGradient colors={[brand.bg.from, brand.bg.to]} style={StyleSheet.absoluteFillObject} />
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
            botName={currentConv.group_id ? botNameMap[currentConv.group_id] : undefined}
            adminOnlyChat={currentConv.group_id ? adminOnlyChatMap[currentConv.group_id] === true : false}
            isGroupAdmin={currentConv.group_id ? groupAdminMap[currentConv.group_id] === true : false}
            lastTallyAt={currentConv.last_tally_at}
          />
        </Animated.View>
      )}

      {/* Profile overlay */}
      <ProfileOverlay visible={showProfile} onClose={() => setShowProfile(false)} />
      <AddPeopleOverlay visible={showAddPeople} onClose={closeAddPeople} onFriendshipChange={refreshContacts} onViewProfile={(id) => setViewProfileUserId(id)} refreshKey={friendshipRefreshKey} />
      <UserProfileOverlay visible={!!viewProfileUserId} userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} cachedData={viewProfileUserId ? profileCache[viewProfileUserId] : undefined} onFriendshipChange={() => { refreshContacts(); setFriendshipRefreshKey((k) => k + 1); }} />
      <GroupProfileOverlay visible={!!viewGroupId} groupId={viewGroupId} onClose={() => setViewGroupId(null)} onViewProfile={(id) => { setViewGroupId(null); setTimeout(() => setViewProfileUserId(id), 250); }} cachedData={viewGroupId ? groupProfileCache[viewGroupId] : undefined} onBotToggle={(gid, enabled) => { setBotEnabledMap((prev) => ({ ...prev, [gid]: enabled })); if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, bot_enabled: enabled }; }} onBotNameChange={(gid, newName) => { setBotNameMap((prev) => ({ ...prev, [gid]: newName })); if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, bot_name: newName }; }} onAdminOnlyChatChange={(gid, enabled) => { setAdminOnlyChatMap((prev) => ({ ...prev, [gid]: enabled })); if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, admin_only_chat: enabled }; }} onTallyAnnouncementsChange={(gid, enabled) => { if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, tally_announcements_enabled: enabled }; }} onSettlementAnnouncementsChange={(gid, enabled) => { if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, settlement_announcements_enabled: enabled }; }} onBotWelcomeChange={(gid, enabled) => { if (groupProfileCache[gid]?.group) groupProfileCache[gid].group = { ...groupProfileCache[gid].group, bot_welcome_enabled: enabled }; }} onBotSettingsChange={(gid: string, settings: BotSettings) => { if (groupProfileCache[gid]) { groupProfileCache[gid] = { ...groupProfileCache[gid], group: { ...groupProfileCache[gid].group, bot_settings: settings } }; } }} />
      {showGiftOverlay && currentConv && (
        <GiftOverlay
          conversationId={currentConv.id}
          type={currentConv.type}
          groupId={currentConv.group_id}
          otherUserId={currentConv.other_user_id}
          otherUserName={currentConv.type === 'dm' ? currentConv.name : undefined}
          cachedData={currentConv.group_id ? groupProfileCache[currentConv.group_id] : undefined}
          onClose={() => setShowGiftOverlay(false)}
          onSend={async (recipientId, recipientName, gId, category, quantity, labelName, drinkId) => {
            if (!user) return;
            // Called once per recipient by GiftOverlay
            await sendGiftMessage(user.id, user.user_metadata?.full_name || 'Iemand', currentConv.id, recipientId, recipientName, gId, category, quantity, labelName, drinkId);
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

  // LIVE badge
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(0,254,150,0.15)',
    marginRight: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FE96' },
  liveBadgeText: { fontFamily: 'Unbounded', fontSize: 9, fontWeight: '700', color: '#00FE96', letterSpacing: 0.5 },

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
