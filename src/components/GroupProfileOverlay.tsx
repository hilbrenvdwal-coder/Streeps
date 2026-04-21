import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, colors as themeColors } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useFollows } from '@/src/hooks/useFollows';
import { useSwipeDismiss } from '@/src/hooks/useSwipeDismiss';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import BotIcon from '@/src/components/BotIcon';
import { BOT_DEFAULT_NAME, MAX_BOT_NAME_LENGTH } from '@/src/constants/bot';
import { BOT_DEFAULTS, BOT_DIMENSIONS, BOT_MONTHLY_LIMIT, type BotSettings } from '@/src/constants/botSettings';

export interface GroupProfileOverlayProps {
  visible: boolean;
  groupId: string | null;
  onClose: () => void;
  /** Tap a member row in the group overlay → open that user's profile. */
  onViewProfile?: (userId: string) => void;
  /** Prefetched data (used when opened from chat, avoids extra network round-trip). */
  cachedData?: { group: any; members: any[]; activeCategories?: any[] };
  onBotToggle?: (groupId: string, enabled: boolean) => void;
  onBotNameChange?: (groupId: string, newName: string) => void;
  onAdminOnlyChatChange?: (groupId: string, enabled: boolean) => void;
  onTallyAnnouncementsChange?: (groupId: string, enabled: boolean) => void;
  onSettlementAnnouncementsChange?: (groupId: string, enabled: boolean) => void;
  onBotWelcomeChange?: (groupId: string, enabled: boolean) => void;
  onBotSettingsChange?: (groupId: string, settings: BotSettings) => void;
}

/**
 * Relatieve tijd-label voor "laatst actief"-regel.
 * Voorbeeld: `formatRelative(null)` → "nog geen activiteit",
 *            `formatRelative('2026-04-21T09:00:00Z')` → "2 uur geleden".
 */
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'nog geen activiteit';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = diff / 60000;
  if (mins < 1) return 'net nu';
  if (mins < 60) return `${Math.round(mins)} min geleden`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)} uur geleden`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)} dagen geleden`;
  return new Date(iso).toLocaleDateString('nl-NL');
}

function BotDimensionChooser({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={gp.botDimRow}>
      <Text style={gp.botDimLabel}>{label}</Text>
      <View style={gp.botDimChips}>
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChange(opt.key)}
              style={({ pressed }) => [
                gp.botDimChip,
                active ? gp.botDimChipActive : gp.botDimChipInactive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[gp.botDimChipText, active && gp.botDimChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function GroupProfileOverlay({
  visible,
  groupId,
  onClose,
  onViewProfile,
  cachedData,
  onBotToggle,
  onBotNameChange,
  onAdminOnlyChatChange,
  onTallyAnnouncementsChange,
  onSettlementAnnouncementsChange,
  onBotWelcomeChange,
  onBotSettingsChange,
}: GroupProfileOverlayProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX: gpSwipeX, scrimOpacity: gpScrimOpacity, panHandlers: gpPan } = useSwipeDismiss(onClose, anim);

  const { follow, unfollow, isExplicitFollower } = useFollows();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  // Bepaalt of de huidige user lid is van deze groep. `null` = nog niet bekend
  // (tijdens laden); `false` = non-member (render minimal public card);
  // `true` = member (render volledige overlay zoals voorheen).
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);
  const [botNameDraft, setBotNameDraft] = useState('');
  const [savingBotName, setSavingBotName] = useState(false);
  const [tallyAnnouncementsEnabled, setTallyAnnouncementsEnabled] = useState(false);
  const [settlementAnnouncementsEnabled, setSettlementAnnouncementsEnabled] = useState(false);
  const [botWelcomeEnabled, setBotWelcomeEnabled] = useState(false);
  const [botSettings, setBotSettings] = useState<BotSettings>({});
  const [initialBotSettings, setInitialBotSettings] = useState<BotSettings>({});
  const [adminOnlyChat, setAdminOnlyChat] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const pendingSaveRef = useRef<BotSettings | null>(null);

  const isAdmin = members.some((m) => m.user_id === user?.id && m.is_admin);

  // Debounced auto-save for bot personality settings
  useEffect(() => {
    if (!groupId) return;
    if (JSON.stringify(botSettings) === JSON.stringify(initialBotSettings)) {
      pendingSaveRef.current = null;
      return;
    }
    pendingSaveRef.current = botSettings;
    const timeout = setTimeout(async () => {
      const { error } = await supabase.from('groups').update({ bot_settings: botSettings }).eq('id', groupId);
      if (!error) {
        setInitialBotSettings(botSettings);
        setGroup((g: any) => (g ? { ...g, bot_settings: botSettings } : g));
        onBotSettingsChange?.(groupId, botSettings);
        pendingSaveRef.current = null;
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [botSettings, initialBotSettings, groupId, onBotSettingsChange]);

  // Flush pending bot_settings save on unmount
  useEffect(() => {
    return () => {
      const pending = pendingSaveRef.current;
      if (pending && groupId) {
        supabase.from('groups').update({ bot_settings: pending }).eq('id', groupId).then(() => {
          onBotSettingsChange?.(groupId, pending);
        });
      }
    };
  }, [groupId, onBotSettingsChange]);

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    const currentName = group?.name ?? '';
    if (!trimmed || trimmed === currentName || savingName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { error } = await supabase.from('groups').update({ name: trimmed }).eq('id', groupId);
    setSavingName(false);
    setEditingName(false);
    if (error) {
      Alert.alert('Fout', 'Kon groepsnaam niet opslaan.');
      return;
    }
    setGroup((g: any) => (g ? { ...g, name: trimmed } : g));
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Groep verlaten',
      `Weet je zeker dat je "${group?.name ?? ''}" wilt verlaten?`,
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verlaten',
          style: 'destructive',
          onPress: async () => {
            if (!groupId) return;
            setLeaving(true);
            const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
            setLeaving(false);
            if (error) {
              if (error.message?.includes('last admin')) {
                Alert.alert(
                  'Kan niet verlaten',
                  'Je bent de laatste admin. Maak eerst iemand anders admin voordat je de groep verlaat.'
                );
              } else {
                Alert.alert('Fout', error.message || 'Kon groep niet verlaten.');
              }
              return;
            }
            onClose?.();
          },
        },
      ]
    );
  };

  const handleToggleBot = async (value: boolean) => {
    setBotEnabled(value);
    if (groupId) {
      await supabase.from('groups').update({ bot_enabled: value }).eq('id', groupId);
      onBotToggle?.(groupId, value);
    }
  };

  const handleSaveBotName = async () => {
    if (!groupId || savingBotName) return;
    const trimmed = botNameDraft.trim();
    const current = group?.bot_name ?? BOT_DEFAULT_NAME;
    if (!trimmed || trimmed === current) {
      setBotNameDraft(current);
      return;
    }
    setSavingBotName(true);
    const { error } = await supabase.from('groups').update({ bot_name: trimmed }).eq('id', groupId);
    setSavingBotName(false);
    if (error) {
      Alert.alert('Fout', 'Kon botnaam niet opslaan.');
      setBotNameDraft(current);
      return;
    }
    setGroup((g: any) => (g ? { ...g, bot_name: trimmed } : g));
    onBotNameChange?.(groupId, trimmed);
  };

  const handleToggleTallyAnnouncements = async (value: boolean) => {
    setTallyAnnouncementsEnabled(value);
    if (!groupId) return;
    const { error } = await supabase.from('groups').update({ tally_announcements_enabled: value }).eq('id', groupId);
    if (error) {
      setTallyAnnouncementsEnabled(!value);
      Alert.alert('Fout', 'Kon instelling niet opslaan.');
      return;
    }
    setGroup((g: any) => (g ? { ...g, tally_announcements_enabled: value } : g));
    onTallyAnnouncementsChange?.(groupId, value);
  };

  const handleToggleSettlementAnnouncements = async (value: boolean) => {
    setSettlementAnnouncementsEnabled(value);
    if (!groupId) return;
    const { error } = await supabase.from('groups').update({ settlement_announcements_enabled: value }).eq('id', groupId);
    if (error) {
      setSettlementAnnouncementsEnabled(!value);
      Alert.alert('Fout', 'Kon instelling niet opslaan.');
      return;
    }
    setGroup((g: any) => (g ? { ...g, settlement_announcements_enabled: value } : g));
    onSettlementAnnouncementsChange?.(groupId, value);
  };

  const handleToggleBotWelcome = async (value: boolean) => {
    setBotWelcomeEnabled(value);
    if (!groupId) return;
    const { error } = await supabase.from('groups').update({ bot_welcome_enabled: value }).eq('id', groupId);
    if (error) {
      setBotWelcomeEnabled(!value);
      Alert.alert('Fout', 'Kon instelling niet opslaan.');
      return;
    }
    setGroup((g: any) => (g ? { ...g, bot_welcome_enabled: value } : g));
    onBotWelcomeChange?.(groupId, value);
  };

  const handleToggleAdminOnly = async (value: boolean) => {
    setAdminOnlyChat(value);
    if (!groupId) return;
    const { error } = await supabase.from('groups').update({ admin_only_chat: value }).eq('id', groupId);
    if (error) {
      setAdminOnlyChat(!value);
      Alert.alert('Fout', 'Kon instelling niet opslaan.');
      return;
    }
    setGroup((g: any) => (g ? { ...g, admin_only_chat: value } : g));
    onAdminOnlyChatChange?.(groupId, value);
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
        // Cached paden komen uit member-contexts (bestaande chat flow); bepaal
        // isMember op basis van de cached members zodat non-members toch de
        // juiste restricted render krijgen als ze ooit via cache binnenkomen.
        const memberInCache = user?.id
          ? cachedData.members.some((m: any) => m.user_id === user.id)
          : false;
        setIsMember(memberInCache);
        setBotEnabled(cachedData.group?.bot_enabled !== false);
        setBotNameDraft(cachedData.group?.bot_name ?? BOT_DEFAULT_NAME);
        setTallyAnnouncementsEnabled(cachedData.group?.tally_announcements_enabled === true);
        setSettlementAnnouncementsEnabled(cachedData.group?.settlement_announcements_enabled === true);
        setBotWelcomeEnabled(cachedData.group?.bot_welcome_enabled === true);
        setAdminOnlyChat(cachedData.group?.admin_only_chat === true);
        const loadedBotSettings: BotSettings = ((cachedData.group as any)?.bot_settings ?? {}) as BotSettings;
        setBotSettings(loadedBotSettings);
        setInitialBotSettings(loadedBotSettings);
      } else {
        setIsMember(null);
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

    // ─── Step 1: bepaal lidmaatschap ──────────────────────────────────────
    // Voor non-members falen/leveren de volle `groups.select('*')` en
    // `group_members` queries onder RLS beperkte data. We doen eerst een
    // snelle self-check; als de user geen lid is gebruiken we de
    // SECURITY-DEFINER RPC `get_public_group_info` voor minimale publieke
    // data (naam, avatar, member_count, last_activity_at).
    let memberFlag = false;
    if (user?.id) {
      const { data: selfRow } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle();
      memberFlag = !!selfRow;
    }

    if (!memberFlag) {
      // Non-member pad: RPC levert alleen publieke info.
      const { data: publicInfo } = await supabase
        .rpc('get_public_group_info', { p_group_id: groupId });
      const info = Array.isArray(publicInfo) ? publicInfo[0] : publicInfo;
      if (info) {
        setGroup({
          id: info.id,
          name: info.name,
          avatar_url: info.avatar_url,
          member_count: info.member_count,
          last_activity_at: info.last_activity_at,
          follower_count: info.follower_count ?? 0,
        });
      } else {
        setGroup(null);
      }
      setMembers([]);
      setIsMember(false);
      return;
    }

    // ─── Step 2: member pad — zoals voorheen ──────────────────────────────
    const [{ data: g }, { data: gm }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('user_id, is_admin, joined_at').eq('group_id', groupId),
    ]);
    setGroup(g);
    setIsMember(true);
    setBotEnabled(g?.bot_enabled !== false);
    setBotNameDraft(g?.bot_name ?? BOT_DEFAULT_NAME);
    setTallyAnnouncementsEnabled(g?.tally_announcements_enabled === true);
    setSettlementAnnouncementsEnabled(g?.settlement_announcements_enabled === true);
    setBotWelcomeEnabled(g?.bot_welcome_enabled === true);
    setAdminOnlyChat(g?.admin_only_chat === true);
    const loadedBotSettings: BotSettings = ((g as any)?.bot_settings ?? {}) as BotSettings;
    setBotSettings(loadedBotSettings);
    setInitialBotSettings(loadedBotSettings);
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
      await Share.share({ message: `Join ${group.name} op Streeps!\nhttps://streeps.app/join/${group.invite_code}` });
    } catch {}
  };

  if (!show || !groupId) return null;

  const createdDate = group?.created_at
    ? new Date(group.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gpScrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={gp.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={animateClose} />
      </Animated.View>
      <Animated.View style={[gp.content, {
        paddingTop: insets.top + 12,
        opacity: anim,
        transform: [{ translateX: Animated.add(gpSwipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
      }]} pointerEvents="auto" {...gpPan}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
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
              <Image source={{ uri: group.avatar_url }} style={gp.avatar} transition={200} cachePolicy="memory-disk" />
            ) : (
              <AvatarPlaceholder size={105} label={group?.name?.[0]?.toUpperCase() ?? '?'} borderRadius={9999} fontSize={36} />
            )}
          </View>
          {/* ─── Non-member variant ─────────────────────────────────────
             Laat alleen naam + meta + volg-knop zien. Geen ledenlijst,
             geen bot-/admin-instellingen, geen invite_code en geen
             tallies/settlements/prijzen (RLS zou die velden hoe dan ook
             afknijpen, maar we verbergen ze ook defensief op UI-nivo). */}
          {isMember === false && (
            <>
              <View style={gp.nameDisplayRow}>
                <Text style={gp.displayName}>{group?.name || ''}</Text>
              </View>
              <Text style={gp.memberCount}>
                {typeof group?.follower_count === 'number' ? group.follower_count : 0}
                {' '}
                {(typeof group?.follower_count === 'number' ? group.follower_count : 0) === 1 ? 'volger' : 'volgers'}
                {' · '}
                {typeof group?.member_count === 'number' ? group.member_count : 0}
                {' '}
                {group?.member_count === 1 ? 'lid' : 'leden'}
                {' · laatst actief '}
                {formatRelative(group?.last_activity_at ?? null)}
              </Text>
              <View style={gp.section}>
                {groupId && isExplicitFollower(groupId) ? (
                  <Pressable
                    onPress={async () => {
                      if (followBusy || !groupId) return;
                      setFollowBusy(true);
                      try { await unfollow(groupId); } catch {}
                      setFollowBusy(false);
                    }}
                    disabled={followBusy}
                    style={({ pressed }) => [gp.followBtnSecondary, pressed && { opacity: 0.7 }]}
                  >
                    {followBusy ? (
                      <ActivityIndicator size="small" color={brand.cyan} />
                    ) : (
                      <Text style={gp.followBtnSecondaryText}>Niet meer volgen</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={async () => {
                      if (followBusy || !groupId) return;
                      setFollowBusy(true);
                      try { await follow(groupId); } catch {}
                      setFollowBusy(false);
                    }}
                    disabled={followBusy}
                    style={({ pressed }) => [gp.followBtnPrimary, pressed && { opacity: 0.7 }]}
                  >
                    {followBusy ? (
                      <ActivityIndicator size="small" color={themeColors.dark.background.primary} />
                    ) : (
                      <Text style={gp.followBtnPrimaryText}>Volgen</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* ─── Member variant ─────────────────────────────────────────
             Volledige overlay (ledenlijst, invite, instellingen, bot,
             verlaten, etc.). Wordt ook getoond zolang isMember===null
             (nog aan het laden) zodat de cached/member-context niet met
             een knipperende non-member UI opent. */}
          {isMember !== false && (
            <>
              {editingName && isAdmin ? (
                <View style={gp.nameEditRow}>
                  <TextInput
                    ref={nameInputRef}
                    style={gp.nameInput}
                    value={draftName}
                    onChangeText={setDraftName}
                    maxLength={20}
                    placeholder="Groepsnaam"
                    placeholderTextColor="#848484"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                    onBlur={handleSaveName}
                    autoFocus
                    textAlign="center"
                  />
                  {savingName && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />}
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (isAdmin) {
                      setDraftName(group?.name ?? '');
                      setEditingName(true);
                      setTimeout(() => nameInputRef.current?.focus(), 50);
                    }
                  }}
                  disabled={!isAdmin}
                  style={({ pressed }) => pressed && isAdmin ? { opacity: 0.6 } : undefined}
                >
                  <View style={gp.nameDisplayRow}>
                    <Text style={gp.displayName}>{group?.name || ''}</Text>
                    {isAdmin && <Ionicons name="pencil" size={14} color="#848484" style={{ marginLeft: 6 }} />}
                  </View>
                </Pressable>
              )}
              <Text style={gp.memberCount}>{members.length} {members.length === 1 ? 'lid' : 'leden'}</Text>
            </>
          )}

          {isMember !== false && (
          <>
          {/* Leden */}
          <Text style={gp.sectionHeader}>LEDEN</Text>
          <View style={gp.card}>
            {members.map((m, i) => (
              <React.Fragment key={m.user_id}>
                {i > 0 && <View style={gp.divider} />}
                <Pressable style={gp.memberRow} onPress={() => { if (m.user_id !== user?.id) onViewProfile?.(m.user_id); }}>
                  {m.profile?.avatar_url ? (
                    <Image source={{ uri: m.profile.avatar_url }} style={gp.memberAvatar} transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <AvatarPlaceholder size={36} label={m.profile?.full_name?.[0]?.toUpperCase() ?? '?'} borderRadius={18} fontSize={14} style={gp.memberAvatar} />
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
                    style={{ transform: [{ translateY: -1 }], alignSelf: 'center' }}
                  />
                </View>
                {botEnabled && (
                  <>
                    <View style={gp.divider} />
                    <View style={gp.settingRow}>
                      <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="text-outline" size={18} color="#D9D9D9" />
                      </View>
                      <Text style={gp.settingLabel}>Botnaam</Text>
                      <TextInput
                        style={gp.botNameInput}
                        value={botNameDraft}
                        onChangeText={setBotNameDraft}
                        onBlur={handleSaveBotName}
                        onSubmitEditing={handleSaveBotName}
                        returnKeyType="done"
                        maxLength={MAX_BOT_NAME_LENGTH}
                        placeholder={BOT_DEFAULT_NAME}
                        placeholderTextColor="#848484"
                        textAlign="right"
                      />
                    </View>
                    <View style={gp.divider} />
                    <View style={gp.settingRow}>
                      <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="megaphone-outline" size={18} color="#D9D9D9" />
                      </View>
                      <Text style={gp.settingLabel}>Streepjes aankondigen</Text>
                      <Switch
                        value={tallyAnnouncementsEnabled}
                        onValueChange={handleToggleTallyAnnouncements}
                        trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                        thumbColor="#FFFFFF"
                        style={{ transform: [{ translateY: -1 }], alignSelf: 'center' }}
                      />
                    </View>
                    <View style={gp.divider} />
                    <View style={gp.settingRow}>
                      <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="receipt-outline" size={18} color="#D9D9D9" />
                      </View>
                      <Text style={gp.settingLabel}>Afrekening aankondigen</Text>
                      <Switch
                        value={settlementAnnouncementsEnabled}
                        onValueChange={handleToggleSettlementAnnouncements}
                        trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                        thumbColor="#FFFFFF"
                        style={{ transform: [{ translateY: -1 }], alignSelf: 'center' }}
                      />
                    </View>
                    <View style={gp.divider} />
                    <View style={gp.settingRow}>
                      <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="hand-right-outline" size={18} color="#D9D9D9" />
                      </View>
                      <Text style={gp.settingLabel}>Welkom bericht</Text>
                      <Switch
                        value={botWelcomeEnabled}
                        onValueChange={handleToggleBotWelcome}
                        trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                        thumbColor="#FFFFFF"
                        style={{ transform: [{ translateY: -1 }], alignSelf: 'center' }}
                      />
                    </View>
                  </>
                )}
                <View style={gp.divider} />
                <View style={gp.settingRow}>
                  <View style={{ width: 20, height: 20, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="lock-closed-outline" size={18} color="#D9D9D9" />
                  </View>
                  <Text style={gp.settingLabel}>Alleen admins kunnen typen</Text>
                  <Switch
                    value={adminOnlyChat}
                    onValueChange={handleToggleAdminOnly}
                    trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                    thumbColor="#FFFFFF"
                    style={{ transform: [{ translateY: -1 }], alignSelf: 'center' }}
                  />
                </View>
              </View>
            </>
          )}

          {/* Chatbot */}
          {(() => {
            const now = new Date();
            const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
            const botUsageCount = ((group as any)?.bot_usage_month === currentMonth) ? ((group as any)?.bot_usage_count ?? 0) : 0;
            const limitReached = botUsageCount >= BOT_MONTHLY_LIMIT;
            const usagePct = Math.min(100, (botUsageCount / BOT_MONTHLY_LIMIT) * 100);
            return (
              <>
                <Text style={gp.sectionHeader}>CHATBOT</Text>

                {/* Usage progress bar — zichtbaar voor alle leden */}
                <View style={gp.card}>
                  <View style={gp.botUsageRow}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={gp.botUsageLabel}>Gebruik deze maand</Text>
                      <Text style={gp.botUsageCount}>{botUsageCount} / {BOT_MONTHLY_LIMIT}</Text>
                    </View>
                    <View style={gp.botUsageBarBg}>
                      <View
                        style={[
                          gp.botUsageBarFill,
                          { width: `${usagePct}%` },
                          limitReached && gp.botUsageBarFillFull,
                        ]}
                      />
                    </View>
                    {limitReached && (
                      <Text style={gp.botUsageWarning}>Limiet bereikt — bot reageert pas weer volgende maand</Text>
                    )}
                  </View>
                </View>

                {/* Persoonlijkheid — alleen admins */}
                {isAdmin && (
                  <>
                    <Text style={gp.botSubHeader}>PERSOONLIJKHEID</Text>
                    <View style={gp.card}>
                      {BOT_DIMENSIONS.map((dim, idx) => (
                        <React.Fragment key={dim.key}>
                          {idx > 0 && <View style={gp.divider} />}
                          <BotDimensionChooser
                            label={dim.label}
                            value={(botSettings[dim.key] as string) ?? (BOT_DEFAULTS[dim.key] as string)}
                            options={dim.options}
                            onChange={(v) => setBotSettings((p) => ({ ...p, [dim.key]: v }))}
                          />
                        </React.Fragment>
                      ))}
                    </View>

                    <Text style={gp.botSubHeader}>GEDRAG</Text>
                    <View style={gp.card}>
                      <View style={gp.botToggleRow}>
                        <Text style={gp.botToggleLabel}>Reageren op cadeautjes</Text>
                        <Switch
                          value={botSettings.respond_to_gift_messages ?? false}
                          onValueChange={(v) => setBotSettings((p) => ({ ...p, respond_to_gift_messages: v }))}
                          trackColor={{ false: 'rgba(78,78,78,0.4)', true: '#00BEAE' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>
                  </>
                )}
              </>
            );
          })()}

          {/* Groep verlaten */}
          <View style={gp.section}>
            <Pressable
              onPress={handleLeaveGroup}
              style={({ pressed }) => [gp.leaveBtn, pressed && { opacity: 0.7 }]}
              disabled={leaving}
            >
              {leaving ? (
                <ActivityIndicator size="small" color="#FF5A5A" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#FF5A5A" />
                  <Text style={gp.leaveBtnText}>Groep verlaten</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Aangemaakt */}
          {createdDate ? (
            <Text style={gp.createdAt}>Aangemaakt op {createdDate}</Text>
          ) : null}
          </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
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
  card: { borderRadius: 25, overflow: 'hidden' },
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
  botNameInput: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    color: '#FFFFFF',
    minWidth: 120,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  createdAt: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484', textAlign: 'center', marginTop: 24 },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  nameInput: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    minWidth: 140,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 24,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,90,90,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.25)',
  },
  leaveBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '500',
    color: '#FF5A5A',
  },

  // Non-member follow/unfollow buttons.
  followBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: brand.cyan,
  },
  followBtnPrimaryText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.dark.background.primary,
  },
  followBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: brand.cyan,
  },
  followBtnSecondaryText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '600',
    color: brand.cyan,
  },

  // Chatbot
  botSubHeader: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484', marginLeft: 20, marginTop: 12, marginBottom: 4, letterSpacing: 0.5 },
  botDimRow: { paddingHorizontal: 16, paddingVertical: 12 },
  botDimLabel: { fontFamily: 'Unbounded', fontSize: 13, color: '#D9D9D9', marginBottom: 10 },
  botDimChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  botDimChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  botDimChipInactive: { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' },
  botDimChipActive: { borderColor: '#00BEAE', backgroundColor: 'rgba(0,190,174,0.15)' },
  botDimChipText: { fontFamily: 'Unbounded', fontSize: 12, color: '#848484' },
  botDimChipTextActive: { color: '#FFFFFF' },
  botToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  botToggleLabel: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF' },
  botUsageRow: { padding: 16 },
  botUsageLabel: { fontFamily: 'Unbounded', fontSize: 13, color: '#D9D9D9' },
  botUsageCount: { fontFamily: 'Unbounded', fontSize: 13, color: '#848484' },
  botUsageBarBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  botUsageBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#00BEAE' },
  botUsageBarFillFull: { backgroundColor: '#FF3B30' },
  botUsageWarning: { fontFamily: 'Unbounded', fontSize: 11, color: '#FF3B30', marginTop: 8 },
});
