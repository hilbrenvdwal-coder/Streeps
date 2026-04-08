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
  PanResponder,
  LayoutAnimation,
  Modal,
  Platform,
  UIManager,
} from 'react-native';
import type { GestureResponderEvent, LayoutRectangle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import CameraModal from '@/src/components/CameraModal';
import { supabase } from '@/src/lib/supabase';
import * as Haptics from 'expo-haptics';
import type { Theme } from '@/src/theme';

interface Member {
  id: string;
  user_id: string;
  is_admin: boolean;
  is_active: boolean;
  profile?: { full_name?: string; avatar_url?: string | null } | null;
}

interface Drink {
  id: string;
  name: string;
  category: number;
  emoji: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  group: any;
  groupId: string;
  members: Member[];
  drinks: Drink[];
  currentUserId?: string;
  theme: Theme;
  categoryColors: readonly string[];
  updateGroupPrices: (data: Record<string, any>) => Promise<void>;
  updateGroupName: (name: string) => Promise<void>;
  addDrink: (name: string, category: number, emoji: string) => Promise<void>;
  removeDrink: (drinkId: string) => Promise<void>;
  toggleAdmin: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  regenerateInviteCode: () => Promise<void>;
  deleteGroup: () => Promise<void>;
  leaveGroup: () => Promise<void>;
  removeOwnAdmin: () => Promise<void>;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  // Tally management
  tallyCounts?: Record<string, Record<number, number>>;
  recentTallies?: any[];
  addTally?: (category: 1|2|3|4, userId?: string) => Promise<void>;
  removeTally?: (tallyId: string) => Promise<void>;
  activeCategories?: number[];
  getCategoryName?: (cat: number) => string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Converteer centen (integer) naar euro display string met Nederlandse komma-notatie */
function centsToEuroStr(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Converteer euro input string (accepteert komma of punt) naar centen. Retourneert null bij ongeldige invoer. */
function euroStrToCents(str: string): number | null {
  if (!str.trim()) return null;
  const normalized = str.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0.01 || parsed > 99.99) return null;
  return Math.round(parsed * 100);
}

/** Format een euro input string naar netjes 2-decimalen Nederlandse notatie */
function formatEuroStr(str: string): string | null {
  const cents = euroStrToCents(str);
  if (cents == null) return null;
  return (cents / 100).toFixed(2).replace('.', ',');
}

function CategoryBadgeSelector({
  value,
  onChange,
  colors,
  enabledCategories,
  getCategoryName,
  onScrollEnable,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: readonly string[];
  enabledCategories: number[];
  getCategoryName?: (cat: number) => string;
  onScrollEnable?: (enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const isDragModeRef = useRef(false);
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);
  const [badgePos, setBadgePos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const badgeRef = useRef<View>(null);

  const enabledCategoriesRef = useRef(enabledCategories);
  const onChangeRef = useRef(onChange);
  const onScrollEnableRef = useRef(onScrollEnable);
  const chipLayoutsRef = useRef<Record<number, LayoutRectangle>>({});
  const hoveredCatRef = useRef<number | null>(null);

  useEffect(() => { isDragModeRef.current = isDragMode; }, [isDragMode]);
  useEffect(() => { enabledCategoriesRef.current = enabledCategories; }, [enabledCategories]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onScrollEnableRef.current = onScrollEnable; }, [onScrollEnable]);
  useEffect(() => { hoveredCatRef.current = hoveredCat; }, [hoveredCat]);

  const color = colors[(value - 1) % colors.length];
  const label = getCategoryName?.(value) ?? `Cat ${value}`;

  const measureAndOpen = useCallback((drag: boolean) => {
    badgeRef.current?.measureInWindow((x, y, width, height) => {
      setBadgePos({ x, y, width, height });
      setIsDragMode(drag);
      setHoveredCat(null);
      hoveredCatRef.current = null;
      setExpanded(true);
      onScrollEnableRef.current?.(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
  }, []);

  const handleTapOpen = useCallback(() => measureAndOpen(false), [measureAndOpen]);
  const handleLongPressOpen = useCallback(() => measureAndOpen(true), [measureAndOpen]);

  const handleSelect = useCallback((cat: number) => {
    onChangeRef.current(cat);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(false);
    setIsDragMode(false);
    setHoveredCat(null);
    hoveredCatRef.current = null;
    onScrollEnableRef.current?.(true);
  }, []);

  const handleClose = useCallback(() => {
    setExpanded(false);
    setIsDragMode(false);
    setHoveredCat(null);
    hoveredCatRef.current = null;
    onScrollEnableRef.current?.(true);
  }, []);

  const handleChipLayout = useCallback((cat: number, layout: LayoutRectangle) => {
    chipLayoutsRef.current[cat] = layout;
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => isDragModeRef.current,
    onMoveShouldSetPanResponder: () => isDragModeRef.current,
    onStartShouldSetPanResponderCapture: () => isDragModeRef.current,
    onMoveShouldSetPanResponderCapture: () => isDragModeRef.current,
    onPanResponderMove: (evt: GestureResponderEvent) => {
      if (!isDragModeRef.current) return;
      const fingerY = evt.nativeEvent.pageY;
      const cats = enabledCategoriesRef.current;
      let found: number | null = null;
      for (const cat of cats) {
        const layout = chipLayoutsRef.current[cat];
        if (layout && fingerY >= layout.y && fingerY <= layout.y + layout.height) {
          found = cat;
          break;
        }
      }
      if (found !== hoveredCatRef.current) {
        hoveredCatRef.current = found;
        setHoveredCat(found);
        if (found !== null) Haptics.selectionAsync();
      }
    },
    onPanResponderRelease: () => {
      if (!isDragModeRef.current) return;
      if (hoveredCatRef.current !== null) {
        handleSelect(hoveredCatRef.current);
      } else {
        handleClose();
      }
    },
    onPanResponderTerminate: () => handleClose(),
  })).current;

  const selectedIndex = enabledCategories.indexOf(value);
  const chipHeight = 40;
  const chipGap = 8;
  const listTop = badgePos.y - (selectedIndex >= 0 ? selectedIndex : 0) * (chipHeight + chipGap);

  return (
    <>
      <View ref={badgeRef} collapsable={false}>
        <Pressable
          onPress={handleTapOpen}
          onLongPress={handleLongPressOpen}
          delayLongPress={300}
          style={[cbs.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}
        >
          <View style={[cbs.badgeDot, { backgroundColor: color }]} />
          <Text style={[cbs.badgeLabel, { color }]} numberOfLines={1}>{label}</Text>
        </Pressable>
      </View>

      <Modal visible={expanded} transparent statusBarTranslucent animationType="fade" onRequestClose={handleClose}>
        <View style={cbs.modalRoot} {...panResponder.panHandlers}>
          <Pressable style={cbs.scrim} onPress={handleClose} pointerEvents={isDragMode ? 'none' : 'auto'} />

          <View style={[cbs.chipList, { top: listTop }]} pointerEvents={isDragMode ? 'none' : 'auto'}>
            {enabledCategories.map((cat) => {
              const catColor = colors[(cat - 1) % colors.length];
              const catLabel = getCategoryName?.(cat) ?? `Cat ${cat}`;
              const isSelected = cat === value;
              const isHovered = hoveredCat === cat;
              const highlighted = isSelected || isHovered;
              return (
                <Pressable
                  key={cat}
                  onPress={() => handleSelect(cat)}
                  onLayout={(e) => {
                    (e.target as any).measureInWindow?.((x: number, y: number, w: number, h: number) => {
                      handleChipLayout(cat, { x, y, width: w, height: h });
                    });
                  }}
                  style={[
                    cbs.chip,
                    { backgroundColor: catColor + '20' },
                    highlighted && { borderWidth: 2, borderColor: '#FFFFFF', transform: [{ scale: 1.08 }] },
                    !highlighted && { borderWidth: 2, borderColor: 'transparent' },
                  ]}
                >
                  <View style={[cbs.chipDot, { backgroundColor: catColor }]} />
                  <Text style={[cbs.chipLabel, { color: highlighted ? '#FFFFFF' : catColor }]} numberOfLines={1}>{catLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const cbs = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, alignSelf: 'flex-start' },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeLabel: { fontFamily: 'Unbounded', fontSize: 11, fontWeight: '500' },
  modalRoot: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  chipList: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 40, borderRadius: 20 },
  chipDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  chipLabel: { fontFamily: 'Unbounded', fontSize: 12, fontWeight: '500' },
});

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

export default function SettingsOverlay({
  visible,
  onClose,
  group,
  groupId,
  members,
  drinks,
  currentUserId,
  theme: t,
  categoryColors,
  updateGroupPrices,
  updateGroupName,
  addDrink,
  removeDrink,
  toggleAdmin,
  removeMember,
  regenerateInviteCode,
  deleteGroup,
  leaveGroup,
  removeOwnAdmin,
  isAdmin,
  refresh,
  tallyCounts,
  recentTallies,
  addTally,
  removeTally,
  activeCategories = [1, 2],
  getCategoryName,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showOpen, setShowOpen] = useState(false);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [groupName, setGroupName] = useState('');
  const [catName1, setCatName1] = useState('');
  const [catName2, setCatName2] = useState('');
  const [catName3, setCatName3] = useState('');
  const [catName4, setCatName4] = useState('');
  const [price1, setPrice1] = useState('');
  const [price2, setPrice2] = useState('');
  const [price3, setPrice3] = useState('');
  const [price4, setPrice4] = useState('');
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkEmoji, setNewDrinkEmoji] = useState('');
  const [newDrinkCat, setNewDrinkCat] = useState('1');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [tallyAdj, setTallyAdj] = useState<Record<string, Record<number, number>>>({});
  const [enabledCats, setEnabledCats] = useState<Set<number>>(new Set([1, 2]));
  const [priceErrors, setPriceErrors] = useState<Record<number, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [savedOk, setSavedOk] = useState(false);
  const catOpacityAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const initialValues = useRef<{
    groupName: string;
    price1: string; price2: string; price3: string; price4: string;
    catName1: string; catName2: string; catName3: string; catName4: string;
    enabledCats: Set<number>;
  } | null>(null);

  // Reset optimistic adjustments when real data arrives
  useEffect(() => { setTallyAdj({}); }, [recentTallies]);

  // Reset newDrinkCat when selected category is no longer enabled
  useEffect(() => {
    const currentCat = parseInt(newDrinkCat) || 1;
    if (!enabledCats.has(currentCat)) {
      const firstEnabled = [...enabledCats].sort()[0];
      if (firstEnabled) setNewDrinkCat(String(firstEnabled));
    }
  }, [enabledCats, newDrinkCat]);

  const toggleExpandMember = useCallback((userId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));
    setExpandedMember((prev) => (prev === userId ? null : userId));
  }, []);

  // Init form when opened
  useEffect(() => {
    if (visible && group) {
      setGroupName(group.name);
      setGroupAvatarUrl(group.avatar_url ?? null);
      setPrice1(centsToEuroStr(group.price_category_1));
      setPrice2(centsToEuroStr(group.price_category_2));
      setPrice3(centsToEuroStr(group.price_category_3));
      setPrice4(centsToEuroStr(group.price_category_4));
      setPriceErrors({});
      const catName1Value = group.name_category_1 || 'Categorie 1';
      const catName2Value = group.name_category_2 || 'Categorie 2';
      const catName3Value = group.name_category_3 || 'Categorie 3';
      const catName4Value = group.name_category_4 || 'Categorie 4';
      setCatName1(catName1Value);
      setCatName2(catName2Value);
      setCatName3(catName3Value);
      setCatName4(catName4Value);

      // Categories with a price are enabled
      const enabledArray: number[] = [];
      if (group.price_category_1) enabledArray.push(1);
      if (group.price_category_2) enabledArray.push(2);
      if (group.price_category_3) enabledArray.push(3);
      if (group.price_category_4) enabledArray.push(4);
      if (enabledArray.length === 0) { enabledArray.push(1); enabledArray.push(2); } // fallback
      const enabled = new Set<number>(enabledArray);
      setEnabledCats(enabled);
      catOpacityAnims.forEach((anim, idx) => {
        anim.setValue(enabled.has(idx + 1) ? 1 : 0.35);
      });

      initialValues.current = {
        groupName: group.name,
        price1: centsToEuroStr(group.price_category_1),
        price2: centsToEuroStr(group.price_category_2),
        price3: centsToEuroStr(group.price_category_3),
        price4: centsToEuroStr(group.price_category_4),
        catName1: catName1Value,
        catName2: catName2Value,
        catName3: catName3Value,
        catName4: catName4Value,
        enabledCats: new Set(enabledArray),
      };

      setShowOpen(true);
      scrimOpacity.setValue(0);
      contentAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 1, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isDirty = (): boolean => {
    const iv = initialValues.current;
    if (!iv) return false;
    const setsEqual = (a: Set<number>, b: Set<number>) =>
      a.size === b.size && [...a].every((v) => b.has(v));
    return (
      groupName !== iv.groupName ||
      price1 !== iv.price1 || price2 !== iv.price2 ||
      price3 !== iv.price3 || price4 !== iv.price4 ||
      catName1 !== iv.catName1 || catName2 !== iv.catName2 ||
      catName3 !== iv.catName3 || catName4 !== iv.catName4 ||
      !setsEqual(enabledCats, iv.enabledCats)
    );
  };

  const performClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setShowOpen(false);
      onClose();
    });
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isDirty()) {
      Alert.alert(
        'Wijzigingen niet opgeslagen',
        'Weet je zeker dat je wilt sluiten? Je wijzigingen worden niet opgeslagen.',
        [
          { text: 'Annuleer', style: 'cancel' },
          { text: 'Sluiten', style: 'destructive', onPress: performClose },
        ]
      );
    } else {
      performClose();
    }
  }, [performClose]);

  const handlePriceBlur = (index: number, value: string, setter: (v: string) => void) => {
    if (!value.trim()) {
      setPriceErrors((prev) => ({ ...prev, [index + 1]: null }));
      return;
    }
    const formatted = formatEuroStr(value);
    if (formatted == null) {
      setPriceErrors((prev) => ({ ...prev, [index + 1]: 'Ongeldig bedrag' }));
    } else {
      setter(formatted);
      setPriceErrors((prev) => ({ ...prev, [index + 1]: null }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePriceChange = (index: number, value: string, setter: (v: string) => void) => {
    setter(value);
    if (priceErrors[index + 1]) {
      setPriceErrors((prev) => ({ ...prev, [index + 1]: null }));
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validate prices
    const p1 = euroStrToCents(price1);
    const p2 = euroStrToCents(price2);
    const p3 = price3.trim() ? euroStrToCents(price3) : null;
    const p4 = price4.trim() ? euroStrToCents(price4) : null;

    const errors: Record<number, string | null> = {};
    if (p1 == null && price1.trim()) errors[1] = 'Ongeldig bedrag';
    if (p2 == null && price2.trim()) errors[2] = 'Ongeldig bedrag';
    if (p3 == null && price3.trim()) errors[3] = 'Ongeldig bedrag';
    if (p4 == null && price4.trim()) errors[4] = 'Ongeldig bedrag';

    if (Object.values(errors).some(Boolean)) {
      setPriceErrors(errors);
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateGroupPrices({
      ...(groupName.trim() ? { name: groupName.trim() } : {}),
      price_category_1: enabledCats.has(1) ? (p1 ?? 150) : null,
      price_category_2: enabledCats.has(2) ? (p2 ?? 300) : null,
      price_category_3: enabledCats.has(3) ? (p3 ?? 150) : null,
      price_category_4: enabledCats.has(4) ? (p4 ?? 150) : null,
      name_category_1: catName1.trim() || 'Categorie 1',
      name_category_2: catName2.trim() || 'Categorie 2',
      name_category_3: catName3.trim() || 'Categorie 3',
      name_category_4: catName4.trim() || 'Categorie 4',
    });
    setSavedOk(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedOk(false);
      performClose();
    }, 600);
  };

  const toggleCategory = (cat: number) => {
    setEnabledCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size <= 1) return prev;
        next.delete(cat);
        Animated.timing(catOpacityAnims[cat - 1], {
          toValue: 0.35,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      } else {
        next.add(cat);
        Animated.timing(catOpacityAnims[cat - 1], {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  };

  const handleAddDrink = async () => {
    if (!newDrinkName.trim()) return;
    await addDrink(newDrinkName.trim(), parseInt(newDrinkCat) || 1, newDrinkEmoji || '🍺');
    setNewDrinkName('');
    setNewDrinkEmoji('');
    setNewDrinkCat('1');
  };

  const handleRemoveDrink = (id: string, name: string) => {
    Alert.alert('Drankje verwijderen', `${name} verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => removeDrink(id) },
    ]);
  };

  const handleToggleAdmin = (userId: string, name: string, isAdmin: boolean) => {
    Alert.alert(isAdmin ? 'Admin verwijderen' : 'Admin maken', `${name} ${isAdmin ? 'is dan geen admin meer' : 'wordt admin'}.`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Bevestigen', onPress: () => toggleAdmin(userId) },
    ]);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert('Lid verwijderen', `${name} uit de groep verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => removeMember(userId) },
    ]);
  };

  const handleRegenerateCode = () => {
    Alert.alert('Nieuwe uitnodigingscode', 'De huidige code werkt dan niet meer.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Vernieuwen', onPress: () => regenerateInviteCode() },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Groep verwijderen', 'Alle leden en streepjes gaan verloren.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: async () => {
        await deleteGroup();
        onClose();
      } },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Groep verlaten', 'Weet je zeker dat je deze groep wilt verlaten?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verlaten', style: 'destructive', onPress: async () => {
        await leaveGroup();
        onClose();
      } },
    ]);
  };

  const handleRemoveAdmin = () => {
    Alert.alert('Admin afstaan', 'Weet je zeker dat je je admin-rechten wilt afstaan?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Afstaan', style: 'destructive', onPress: async () => {
        await removeOwnAdmin();
        refresh();
      } },
    ]);
  };

  const handleOpenCamera = () => setCameraVisible(true);

  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    setUploadingAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `groups/${groupId}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (error) { Alert.alert('Upload mislukt', error.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', groupId);
    setGroupAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  const categories = [
    { name: catName1, setName: setCatName1, price: price1, setPrice: setPrice1 },
    { name: catName2, setName: setCatName2, price: price2, setPrice: setPrice2 },
    { name: catName3, setName: setCatName3, price: price3, setPrice: setPrice3 },
    { name: catName4, setName: setCatName4, price: price4, setPrice: setPrice4 },
  ];

  const contentStyle = {
    opacity: contentAnim,
    transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  if (!showOpen) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Frosted scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={s.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[s.container, { paddingTop: insets.top + 12 }, contentStyle]} pointerEvents="auto">
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={({ pressed }) => [{ marginRight: 12 }, pressed && { opacity: 0.7 }]} accessibilityLabel="Sluiten" accessibilityRole="button">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle}>Instellingen</Text>
          <Pressable onPress={handleSave} hitSlop={12} disabled={isSaving} style={({ pressed }) => [{ marginLeft: 'auto' }, pressed && { opacity: 0.7 }]}>
            <View style={s.saveBtnRow}>
              {savedOk && (
                <Ionicons name="checkmark" size={16} color="#00BEAE" style={{ marginRight: 4 }} />
              )}
              <Text style={[s.saveText, isSaving && { opacity: 0.5 }]}>
                {savedOk ? 'Opgeslagen' : 'Opslaan'}
              </Text>
            </View>
          </Pressable>
        </View>

        <FadeMask>
        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingTop: 32, paddingBottom: 120 }}>
          {/* Group avatar */}
          <Pressable style={s.avatarSection} onPress={handleOpenCamera} disabled={uploadingAvatar}>
            {groupAvatarUrl ? (
              <Image source={{ uri: groupAvatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>{group?.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
            <Text style={s.avatarAction}>{uploadingAvatar ? 'Uploaden...' : 'Groepsfoto wijzigen'}</Text>
          </Pressable>

          {/* Group name */}
          <Text style={s.sectionHeader}>GROEPSNAAM</Text>
          <View style={s.card}>
            <View style={s.inputRow}>
              <TextInput
                style={s.inputText}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Groepsnaam"
                placeholderTextColor="#848484"
              />
            </View>
          </View>

          {/* Categories */}
          <Text style={s.sectionHeader}>CATEGORIEËN</Text>
          <View style={s.catSectionRow}>
            {/* Toggles kolom links */}
            <View style={s.catTogglesColumn}>
              {categories.map(({ name, setName, price, setPrice }, i) => {
                const catNum = i + 1;
                const enabled = enabledCats.has(catNum);
                return (
                  <React.Fragment key={i}>
                  {i > 0 && <View style={{ height: 1 }} />}
                  <Animated.View style={[s.catToggleWrapper, { opacity: catOpacityAnims[i] }]}>
                    <Pressable
                      onPress={() => toggleCategory(catNum)}
                      style={({ pressed }) => [s.catToggle, { backgroundColor: enabled ? categoryColors[i] : '#3A3A3A' }, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons
                        name={enabled ? 'checkmark' : 'close'}
                        size={16}
                        color={enabled ? '#fff' : '#666'}
                      />
                    </Pressable>
                  </Animated.View>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Card rechts: naam + prijs */}
            <View style={[s.card, { flex: 1 }]}>
              {categories.map(({ name, setName, price, setPrice }, i) => {
                const catNum = i + 1;
                const enabled = enabledCats.has(catNum);
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={s.divider} />}
                    <Animated.View style={[s.catRow, { opacity: catOpacityAnims[i] }]}>
                      <TextInput
                        style={s.catNameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder={`Categorie ${catNum}`}
                        placeholderTextColor="#848484"
                        editable={enabled}
                      />
                      {enabled ? (
                        <View style={s.catPriceWrapper}>
                          <Text style={s.euroSign}>€</Text>
                          <TextInput
                            style={[s.catPriceInput, priceErrors[catNum] ? s.catPriceInputError : null]}
                            value={price}
                            onChangeText={(v) => handlePriceChange(i, v, setPrice)}
                            onBlur={() => handlePriceBlur(i, price, setPrice)}
                            keyboardType="decimal-pad"
                            placeholder="0,00"
                            placeholderTextColor="#848484"
                            maxLength={5}
                          />
                        </View>
                      ) : (
                        <Text style={s.catDisabledLabel}>Uit</Text>
                      )}
                    </Animated.View>
                    {priceErrors[catNum] && (
                      <Text style={s.priceError}>{priceErrors[catNum]}</Text>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          {/* Drinks */}
          <Text style={s.sectionHeader}>DRANKJES</Text>
          <View style={s.card}>
            {drinks.length === 0 && (
              <Text style={s.emptyText}>Geen drankjes</Text>
            )}
            {drinks.map((drink, i) => {
              const catColor = categoryColors[(drink.category - 1) % 4];
              const catName = getCategoryName?.(drink.category) ?? `Cat ${drink.category}`;
              return (
                <React.Fragment key={drink.id}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.drinkRow}>
                    <Text style={{ fontSize: 20, marginRight: 12 }}>{drink.emoji ?? '🍺'}</Text>
                    <Text style={s.drinkName}>{drink.name}</Text>
                    <View style={[s.drinkCatBadge, { backgroundColor: catColor + '20' }]}>
                      <Text style={[s.drinkCatBadgeText, { color: catColor }]}>{catName}</Text>
                    </View>
                    <Pressable onPress={() => handleRemoveDrink(drink.id, drink.name)} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.7 }} accessibilityLabel={`${drink.name} verwijderen`} accessibilityRole="button">
                      <Ionicons name="close-circle" size={20} color="#EB5466" />
                    </Pressable>
                  </View>
                </React.Fragment>
              );
            })}
            {/* Add drink inline */}
            <View style={s.divider} />
            <View style={s.addDrinkRow}>
              <TextInput style={s.addDrinkInput} placeholder="Naam" placeholderTextColor="#848484" value={newDrinkName} onChangeText={setNewDrinkName} />
              <TextInput style={s.addDrinkEmoji} placeholder={'🍺'} placeholderTextColor="#848484" value={newDrinkEmoji} onChangeText={setNewDrinkEmoji} />
              <Pressable onPress={handleAddDrink} hitSlop={4} style={({ pressed }) => [s.addDrinkBtn, pressed && { opacity: 0.7 }]} accessibilityLabel="Drankje toevoegen" accessibilityRole="button">
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            {/* Category badge selector: hold to expand, drag to pick */}
            <View style={[s.addDrinkRow, { justifyContent: 'center', paddingVertical: 8 }]}>
              <CategoryBadgeSelector
                value={parseInt(newDrinkCat) || 1}
                onChange={(v) => setNewDrinkCat(String(v))}
                colors={categoryColors}
                enabledCategories={[...enabledCats].sort()}
                getCategoryName={getCategoryName}
                onScrollEnable={setScrollEnabled}
              />
            </View>
          </View>

          {/* Members */}
          <Text style={s.sectionHeader}>LEDEN</Text>
          <View style={s.card}>
            {members.map((member, i) => {
              const name = member.user_id === currentUserId ? 'Jij' : (member.profile?.full_name || 'Onbekend');
              const isSelf = member.user_id === currentUserId;
              const isExpanded = expandedMember === member.user_id;
              const memberTallies = tallyCounts?.[member.user_id] ?? {};
              return (
                <React.Fragment key={member.id}>
                  {i > 0 && <View style={s.divider} />}
                  <Pressable style={({ pressed }) => [s.memberRow, pressed && { opacity: 0.7 }]} onPress={() => toggleExpandMember(member.user_id)} accessibilityLabel={`${name} details`} accessibilityRole="button">
                    {member.profile?.avatar_url ? (
                      <Image source={{ uri: member.profile.avatar_url }} style={s.memberAvatar} />
                    ) : (
                      <View style={[s.memberAvatar, s.memberAvatarFallback]}>
                        <Text style={s.memberAvatarText}>{name[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{name}</Text>
                      {member.is_admin && <Text style={s.adminBadge}>Admin</Text>}
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#848484" />
                  </Pressable>
                  {/* Expanded: tally counts + admin actions */}
                  {isExpanded && (
                    <View style={s.memberExpanded}>
                      {/* Tally counts per category */}
                      {activeCategories.map((cat) => {
                        const adj = tallyAdj[member.user_id]?.[cat] || 0;
                        const count = (memberTallies[cat] || 0) + adj;
                        const catColor = categoryColors[(cat - 1) % 4];
                        const catName = getCategoryName?.(cat) ?? `Cat ${cat}`;
                        return (
                          <View key={cat} style={s.tallyRow}>
                            <View style={[s.tallyDot, { backgroundColor: catColor }]} />
                            <Text style={s.tallyLabel}>{catName}</Text>
                            <Text style={s.tallyCount}>{count}</Text>
                            {addTally && (
                              <Pressable
                                onPress={() => {
                                  setTallyAdj((prev) => ({
                                    ...prev,
                                    [member.user_id]: { ...prev[member.user_id], [cat]: (prev[member.user_id]?.[cat] || 0) + 1 },
                                  }));
                                  addTally(cat as 1|2|3|4, member.user_id);
                                }}
                                style={({ pressed }) => [s.tallyBtn, pressed && { opacity: 0.7 }]}
                                hitSlop={4}
                                accessibilityLabel="Streepje toevoegen"
                                accessibilityRole="button"
                              >
                                <Ionicons name="add" size={16} color="#00BEAE" />
                              </Pressable>
                            )}
                            {removeTally && count > 0 && (
                              <Pressable
                                onPress={() => {
                                  const memberRecentTallies = (recentTallies || []).filter(
                                    (t: any) => t.user_id === member.user_id && t.category === cat && !t.removed
                                  );
                                  if (memberRecentTallies.length > 0) {
                                    Alert.alert('Streepje verwijderen', `1x ${catName} van ${name}?`, [
                                      { text: 'Annuleren', style: 'cancel' },
                                      { text: 'Verwijderen', style: 'destructive', onPress: () => {
                                        setTallyAdj((prev) => ({
                                          ...prev,
                                          [member.user_id]: { ...prev[member.user_id], [cat]: (prev[member.user_id]?.[cat] || 0) - 1 },
                                        }));
                                        removeTally(memberRecentTallies[0].id);
                                      } },
                                    ]);
                                  }
                                }}
                                style={({ pressed }) => [s.tallyBtn, pressed && { opacity: 0.7 }]}
                                hitSlop={4}
                                accessibilityLabel="Streepje verwijderen"
                                accessibilityRole="button"
                              >
                                <Ionicons name="remove" size={16} color="#EB5466" />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      {/* Admin actions */}
                      {!isSelf && (
                        <View style={s.memberActions}>
                          <Pressable onPress={() => handleToggleAdmin(member.user_id, name, member.is_admin)} style={({ pressed }) => [s.memberActionBtn, pressed && { opacity: 0.7 }]}>
                            <Ionicons name={member.is_admin ? 'shield' : 'shield-outline'} size={18} color="#00BEAE" />
                            <Text style={s.memberActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{member.is_admin ? 'Admin verwijderen' : 'Admin maken'}</Text>
                          </Pressable>
                          <Pressable onPress={() => handleRemoveMember(member.user_id, name)} style={({ pressed }) => [s.memberActionBtnDanger, pressed && { opacity: 0.7 }]}>
                            <Ionicons name="person-remove-outline" size={18} color="#EB5466" />
                            <Text style={s.memberActionTextDanger}>Verwijderen</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Invite code */}
          <Text style={s.sectionHeader}>UITNODIGINGSCODE</Text>
          <View style={s.card}>
            <View style={s.inviteRow}>
              <Text style={s.inviteCode}>{group?.invite_code ?? '...'}</Text>
              <Pressable onPress={handleRegenerateCode} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <Text style={s.refreshText}>Vernieuwen</Text>
              </Pressable>
            </View>
          </View>

          {/* Danger zone */}
          <View style={[s.card, { marginTop: 24 }]}>
            {isAdmin && (
              <Pressable style={({ pressed }) => [s.dangerRow, pressed && { opacity: 0.7 }]} onPress={handleRemoveAdmin}>
                <Ionicons name="shield-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
                <Text style={s.dangerRowText}>Admin afstaan</Text>
              </Pressable>
            )}
            {isAdmin && <View style={s.divider} />}
            <Pressable style={({ pressed }) => [s.dangerRow, pressed && { opacity: 0.7 }]} onPress={handleLeaveGroup}>
              <Ionicons name="exit-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
              <Text style={s.dangerRowText}>Groep verlaten</Text>
            </Pressable>
            {isAdmin && (
              <>
                <View style={s.divider} />
                <Pressable style={({ pressed }) => [s.dangerRow, pressed && { opacity: 0.7 }]} onPress={handleDeleteGroup}>
                  <Ionicons name="trash-outline" size={20} color="#EB5466" style={{ marginRight: 12 }} />
                  <Text style={s.dangerRowText}>Groep verwijderen</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
        </FadeMask>
      </Animated.View>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  container: { flex: 1, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontFamily: 'Unbounded', fontSize: 24, fontWeight: '400', color: '#FFFFFF' },
  saveText: { fontFamily: 'Unbounded', fontSize: 14, fontWeight: '600', color: '#00BEAE' },
  saveBtnRow: { flexDirection: 'row' as const, alignItems: 'center' as const },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '600', color: '#333' },
  avatarAction: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE', marginTop: 8 },

  // Section
  sectionHeader: { fontFamily: 'Unbounded', fontSize: 12, fontWeight: '400', color: '#848484', marginLeft: 4, marginTop: 24, marginBottom: 8 },

  // Card
  card: { borderRadius: 25, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginLeft: 16 },

  // Inputs
  inputRow: { paddingHorizontal: 20, minHeight: 52, justifyContent: 'center' },
  inputText: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', height: 52 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  catToggle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  catSectionRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const },
  catTogglesColumn: { width: 52, alignItems: 'center' as const, justifyContent: 'flex-start' as const },
  catToggleWrapper: { height: 52, alignItems: 'center' as const, justifyContent: 'center' as const },
  catNameInput: { fontFamily: 'Unbounded', flex: 1, fontSize: 14, color: '#FFFFFF', height: 52 },
  catPriceWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    minWidth: 88,
  },
  euroSign: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginRight: 4,
  },
  catPriceInput: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'right' as const,
    height: 40,
    width: 56,
    fontVariant: ['tabular-nums'] as any,
  },
  catPriceInputError: {
    color: '#EB5466',
  },
  priceError: {
    fontFamily: 'Unbounded',
    fontSize: 10,
    color: '#EB5466',
    textAlign: 'right' as const,
    paddingRight: 16,
    paddingBottom: 4,
    marginTop: -4,
  },
  catDisabledLabel: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', width: 72, textAlign: 'right' },

  // Drinks
  drinkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50 },
  drinkName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', flex: 1 },
  emptyText: { fontFamily: 'Unbounded', color: '#848484', padding: 16, fontSize: 14 },
  addDrinkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52, gap: 8 },
  addDrinkInput: { fontFamily: 'Unbounded', flex: 1, fontSize: 14, color: '#FFFFFF', height: 48 },
  addDrinkEmoji: { fontFamily: 'Unbounded', width: 48, fontSize: 14, color: '#FFFFFF', textAlign: 'center', height: 48 },
  addDrinkBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF004D', alignItems: 'center', justifyContent: 'center' },
  drinkCatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  drinkCatBadgeText: { fontFamily: 'Unbounded', fontSize: 11 },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  memberAvatarFallback: { backgroundColor: '#F1F1F1' },
  memberAvatarText: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  adminBadge: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE', marginTop: 1 },

  // Expanded member
  memberExpanded: { paddingHorizontal: 16, paddingBottom: 12 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tallyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  tallyLabel: { fontFamily: 'Unbounded', fontSize: 12, color: '#FFFFFF', flex: 1 },
  tallyCount: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginRight: 8, minWidth: 24, textAlign: 'right' },
  tallyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(78,78,78,0.4)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  memberActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 18, paddingHorizontal: 8, backgroundColor: 'rgba(0,217,163,0.1)' },
  memberActionText: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE', flexShrink: 1 },
  memberActionBtnDanger: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 18, paddingHorizontal: 8, backgroundColor: 'rgba(235,84,102,0.1)' },
  memberActionTextDanger: { fontFamily: 'Unbounded', fontSize: 12, color: '#EB5466', flexShrink: 1 },

  // Invite
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 52 },
  inviteCode: { fontFamily: 'Unbounded', fontSize: 16, color: '#FFFFFF', flex: 1, letterSpacing: 2 },
  refreshText: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE' },

  // Danger
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  dangerRowText: { fontFamily: 'Unbounded', fontSize: 14, color: '#EB5466', flex: 1 },
});
