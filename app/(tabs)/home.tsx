import { useColorScheme } from '@/components/useColorScheme';
import { AuroraPresetView, AURORA_COLORS } from '@/src/components/AuroraBackground';
import CategoryRow from '@/src/components/CategoryRow';
import CounterControl from '@/src/components/CounterControl';
import GroupSelector from '@/src/components/GroupSelector';
import GroupSetupWizard from '@/src/components/GroupSetupWizard';
import { AnimatedCard } from '@/src/components/AnimatedCard';
import HomeSkeleton from '@/src/components/HomeSkeleton';
import SettingsOverlay from '@/src/components/SettingsOverlay';
import StreepjesVerificatieModal from '@/src/components/StreepjesVerificatieModal';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useGroupDetail } from '@/src/hooks/useGroupDetail';
import { useGroups } from '@/src/hooks/useGroups';
import { formatTimeAgo } from '@/src/hooks/useHistory';
import { useSettlements } from '@/src/hooks/useSettlements';
import { getTheme } from '@/src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useNavBarAnim } from './_layout';

// ── SlideModal: frosted scrim + content slides + swipe-to-dismiss ──
function SlideModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(300)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const DISMISS_THRESHOLD = 150;
  const VELOCITY_THRESHOLD = 0.5;

  // Combined translateY: slide-in animation + drag offset
  const combinedY = useRef(Animated.add(slideY, dragY)).current;

  // Backdrop opacity fades as user drags down
  const backdropOpacity = dragY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.4],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dismissModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(dragY, { toValue: SCREEN_HEIGHT, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setShow(false);
      dragY.setValue(0);
      onCloseRef.current();
    });
  }, [SCREEN_HEIGHT]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture vertical downward swipes (avoid interfering with horizontal scroll)
        return gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, gs) => {
        // Only allow dragging downward (clamp at 0)
        if (gs.dy > 0) {
          dragY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        isDragging.current = false;
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > VELOCITY_THRESHOLD) {
          // Dismiss
          dismissModal();
        } else {
          // Spring back
          Animated.spring(dragY, {
            toValue: 0,
            damping: 20,
            stiffness: 300,
            mass: 1,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(dragY, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          mass: 1,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      overlayOpacity.setValue(0);
      slideY.setValue(300);
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (show) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 300, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <Modal visible transparent animationType="none">
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: Animated.multiply(overlayOpacity, backdropOpacity) }]}>
          <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
          <View style={styles.modalOverlay} />
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: combinedY }] }]}>
          {/* Drag handle zone — above title, captures swipe-to-dismiss */}
          <Pressable onPress={(e) => e.stopPropagation()} {...panResponder.panHandlers} style={styles.modalHandleZone}>
            <View style={styles.modalHandle} />
          </Pressable>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// StaggerItem replaced by AnimatedCard from src/components/AnimatedCard.tsx

const STORAGE_KEY = 'streeps_selected_group';

export default function HomeScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => styles, []);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { user } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { groups, loading: groupsLoading, createGroup, joinGroup } = useGroups();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((id) => { if (id) setSelectedGroupId(id); });
  }, []);

  useEffect(() => {
    if (selectedGroupId) AsyncStorage.setItem(STORAGE_KEY, selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  useEffect(() => {
    AsyncStorage.getItem('streeps_confirm_count').then((val) => {
      const parsed = val ? parseInt(val, 10) : 0;
      setConfirmCount(isNaN(parsed) ? 0 : parsed);
    });
  }, []);

  const {
    group, members, drinks, tallyCounts, tallyCategoryCounts, recentTallies, credits,
    loading: detailLoading, isAdmin, addTally, addTallyForMember, addTallyForMemberByCategory, removeTally, toggleAdmin, removeMember, leaveGroup, removeOwnAdmin, toggleActive, activateMe,
    updateGroupPrices, updateGroupName, addDrink, removeDrink, deleteGroup, regenerateInviteCode, refresh: refreshGroup,
  } = useGroupDetail(selectedGroupId ?? '');

  // Auto-activate user in selected group
  const myMember = members.find((m) => m.user_id === user?.id);
  useEffect(() => {
    if (!user || !selectedGroupId || !myMember) return;
    if (!myMember.is_active) activateMe();
  }, [selectedGroupId, myMember?.is_active]);

  const { settling, getUnsettledTallies, createSettlement, fetchHistory, history } = useSettlements(selectedGroupId ?? '');

  // Tally flow state
  const [selectedCategory, setSelectedCategory] = useState<number | null>(1);
  const [tallyCount, setTallyCount] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmCount, setConfirmCount] = useState<number>(999); // default 999 voorkomt FOUC bij mount
  const hintProgress = useRef(new Animated.Value(0)).current;

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // Content fade-in on data load (triggers on group switch + initial load)
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    if (group && group.id === selectedGroupId) {
      setContentReady(false);
      contentOpacity.setValue(0);
      Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        setContentReady(true);
      });
    } else {
      contentOpacity.setValue(0);
      setContentReady(false);
    }
  }, [group?.id, selectedGroupId]);

  // Animate "Tik om te bevestigen" hint — only shown until user has confirmed 5+ times
  useEffect(() => {
    const shouldShow = tallyCount >= 1 && confirmCount < 5;
    Animated.timing(hintProgress, {
      toValue: shouldShow ? 1 : 0,
      duration: shouldShow ? 200 : 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,  // layout props → non-native
    }).start();
  }, [tallyCount, confirmCount]);


  // Expand/collapse animations
  const membersExpandAnim = useRef(new Animated.Value(1)).current;
  const drinksExpandAnim = useRef(new Animated.Value(1)).current;
  const membersExtraAnim = useRef(new Animated.Value(0)).current;
  const drinksExtraAnim = useRef(new Animated.Value(0)).current;

  const toggleMembers = useCallback(() => {
    Animated.timing(membersExpandAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setShowMembers((prev) => {
        const next = !prev;
        if (next) {
          membersExtraAnim.setValue(0);
          Animated.timing(membersExtraAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
        return next;
      });
      Animated.timing(membersExpandAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [membersExpandAnim, membersExtraAnim]);

  const toggleDrinks = useCallback(() => {
    Animated.timing(drinksExpandAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setShowAllDrinks((prev) => {
        const next = !prev;
        if (next) {
          drinksExtraAnim.setValue(0);
          Animated.timing(drinksExtraAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
        return next;
      });
      Animated.timing(drinksExpandAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [drinksExpandAnim, drinksExtraAnim]);

  // Member detail modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showAllDrinks, setShowAllDrinks] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Group selector modal
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wizardGroup, setWizardGroup] = useState<{ id: string; name: string; invite_code: string } | null>(null);
  const navBarAnim = useNavBarAnim();

  const openSettings = useCallback(() => {
    setShowSettings(true);
    Animated.timing(navBarAnim, {
      toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start();
  }, [navBarAnim]);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
    Animated.timing(navBarAnim, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true,
    }).start();
  }, [navBarAnim]);

  // Avatar preview
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const avatarRef = useRef<View>(null);
  const avatarPreviewAnim = useRef(new Animated.Value(0)).current;
  const [avatarOrigin, setAvatarOrigin] = useState({ x: 0, y: 0, size: 66 });

  const handleAvatarPress = () => {
    avatarRef.current?.measureInWindow((x, y, w, h) => {
      setAvatarOrigin({ x: x + w / 2, y: y + h / 2, size: w });
      setShowAvatarPreview(true);
      avatarPreviewAnim.setValue(0);
      Animated.spring(avatarPreviewAnim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    });
  };

  const handleAvatarClose = () => {
    Animated.timing(avatarPreviewAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setShowAvatarPreview(false);
    });
  };

  // Settlement modals
  const [showSettlement, setShowSettlement] = useState(false);
  const [unsettledMembers, setUnsettledMembers] = useState<any[]>([]);
  const [selectedForSettlement, setSelectedForSettlement] = useState<Set<string>>(new Set());
  const [showSettlementHistory, setShowSettlementHistory] = useState(false);

  // Remove tally state
  // View profile state
  const [sharedGroups, setSharedGroups] = useState<any[]>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const selectMember = useCallback((memberId: string | null) => {
    setSharedGroups([]);
    setFriendshipStatus(null);
    setSelectedMemberId(memberId);
  }, []);
  const [memberAvatarOrigin, setMemberAvatarOrigin] = useState({ x: 0, y: 0, size: 45 });
  const memberAvatarRefs = useRef<Record<string, View | null>>({}).current;

  // Clear stale avatar refs when group changes
  useEffect(() => {
    Object.keys(memberAvatarRefs).forEach(k => delete memberAvatarRefs[k]);
  }, [selectedGroupId]);

  const profileAnim = useRef(new Animated.Value(0)).current;
  const profileSwipeX = useRef(new Animated.Value(0)).current;
  const closeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const profilePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && gs.moveX < 40 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => { if (gs.dx > 0) profileSwipeX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80) {
          closeProfile();
        } else {
          Animated.spring(profileSwipeX, { toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const activeCategories = useMemo(() => {
    const catsWithDrinks = new Set(drinks.map((d) => d.category));
    return ([1, 2, 3, 4] as const).filter((cat) => catsWithDrinks.has(cat));
  }, [drinks]);

  // ── Live badge: auto-expires at the exact moment the 10-min window closes ──
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const WINDOW_MS = 10 * 60 * 1000;

    const evaluate = () => {
      if (!recentTallies || recentTallies.length === 0) {
        setIsLive(false);
        return null;
      }
      const newest = Math.max(
        ...recentTallies.map((t: { created_at: string }) => new Date(t.created_at).getTime())
      );
      const age = Date.now() - newest;
      if (age >= WINDOW_MS) {
        setIsLive(false);
        return null;
      }
      setIsLive(true);
      return setTimeout(() => setIsLive(false), WINDOW_MS - age);
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
  }, [recentTallies]);

  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isLive) {
      livePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); };
  }, [isLive]);

  // Auto-select first active category when categories load or selected one disappears
  useEffect(() => {
    if (activeCategories.length > 0 && (selectedCategory === null || !activeCategories.includes(selectedCategory as any))) {
      setSelectedCategory(activeCategories[0]);
    }
  }, [activeCategories]);

  const getCategoryName = (cat: number) => {
    if (!group) return `Categorie ${cat}`;
    switch (cat) {
      case 1: return group.name_category_1 || 'Categorie 1';
      case 2: return group.name_category_2 || 'Categorie 2';
      case 3: return group.name_category_3 || 'Categorie 3';
      case 4: return group.name_category_4 || 'Categorie 4';
      default: return `Categorie ${cat}`;
    }
  };

  const getCategoryPrice = (cat: number) => {
    if (!group) return 0;
    switch (cat) {
      case 1: return group.price_category_1;
      case 2: return group.price_category_2;
      case 3: return group.price_category_3 ?? 0;
      case 4: return group.price_category_4 ?? 0;
      default: return 0;
    }
  };

  const handleCategoryTap = (cat: number) => {
    if (adding) return; // debounce: block while tally is being saved
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
  };

  const handleConfirmTally = async () => {
    if (!selectedCategory || tallyCount < 1) { setShowVerification(false); return; }
    const count = tallyCount;
    const catName = getCategoryName(selectedCategory);
    setShowVerification(false);
    setAdding(true);
    try {
      await addTally(selectedCategory as 1 | 2 | 3 | 4, count);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newCount = confirmCount + 1;
      setConfirmCount(newCount);
      AsyncStorage.setItem('streeps_confirm_count', String(newCount));
      setTallyCount(0);
    } catch {
      showToast('Kon streepje niet opslaan, probeer opnieuw', 'error');
    }
    setAdding(false);
  };

  const handleCounterSubmit = () => {
    if (!selectedCategory || tallyCount < 1) return;
    setShowVerification(true);
  };

  const selectedMemberData = useMemo(() => {
    if (!selectedMemberId) return null;
    const member = members.find((m) => m.user_id === selectedMemberId);
    if (!member) return null;
    const tallies = recentTallies.filter((tt) => tt.user_id === selectedMemberId);
    const categoryCounts: Record<number, number> = {};
    tallies.forEach((tt) => { const cat = (tt as any).category ?? 1; categoryCounts[cat] = (categoryCounts[cat] || 0) + 1; });
    return { member, tallies, categoryCounts };
  }, [selectedMemberId, members, recentTallies]);

  // Fetch shared groups and friendship when member selected
  useEffect(() => {
    // Clear stale data immediately on any member change
    setSharedGroups([]);
    setFriendshipStatus(null);

    if (!selectedMemberId || !user || selectedMemberId === user.id) return;

    let cancelled = false;

    // Shared groups
    supabase.from('group_members').select('group_id').eq('user_id', selectedMemberId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const theirGroupIds = data.map((d: any) => d.group_id);
        setSharedGroups(groups.filter((g) => theirGroupIds.includes(g.id)));
      });
    // Friendship status
    supabase.from('friendships').select('*')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${selectedMemberId}),and(user_id.eq.${selectedMemberId},friend_id.eq.${user.id})`)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setFriendshipStatus(data?.status ?? null);
      });

    return () => { cancelled = true; };
  }, [selectedMemberId]);

  const handleAddFriend = async () => {
    if (!user || !selectedMemberId) return;
    await supabase.from('friendships').insert({ user_id: user.id, friend_id: selectedMemberId });
    setFriendshipStatus('pending');
  };

  // Open/close profile with animation
  useEffect(() => {
    if (selectedMemberData) {
      setShowProfile(true);
      profileAnim.setValue(0);
      profileSwipeX.setValue(0);
      Animated.spring(profileAnim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    }
  }, [selectedMemberId]);

  const closeProfile = useCallback(() => {
    const anim = Animated.parallel([
      Animated.timing(profileAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(profileSwipeX, { toValue: SCREEN_W, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]);
    closeAnimRef.current = anim;
    anim.start(({ finished }) => {
      closeAnimRef.current = null;
      if (finished) {
        setShowProfile(false);
        setSelectedMemberId(null);
      }
    });
  }, []);

  const handleOpenSettlement = async () => {
    if (!group) return;
    const m = await getUnsettledTallies(group);
    if (m.length === 0) { Alert.alert('Geen streepjes', 'Er zijn geen onafgerekende streepjes.'); return; }
    setUnsettledMembers(m);
    setSelectedForSettlement(new Set(m.map((mm: any) => mm.user_id)));
    setShowSettlement(true);
  };

  const handleConfirmSettlement = async () => {
    if (!group || selectedForSettlement.size === 0) return;
    await createSettlement(group, Array.from(selectedForSettlement));
    setShowSettlement(false);
    showToast('Afrekening gemaakt!', 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ════════════════════════════════════════════════════════════
  // RENDER — pixel-exact from Home_fixed_v3.svg
  // ════════════════════════════════════════════════════════════

  if (groupsLoading) {
    return (
      <View style={[s.container, s.center]}>
        <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#FF0085" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refreshGroup(); setRefreshing(false); }}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
      >

        {/* Status bar spacer */}
        <View style={{ height: insets.top }} />

        {/* Header aurora — scrolls with content, behind everything */}
        <View style={[s.headerAurora, { top: 0 }]} pointerEvents="none">
          <AuroraPresetView preset="header" animated />
        </View>

        {selectedGroupId && group ? (
          <Animated.View style={{ opacity: contentOpacity }}>
            {/* ── Group Header ── SVG: Groepheader + Group 13 (expand icon) */}
            <Pressable style={s.groupHeader} onPress={() => setShowGroupSelector(true)}>
              <View style={s.groupTopRow}>
                <Pressable onPress={(group as any)?.avatar_url ? handleAvatarPress : undefined} hitSlop={6}>
                  <View ref={avatarRef} collapsable={false}>
                    {(group as any)?.avatar_url ? (
                      <Image source={{ uri: (group as any).avatar_url }} style={s.avatar} transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback]}>
                        <Text style={s.avatarText}>{group.name?.[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
                <Text
                  style={s.groupName}
                  numberOfLines={1}
                >
                  {group.name}
                </Text>
                {/* SVG Group 13: radial glow + up/down arrows */}
                <View style={s.chevronWrap} pointerEvents="none">
                  <Svg width={23} height={28} viewBox="325 66 23 28" fill="none">
                    <Path d="M348 77.5C336.5 66 336.5 66 336.5 66L325 77.5H329.6L336.5 70.6L343.4 77.5H348Z" fill="#F1F1F1" />
                    <Path d="M325 82.1C336.5 93.6 336.5 93.6 336.5 93.6L348 82.1H343.4L336.5 89L329.6 82.1H325Z" fill="#F1F1F1" />
                  </Svg>
                </View>
              </View>
              <View style={s.groupLabelRow}>
                {isLive && (
                  <Animated.View style={[s.liveBadge, { opacity: livePulse }]}>
                    <View style={s.liveDot} />
                    <Text style={s.liveBadgeText}>LIVE</Text>
                  </Animated.View>
                )}
                <View style={s.activePill}>
                  <Text style={s.activePillText}>
                    {members.filter((m) => m.is_active).length} actief
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* ── Counter ── SVG node Counter: minus(19,190) display(158,190) plus(245,190) */}
            <View style={s.counterWrap}>
              <CounterControl
                value={tallyCount}
                onIncrement={() => { if (adding) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTallyCount((c) => Math.min(c + 1, 99)); }}
                onDecrement={() => { if (adding) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTallyCount((c) => Math.max(c - 1, 0)); }}
                onSubmit={() => { if (adding) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleCounterSubmit(); }}
                onSwipeCycle={(direction: 'next' | 'prev') => {
                  if (adding) return;
                  const list = activeCategories;
                  if (!list || list.length === 0) return;
                  const currentIdx = list.findIndex((c) => c === selectedCategory);
                  if (currentIdx === -1) return;
                  const nextIdx = direction === 'next'
                    ? (currentIdx + 1) % list.length
                    : (currentIdx - 1 + list.length) % list.length;
                  setSelectedCategory(list[nextIdx]);
                  Haptics.selectionAsync();
                }}
                auroraColors={['#FF0085', '#FF00F5', '#00BEAE', '#00FE96']}
                activeColor={selectedCategory ? t.categoryColors[(selectedCategory - 1) % t.categoryColors.length] : undefined}
              />
              {selectedCategory && credits[selectedCategory] > 0 && (
                <View style={s.creditBadge}>
                  <Text style={s.creditText}>-{credits[selectedCategory]}</Text>
                </View>
              )}
              <Animated.View
                style={{
                  height: hintProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }),
                  marginTop: hintProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
                  opacity: hintProgress,
                  overflow: 'hidden',
                }}
              >
                <Text style={s.submitHint}>Tik om te bevestigen</Text>
              </Animated.View>
            </View>

            {/* ── Category Rows ── SVG: 350×50, borderRadius 25, 9px gap */}
            <View style={s.categories}>
              {activeCategories.map((cat) => (
                <CategoryRow
                  key={cat}
                  name={getCategoryName(cat)}
                  price={getCategoryPrice(cat)}
                  color={t.categoryColors[(cat - 1) % 4]}
                  categoryIndex={cat}
                  selected={selectedCategory === cat}
                  onPress={() => handleCategoryTap(cat)}
                />
              ))}
            </View>

            {/* ── Leden ── */}
            <View style={s.ledenSection}>
              <View style={[s.auroraFull, { top: 0 }]} pointerEvents="none">
                <AuroraPresetView preset="leden" animated gentle />
              </View>
              <View style={s.ledenHeader}>
                <Text style={s.ledenTitle}>Leden</Text>
                <Text style={s.ledenCount}>{members.length} leden</Text>
              </View>
              <View key={selectedGroupId} style={s.ledenList}>
                {members.slice(0, 4).map((member, i) => {
                  const mName = member.user_id === user?.id ? 'Jij' : (member.profile?.full_name || 'Onbekend');
                  return (
                    <AnimatedCard key={member.id} index={i} enabled={contentReady}>
                    <Pressable style={s.lidRow} onPress={() => {
                      if (closeAnimRef.current) {
                        closeAnimRef.current.stop();
                        closeAnimRef.current = null;
                      }
                      const ref = memberAvatarRefs[member.user_id];
                      if (ref) {
                        ref.measureInWindow((x, y, w, h) => {
                          setMemberAvatarOrigin({ x: x + w / 2, y: y + h / 2, size: w });
                          selectMember(member.user_id);
                        });
                      } else {
                        selectMember(member.user_id);
                      }
                    }}>
                      <View ref={(r) => { memberAvatarRefs[member.user_id] = r; }} collapsable={false} style={s.lidAvatarWrap}>
                        {member.profile?.avatar_url ? (
                          <Image source={{ uri: member.profile.avatar_url }} style={s.lidAvatar} transition={200} cachePolicy="memory-disk" />
                        ) : (
                          <View style={[s.lidAvatar, s.lidAvatarFallback]}>
                            <Text style={s.lidAvatarText}>{mName[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        {member.is_active && (
                          <View style={s.onlineBadge}>
                            <View style={s.onlineDot} />
                          </View>
                        )}
                      </View>
                      <Text style={s.lidName}>{mName}</Text>
                      {member.is_admin && <Ionicons name="shield" size={14} color="#00BEAE" style={{ marginLeft: 6 }} />}
                    </Pressable>
                    </AnimatedCard>
                  );
                })}
                {showMembers && (
                  <Animated.View style={{ opacity: membersExtraAnim }}>
                    {members.slice(4).map((member, i) => {
                      const mName = member.user_id === user?.id ? 'Jij' : (member.profile?.full_name || 'Onbekend');
                      return (
                        <AnimatedCard key={`${member.id}-${showMembers}`} index={i} enabled={true}>
                        <Pressable style={s.lidRow} onPress={() => {
                          const ref = memberAvatarRefs[member.user_id];
                          if (ref) {
                            ref.measureInWindow((x, y, w, h) => {
                              setMemberAvatarOrigin({ x: x + w / 2, y: y + h / 2, size: w });
                              selectMember(member.user_id);
                            });
                          } else {
                            selectMember(member.user_id);
                          }
                        }}>
                          <View ref={(r) => { memberAvatarRefs[member.user_id] = r; }} collapsable={false} style={s.lidAvatarWrap}>
                            {member.profile?.avatar_url ? (
                              <Image source={{ uri: member.profile.avatar_url }} style={s.lidAvatar} transition={200} cachePolicy="memory-disk" />
                            ) : (
                              <View style={[s.lidAvatar, s.lidAvatarFallback]}>
                                <Text style={s.lidAvatarText}>{mName[0]?.toUpperCase()}</Text>
                              </View>
                            )}
                            {member.is_active && (
                              <View style={s.onlineBadge}>
                                <View style={s.onlineDot} />
                              </View>
                            )}
                          </View>
                          <Text style={s.lidName}>{mName}</Text>
                          {member.is_admin && <Ionicons name="shield" size={14} color="#00BEAE" style={{ marginLeft: 6 }} />}
                        </Pressable>
                        </AnimatedCard>
                      );
                    })}
                  </Animated.View>
                )}
              </View>
              {members.length > 4 && (
                <Pressable onPress={toggleMembers} style={s.bekijkMeer}>
                  <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: membersExpandAnim }}>
                    <Text style={s.bekijkMeerText}>
                      {showMembers ? 'Minder tonen' : 'Meer tonen'}
                    </Text>
                    <Ionicons name={showMembers ? 'chevron-up' : 'chevron-down'} size={14} color="#848484" />
                  </Animated.View>
                </Pressable>
              )}
            </View>

            {/* ── Drankenlijst ── */}
            {drinks.length === 0 && isAdmin && (
              <Pressable style={s.emptyState} onPress={openSettings}>
                <Text style={s.emptyStateText}>Nog geen drankjes — tik om toe te voegen</Text>
              </Pressable>
            )}
            {drinks.length > 0 && (
              <View style={s.drankenlijstSection}>
                <View style={s.auroraFull} pointerEvents="none">
                  <AuroraPresetView preset="drankenlijst" animated gentle />
                </View>
                <View style={s.drankenlijstHeader}>
                  <Text style={s.drankenlijstTitle}>Drankenlijst</Text>
                  <Text style={s.drankenlijstCount}>{drinks.length} drankjes</Text>
                </View>
                <View style={s.drankenlijstList}>
                  {drinks.slice(0, 4).map((drink, i) => {
                    const catColor = t.categoryColors[(drink.category - 1) % 4];
                    return (
                      <AnimatedCard key={drink.id} index={i} enabled={contentReady}>
                        <View style={s.drinkRow}>
                          <Text style={{ fontSize: 20, marginRight: 12 }}>{drink.emoji ?? '\uD83C\uDF7A'}</Text>
                          <Text style={s.drinkName}>{drink.name}</Text>
                          <View style={[s.catBadge, { backgroundColor: catColor + '20' }]}>
                            <Text style={{ fontFamily: 'Unbounded', color: catColor, fontSize: 12 }}>{getCategoryName(drink.category)}</Text>
                          </View>
                        </View>
                      </AnimatedCard>
                    );
                  })}
                  {showAllDrinks && (
                    <Animated.View style={{ opacity: drinksExtraAnim }}>
                      {drinks.slice(4).map((drink, i) => {
                        const catColor = t.categoryColors[(drink.category - 1) % 4];
                        return (
                          <AnimatedCard key={`${drink.id}-${showAllDrinks}`} index={i} enabled={true}>
                            <View style={s.drinkRow}>
                              <Text style={{ fontSize: 20, marginRight: 12 }}>{drink.emoji ?? '\uD83C\uDF7A'}</Text>
                              <Text style={s.drinkName}>{drink.name}</Text>
                              <View style={[s.catBadge, { backgroundColor: catColor + '20' }]}>
                                <Text style={{ fontFamily: 'Unbounded', color: catColor, fontSize: 12 }}>{getCategoryName(drink.category)}</Text>
                              </View>
                            </View>
                          </AnimatedCard>
                        );
                      })}
                    </Animated.View>
                  )}
                </View>
                {drinks.length > 4 && (
                  <Pressable onPress={toggleDrinks} style={s.bekijkMeer}>
                    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: drinksExpandAnim }}>
                      <Text style={s.bekijkMeerText}>
                        {showAllDrinks ? 'Minder tonen' : 'Meer tonen'}
                      </Text>
                      <Ionicons name={showAllDrinks ? 'chevron-up' : 'chevron-down'} size={14} color="#848484" />
                    </Animated.View>
                  </Pressable>
                )}
              </View>
            )}

            {/* ── Admin actions ── */}
            {isAdmin && (
              <View style={s.adminSection}>
                <Pressable style={s.adminBtn} onPress={handleOpenSettlement} disabled={settling}>
                  <Text style={s.adminBtnText}>{settling ? 'Bezig...' : 'Afrekenen'}</Text>
                </Pressable>
                <Pressable style={s.ghostBtn} onPress={async () => { await fetchHistory(); setShowSettlementHistory(true); }}>
                  <Text style={s.ghostBtnText}>Afrekening historie</Text>
                </Pressable>
              </View>
            )}

            {/* ── Meer opties (progressive disclosure) ── */}
            <Pressable onPress={() => { setShowMoreOptions(!showMoreOptions); if (!showMoreOptions) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300); }} style={s.moreOptionsToggle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.moreOptionsText}>Meer opties</Text>
                <Ionicons name={showMoreOptions ? 'chevron-up' : 'chevron-down'} size={14} color="#848484" />
              </View>
            </Pressable>
            <MoreOptionsPanel visible={showMoreOptions} isAdmin={isAdmin} onSettings={openSettings} onLeave={() => Alert.alert('Groep verlaten', 'Weet je het zeker?', [{ text: 'Annuleren', style: 'cancel' }, { text: 'Uitstappen', style: 'destructive', onPress: async () => { await leaveGroup(); setSelectedGroupId(null); } }])} />

            <View style={{ height: 90 + insets.bottom }} />
          </Animated.View>
        ) : selectedGroupId && detailLoading ? (
          <HomeSkeleton />
        ) : !selectedGroupId ? (
          <View style={s.welcomeWrap}>
            <Text style={s.welcomeTitle}>Welkom.</Text>
            <Text style={s.welcomeSub}>Klaar om gas te geven?</Text>
            <View style={s.welcomeActions}>
              <Pressable style={s.welcomeBtn} onPress={() => { setShowGroupSelector(true); /* will trigger create */ }}>
                <Text style={s.welcomeBtnText}>+ Nieuwe groep</Text>
              </Pressable>
              <Pressable style={s.welcomeBtnOutline} onPress={() => { setShowGroupSelector(true); /* will trigger join */ }}>
                <Text style={s.welcomeBtnOutlineText}>Deelnemen</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Avatar preview overlay ── */}
      {showAvatarPreview && group && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: avatarPreviewAnim }]} pointerEvents="auto">
            <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
            <View style={s.avatarPreviewScrim} />
            <Pressable style={StyleSheet.absoluteFillObject} onPress={handleAvatarClose} />
          </Animated.View>
          <Animated.View
            style={[s.avatarPreviewWrap, {
              top: SCREEN_H / 2 - 100,
              left: SCREEN_W / 2 - 100,
              opacity: avatarPreviewAnim,
              transform: [
                { translateX: avatarPreviewAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [avatarOrigin.x - SCREEN_W / 2, 0],
                })},
                { translateY: avatarPreviewAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [avatarOrigin.y - SCREEN_H / 2, 0],
                })},
                { scale: avatarPreviewAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [avatarOrigin.size / 200, 1],
                })},
              ],
            }]}
            pointerEvents="none"
          >
            {(group as any)?.avatar_url ? (
              <Image source={{ uri: (group as any).avatar_url }} style={s.avatarPreviewImg} transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={[s.avatarPreviewImg, s.avatarFallback]}>
                <Text style={s.avatarPreviewText}>{group.name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* ── Group Selector (modal only, no bar) ── */}
      <GroupSelector
        groups={groups}
        selectedId={selectedGroupId}
        onSelect={setSelectedGroupId}
        onCreate={createGroup}
        onJoin={joinGroup}
        theme={t}
        hideBar
        visible={showGroupSelector}
        onClose={() => setShowGroupSelector(false)}
        currentGroup={group}
        activeCount={members.filter((m) => m.is_active).length}
        onCreated={(g) => {
          setWizardGroup(g);
          Animated.timing(navBarAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
        }}
      />

      <GroupSetupWizard
        visible={!!wizardGroup}
        onClose={() => {
          setWizardGroup(null);
          Animated.timing(navBarAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
        }}
        groupId={wizardGroup?.id ?? ''}
        groupName={wizardGroup?.name ?? ''}
        inviteCode={wizardGroup?.invite_code ?? ''}
      />

      {/* ── Settings overlay ── */}
      {selectedGroupId && group && (
        <SettingsOverlay
          visible={showSettings}
          onClose={closeSettings}
          group={group}
          groupId={selectedGroupId}
          members={members}
          drinks={drinks}
          currentUserId={user?.id}
          theme={t}
          categoryColors={t.categoryColors}
          updateGroupPrices={updateGroupPrices}
          updateGroupName={updateGroupName}
          addDrink={addDrink}
          removeDrink={removeDrink}
          toggleAdmin={toggleAdmin}
          removeMember={removeMember}
          regenerateInviteCode={regenerateInviteCode}
          deleteGroup={async () => { await deleteGroup(); setSelectedGroupId(null); }}
          leaveGroup={async () => { await leaveGroup(); setSelectedGroupId(null); }}
          removeOwnAdmin={removeOwnAdmin}
          isAdmin={isAdmin}
          refresh={refreshGroup}
          tallyCounts={tallyCategoryCounts}
          recentTallies={recentTallies}
          addTally={addTallyForMemberByCategory}
          removeTally={removeTally}
          activeCategories={activeCategories as number[]}
          getCategoryName={getCategoryName}
        />
      )}


      {/* ── Toast ── */}
      {toast && (
        <Animated.View style={[s.toast, { bottom: 90 + insets.bottom, opacity: toastOpacity, backgroundColor: toast.type === 'error' ? '#FF0085' : '#00BEAE' }]}>
          <Ionicons name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color="#0F0F1E" />
          <Text style={s.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* ── Verificatie Modal ── */}
      <StreepjesVerificatieModal
        visible={showVerification}
        count={tallyCount}
        categoryName={selectedCategory ? getCategoryName(selectedCategory) : ''}
        categoryColor={selectedCategory ? t.categoryColors[(selectedCategory - 1) % 4] : '#00BEAE'}
        categoryPrice={selectedCategory ? getCategoryPrice(selectedCategory) : undefined}
        credit={selectedCategory ? (credits[selectedCategory] || 0) : 0}
        onConfirm={handleConfirmTally}
        onCancel={() => setShowVerification(false)}
      />

      {/* ── View Profile overlay ── */}
      {showProfile && selectedMemberData && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none" {...profilePan.panHandlers}>
          {/* Frosted scrim with fade */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: profileAnim }]} pointerEvents="auto">
            <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
            <View style={s.profileScrim} />
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeProfile} />
          </Animated.View>

          {/* Content slides in from right + follows swipe */}
          <Animated.View
            style={[s.profileContent, {
              opacity: profileAnim,
              transform: [
                { translateX: Animated.add(
                  profileSwipeX,
                  profileAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] })
                )},
              ],
            }]}
            pointerEvents="box-none"
          >
            {/* Back button */}
            <Pressable style={[s.profileBackBtn, { top: insets.top + 8 }]} onPress={closeProfile} pointerEvents="auto">
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </Pressable>

            <ScrollView contentContainerStyle={s.profileScroll} showsVerticalScrollIndicator={false} pointerEvents="auto">
              {/* Avatar animates from list position to center */}
              <Animated.View style={{
                transform: [
                  { translateX: profileAnim.interpolate({ inputRange: [0, 1], outputRange: [memberAvatarOrigin.x - SCREEN_W / 2, 0] }) },
                  { translateY: profileAnim.interpolate({ inputRange: [0, 1], outputRange: [memberAvatarOrigin.y - 200, 0] }) },
                  { scale: profileAnim.interpolate({ inputRange: [0, 1], outputRange: [memberAvatarOrigin.size / 160, 1] }) },
                ],
              }}>
                {selectedMemberData.member.profile?.avatar_url ? (
                  <Image source={{ uri: selectedMemberData.member.profile.avatar_url }} style={s.profileAvatar} transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[s.profileAvatar, s.avatarFallback]}>
                    <Text style={s.profileAvatarText}>
                      {(selectedMemberData.member.user_id === user?.id ? 'Jij' : (selectedMemberData.member.profile?.full_name || '?'))[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
              </Animated.View>
              {/* Name */}
              <Text style={s.profileName}>
                {selectedMemberData.member.user_id === user?.id ? 'Jij' : (selectedMemberData.member.profile?.full_name || 'Onbekend')}
              </Text>
              {/* Active badge */}
              {selectedMemberData.member.is_active && (
                <View style={s.profileActiveBadge}>
                  <View style={s.profileActiveDot} />
                  <Text style={s.profileActiveText}>Actief</Text>
                </View>
              )}
              {/* Shared groups */}
              {sharedGroups.length > 0 && (
                <>
                  <Text style={s.profileSectionHeader}>GEDEELDE GROEPEN</Text>
                  <View style={s.profileCard}>
                    {sharedGroups.map((g, i) => (
                      <React.Fragment key={g.id}>
                        {i > 0 && <View style={s.profileDivider} />}
                        <View style={s.profileGroupRow}>
                          <Text style={s.profileGroupName}>{g.name}</Text>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
              {/* Message button */}
              {selectedMemberData.member.user_id !== user?.id && (
                <Pressable style={s.profileMessageBtn} onPress={async () => {
                  if (!user) return;
                  const { startDM } = await import('@/src/hooks/useChat');
                  const convId = await startDM(selectedMemberData.member.user_id, user.id);
                  setSelectedMemberId(null);
                  router.push({ pathname: '/(tabs)/chat', params: { openDmUserId: selectedMemberData.member.user_id, openDmName: selectedMemberData.profile?.full_name || '', openDmConvId: convId, openDmAvatar: selectedMemberData.profile?.avatar_url || '' } });
                }}>
                  <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={s.profileMessageBtnText}>Stuur bericht</Text>
                </Pressable>
              )}
              {/* Friend button */}
              {selectedMemberData.member.user_id !== user?.id && (
                friendshipStatus === 'accepted' ? (
                  <View style={s.profileFriendBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#00BEAE" />
                    <Text style={s.profileFriendBadgeText}>Vrienden</Text>
                  </View>
                ) : friendshipStatus === 'pending' ? (
                  <View style={s.profileFriendBadge}>
                    <Ionicons name="time-outline" size={18} color="#848484" />
                    <Text style={[s.profileFriendBadgeText, { color: '#848484' }]}>Verzoek verstuurd</Text>
                  </View>
                ) : (
                  <Pressable style={s.profileFriendBtn} onPress={handleAddFriend}>
                    <Text style={s.profileFriendBtnText}>Voeg toe als vriend</Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* ── Settlement modal ── */}
      <SlideModal visible={showSettlement} onClose={() => setShowSettlement(false)}>
        <ScrollView style={{ maxHeight: 500 }}>
          <Text style={s.modalTitle}>Afrekenen</Text>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
            onPress={() => {
              if (selectedForSettlement.size === unsettledMembers.length) setSelectedForSettlement(new Set());
              else setSelectedForSettlement(new Set(unsettledMembers.map((m) => m.user_id)));
            }}>
            <View style={[s.checkbox, selectedForSettlement.size === unsettledMembers.length && s.checkboxChecked]} />
            <Text style={{ fontFamily: 'Unbounded', color: '#fff', fontSize: 14, fontWeight: '400' }}>Selecteer alles</Text>
          </Pressable>
          {unsettledMembers.map((member) => {
            const selected = selectedForSettlement.has(member.user_id);
            return (
              <Pressable key={member.user_id} style={[s.settlementRow, selected && { backgroundColor: 'rgba(0, 217, 163, 0.08)' }]}
                onPress={() => { setSelectedForSettlement((prev) => { const next = new Set(prev); next.has(member.user_id) ? next.delete(member.user_id) : next.add(member.user_id); return next; }); }}>
                <View style={[s.checkbox, selected && s.checkboxChecked]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Unbounded', color: '#fff', fontSize: 14, fontWeight: '400' }}>{member.user_id === user?.id ? 'Jij' : member.full_name}</Text>
                  {activeCategories.map((cat) => { const count = member.counts[cat] || 0; if (!count) return null; return (<Text key={cat} style={{ fontFamily: 'Unbounded', color: '#848484', fontSize: 11 }}>{getCategoryName(cat)}: {count}x</Text>); })}
                </View>
                <Text style={{ fontFamily: 'Unbounded', fontSize: 16, color: '#00BEAE', fontWeight: '600' }}>{'\u20AC'} {(member.amount / 100).toFixed(2).replace('.', ',')}</Text>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: 'Unbounded', fontSize: 16, color: '#fff', fontWeight: '400' }}>Totaal</Text>
            <Text style={{ fontFamily: 'Unbounded', fontSize: 16, color: '#00BEAE', fontWeight: '600' }}>
              {'\u20AC'} {(unsettledMembers.filter((m) => selectedForSettlement.has(m.user_id)).reduce((sum, m) => sum + m.amount, 0) / 100).toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <Pressable style={[s.adminBtn, { marginTop: 16 }]} onPress={handleConfirmSettlement} disabled={settling || selectedForSettlement.size === 0}>
            <Text style={s.adminBtnText}>{settling ? 'Bezig...' : 'Bevestigen'}</Text>
          </Pressable>
        </ScrollView>
      </SlideModal>

      {/* ── Settlement history modal ── */}
      <SlideModal visible={showSettlementHistory} onClose={() => setShowSettlementHistory(false)}>
        <ScrollView style={{ maxHeight: 500 }}>
          <Text style={s.modalTitle}>Afrekening historie</Text>
          {history.length === 0 && <Text style={s.modalEmpty}>Nog geen afrekeningen</Text>}
          {history.map((settlement) => (
            <View key={settlement.id} style={s.settlementRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Unbounded', color: '#fff', fontSize: 14, fontWeight: '400' }}>{formatTimeAgo(settlement.created_at)}</Text>
                {settlement.lines.map((line: any) => (
                  <Text key={line.user_id} style={{ fontFamily: 'Unbounded', color: '#848484', fontSize: 11 }}>
                    {line.full_name}: {'\u20AC'} {(line.amount / 100).toFixed(2).replace('.', ',')}
                  </Text>
                ))}
              </View>
              <Text style={{ fontFamily: 'Unbounded', fontSize: 16, color: '#00BEAE', fontWeight: '600' }}>
                {'\u20AC'} {(settlement.total_amount / 100).toFixed(2).replace('.', ',')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </SlideModal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// STYLES — pixel-exact from Home_fixed_v3.svg
// ════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // ── Header aurora ── scrolls with content, positioned behind
  headerAurora: {
    position: 'absolute',
    left: -20,
    zIndex: 0,
  },

  // ── Scroll content ──
  scroll: { paddingHorizontal: 20 },

  // ── Group Selector ── SVG: top area
  selectorWrap: { marginTop: 8 },

  // ── Group Header ── SVG node Groepheader
  groupHeader: {
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 14,
  },
  groupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingLeft: 78, // avatar width (66) + gap (12)
  },
  chevronWrap: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,190,174,0.18)',
  },
  activePillText: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    fontWeight: '600',
    color: '#00BEAE',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,254,150,0.15)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FE96',
  },
  liveBadgeText: {
    fontFamily: 'Unbounded',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#00FE96',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: { backgroundColor: '#F1F1F1' },

  // Avatar preview overlay
  avatarPreviewScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  avatarPreviewWrap: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  avatarPreviewImg: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  avatarPreviewText: { color: '#333', fontSize: 64, fontWeight: '600' },

  // View Profile overlay
  profileScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  profileContent: { flex: 1 },
  profileBackBtn: { position: 'absolute', left: 16, zIndex: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  profileScroll: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 120, paddingBottom: 60 },
  profileAvatar: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#333', fontSize: 48, fontWeight: '600' },
  profileName: { fontFamily: 'Unbounded', fontSize: 24, fontWeight: '400', color: '#FFFFFF', marginTop: 20, textAlign: 'center' },
  profileActiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  profileActiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00FE96' },
  profileActiveText: { fontFamily: 'Unbounded', fontSize: 13, color: '#00FE96' },
  profileSectionHeader: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', marginTop: 32, marginBottom: 8, alignSelf: 'flex-start' },
  profileCard: { width: '100%', backgroundColor: 'rgba(78, 78, 78, 0.3)', borderRadius: 25, overflow: 'hidden' },
  profileDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 16 },
  profileGroupRow: { paddingHorizontal: 20, paddingVertical: 14 },
  profileGroupName: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  profileMessageBtn: { marginTop: 24, height: 50, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.3)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  profileMessageBtnText: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  profileFriendBtn: { marginTop: 12, height: 50, borderRadius: 25, backgroundColor: '#FF0085', alignItems: 'center', justifyContent: 'center', width: '100%' },
  profileFriendBtnText: { fontFamily: 'Unbounded', fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  profileFriendBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 32 },
  profileFriendBadgeText: { fontFamily: 'Unbounded', fontSize: 14, color: '#00BEAE' },
  avatarText: { color: '#333', fontSize: 24, fontWeight: '600' },
  expandBtn: {
    position: 'absolute',
    right: 0,
    top: 8,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandGlow: {
    position: 'absolute',
    width: 41,
    height: 41,
    borderRadius: 20.5,
    overflow: 'hidden',
  },
  groupName: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    fontWeight: '400',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  activeCount: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    marginTop: 12,
    paddingLeft: 10,
  },

  // ── Counter ── SVG node Counter
  counterWrap: { marginBottom: 24, alignItems: 'center' },
  creditBadge: { position: 'absolute', top: -8, right: '50%', marginRight: -45, backgroundColor: 'rgba(0,217,163,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  creditText: { fontFamily: 'Unbounded', fontSize: 12, color: '#00BEAE', fontWeight: '600' },

  // ── Categories ── SVG: 350×50 rows, 9px gap
  categories: { marginBottom: 24, paddingHorizontal: 10 },

  // ── Section Title ── SVG node 122:106
  sectionTitle: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingLeft: 20,
  },

  // ── Aurora positioning: aurora is 420px, parent is 390px → offset -15 to center
  auroraFull: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -15,   // (390 - 420) / 2
    width: 420,
  },

  // ── Drankenlijst ── expandable section (same pattern as leden)
  drankenlijstSection: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  drankenlijstHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
    zIndex: 1,
  },
  drankenlijstTitle: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  drankenlijstCount: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  drankenlijstList: {
    paddingTop: 20,
    paddingHorizontal: 40,
    zIndex: 1,
  },

  // ── Leden ── SVG node Ledenlijst: 389×345
  ledenSection: {
    marginTop: 24,
    marginBottom: 24,
    marginHorizontal: -20,
  },
  ledenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
    zIndex: 1,
  },
  ledenTitle: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  ledenCount: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  ledenList: {
    paddingTop: 20,
    paddingHorizontal: 40,
    zIndex: 1,
  },
  lidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lidAvatarWrap: { position: 'relative', marginRight: 16 },
  lidAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lidAvatarFallback: { backgroundColor: '#F1F1F1' },
  lidAvatarText: { color: '#333', fontSize: 14, fontWeight: '600' },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#00FE96' },
  lidName: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  bekijkMeer: { minHeight: 44, justifyContent: 'center', paddingLeft: 64, zIndex: 1 },
  bekijkMeerText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '400',
    color: '#848484',
  },

  // ── Admin ──
  adminSection: { marginTop: 24, paddingHorizontal: 0 },
  adminBtn: {
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#00BEAE',
  },
  adminBtnText: { fontFamily: 'Unbounded', color: '#0F0F1E', fontSize: 16, fontWeight: '700' },
  ghostBtn: {
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  ghostBtnText: { fontFamily: 'Unbounded', color: '#A0A0B8', fontSize: 16, fontWeight: '500' },

  // ── Settings button ──
  settingsBtn: {
    marginHorizontal: 0,
    marginTop: 24,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(78, 78, 78, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
  },

  // ── Leave group ── same style as profiel logout button
  leaveBtn: {
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 16,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 0, 133, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 133, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    color: '#FF0085',
  },

  // ── Welcome ──
  welcomeWrap: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 20 },
  welcomeTitle: { fontFamily: 'Unbounded', color: '#FFFFFF', fontSize: 24, fontWeight: '400', marginBottom: 8 },
  welcomeSub: { fontFamily: 'Unbounded', color: '#848484', fontSize: 14, fontWeight: '400' },
  welcomeActions: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  welcomeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF0085',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBtnText: { fontFamily: 'Unbounded', color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  welcomeBtnOutline: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(78, 78, 78, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBtnOutlineText: { fontFamily: 'Unbounded', color: '#FFFFFF', fontSize: 14, fontWeight: '400' },

  // ── Toast ──
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#00BEAE',
  },
  toastText: { fontFamily: 'Unbounded', color: '#0F0F1E', fontSize: 14, fontWeight: '500' },

  // ── Empty state ──
  emptyState: { paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center' },
  emptyStateText: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484', textAlign: 'center' },

  // ── Submit hint ──
  submitHint: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', textAlign: 'center' },

  // ── Meer opties toggle ──
  moreOptionsToggle: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  moreOptionsText: { fontFamily: 'Unbounded', fontSize: 14, color: '#848484' },

  // ── Modal shared ──
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  modalSheet: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    backgroundColor: 'rgba(21, 21, 21, 0.95)',
  },
  modalHandleZone: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 28, marginBottom: -12 },
  modalHandle: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  modalTitle: { fontFamily: 'Unbounded', fontSize: 22, fontWeight: '400', color: '#FFFFFF', marginBottom: 16 },
  modalOverline: { fontFamily: 'Unbounded', fontSize: 11, fontWeight: '600', letterSpacing: 1, color: '#848484', marginBottom: 12 },
  modalEmpty: { fontFamily: 'Unbounded', color: '#848484', fontSize: 14 },

  // ── Drink list ──
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2D2D44',
  },
  drinkName: { fontFamily: 'Unbounded', color: '#FFFFFF', flex: 1, fontSize: 16 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },

  // ── Member detail ──
  counterBtnSm: { width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  removePanel: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: '#1A1A2E', borderColor: '#2D2D44' },
  removeConfirmBtn: { padding: 12, borderRadius: 9999, alignItems: 'center', marginTop: 8 },
  memberActionBtn: { flex: 1, padding: 12, borderRadius: 9999, alignItems: 'center' },

  // ── Settlement ──
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#848484', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#00BEAE', borderColor: '#00BEAE' },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 25,
    backgroundColor: 'rgba(78, 78, 78, 0.2)',
    marginBottom: 8,
  },
});

// ── MoreOptionsPanel: animated expand/collapse ──
function MoreOptionsPanel({ visible, isAdmin, onSettings, onLeave }: { visible: boolean; isAdmin: boolean; onSettings: () => void; onLeave: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 150] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });

  return (
    <Animated.View style={{ maxHeight, opacity, overflow: 'hidden' as const }}>
      {isAdmin && (
        <Pressable style={{ marginTop: 24, height: 50, borderRadius: 25, backgroundColor: 'rgba(78,78,78,0.2)', alignItems: 'center', justifyContent: 'center' }} onPress={onSettings}>
          <Text style={{ fontFamily: 'Unbounded', fontSize: 16, fontWeight: '400', color: '#FFFFFF' }}>Instellingen</Text>
        </Pressable>
      )}
      <Pressable style={{ marginTop: 16, marginBottom: 16, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,0,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,0,77,0.5)', alignItems: 'center', justifyContent: 'center' }} onPress={onLeave}>
        <Text style={{ fontFamily: 'Unbounded', fontSize: 16, fontWeight: '400', color: '#FF004D' }}>Uitstappen</Text>
      </Pressable>
    </Animated.View>
  );
}
