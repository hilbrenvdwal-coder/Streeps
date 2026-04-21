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
  Modal,
  Share,
  Platform,
  Switch,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import CameraModal from '@/src/components/CameraModal';
import { supabase } from '@/src/lib/supabase';
import { categoryColors, colors, brand, space, radius, typography, fontWeights, semantic } from '@/src/theme';

const TOTAL_STEPS = 4;

interface GroupSetupWizardProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  inviteCode: string;
}

export default function GroupSetupWizard({
  visible,
  onClose,
  groupId,
  groupName,
  inviteCode,
}: GroupSetupWizardProps) {
  const insets = useSafeAreaInsets();
  const [showOpen, setShowOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Scrim & content animation
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;
  const morphBtnAnim = useRef(new Animated.Value(0)).current;

  // Step 1: Group photo
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  // Category labels (read from DB, used as "kleur-groep" label in drinks mode)
  const [catName1, setCatName1] = useState('Normaal');
  const [catName2, setCatName2] = useState('Speciaal');
  const [catName3, setCatName3] = useState('Categorie 3');
  const [catName4, setCatName4] = useState('Categorie 4');
  const [cat2Enabled, setCat2Enabled] = useState(true);
  const [cat3Enabled, setCat3Enabled] = useState(false);
  const [cat4Enabled, setCat4Enabled] = useState(false);
  const [autoTrust, setAutoTrust] = useState(false);

  // Step 2: Drinks (was step 3)
  const [drinks, setDrinks] = useState<{ id: string; name: string; emoji: string; category: number; priceStr: string }[]>([]);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkEmoji, setNewDrinkEmoji] = useState('');
  const [newDrinkCat, setNewDrinkCat] = useState(1);
  const [newDrinkPrice, setNewDrinkPrice] = useState('');

  const addBtnScale = useSharedValue(1);
  const addBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addBtnScale.value }],
  }));

  // Open animation
  useEffect(() => {
    if (visible) {
      setShowOpen(true);
      setStep(1);
      setGroupAvatarUrl(null);
      setCatName1('Normaal');
      setCatName2('Speciaal');
      setCatName3('Categorie 3');
      setCatName4('Categorie 4');
      setCat2Enabled(true);
      setCat3Enabled(false);
      setCat4Enabled(false);
      setAutoTrust(false);
      setNewDrinkName('');
      setNewDrinkEmoji('');
      setNewDrinkCat(1);
      setNewDrinkPrice('');

      // Load existing drinks + category labels from DB
      loadDrinks();
      loadCategoryLabels();

      scrimOpacity.setValue(0);
      contentAnim.setValue(0);
      stepOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 1, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Helpers: convert between cents and euro string (Dutch notation with comma)
  const centsToEuroStr = (cents: number | null | undefined): string => {
    if (cents == null || cents === 0) return '';
    return (cents / 100).toFixed(2).replace('.', ',');
  };
  const euroStrToCents = (str: string): number | null => {
    if (!str.trim()) return null;
    const normalized = str.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed < 0.01 || parsed > 99.99) return null;
    return Math.round(parsed * 100);
  };

  const loadDrinks = async () => {
    const { data } = await supabase
      .from('drinks')
      .select('id, name, emoji, category, price_override')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (data) {
      setDrinks(
        data.map((d) => ({
          id: d.id,
          name: d.name,
          emoji: d.emoji ?? '🍺',
          category: d.category,
          priceStr: centsToEuroStr(d.price_override),
        }))
      );
    }
  };

  const loadCategoryLabels = async () => {
    const { data } = await supabase
      .from('groups')
      .select('name_category_1, name_category_2, name_category_3, name_category_4, price_category_2, price_category_3, price_category_4')
      .eq('id', groupId)
      .maybeSingle();
    if (data) {
      if (data.name_category_1) setCatName1(data.name_category_1);
      if (data.name_category_2) setCatName2(data.name_category_2);
      if (data.name_category_3) setCatName3(data.name_category_3);
      if (data.name_category_4) setCatName4(data.name_category_4);
      setCat2Enabled(data.price_category_2 != null);
      setCat3Enabled(data.price_category_3 != null);
      setCat4Enabled(data.price_category_4 != null);
    }
  };

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setShowOpen(false);
      onClose();
    });
  }, [onClose]);

  // Animate progress bar when step changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Morph button animation for step 1 (group photo)
  useEffect(() => {
    Animated.timing(morphBtnAnim, {
      toValue: groupAvatarUrl ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [groupAvatarUrl]);

  // Fade transition between steps
  const goToStep = useCallback((nextStep: number) => {
    Animated.timing(stepOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(stepOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    });
  }, []);

  const handleNext = useCallback(async () => {
    if (step === 1) {
      // Save auto-trust setting to DB
      await supabase.from('groups').update({
        auto_trust_members: autoTrust,
      }).eq('id', groupId);
    }
    goToStep(step + 1);
  }, [step, autoTrust, groupId, goToStep]);

  const handleSkip = useCallback(() => {
    goToStep(step + 1);
  }, [step, goToStep]);

  const handleBack = useCallback(() => {
    goToStep(step - 1);
  }, [step, goToStep]);

  const handleFinish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  }, [handleClose]);

  // Step 1: Image captured
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

  // Step 2: Add drink
  const handleAddDrink = async () => {
    if (!newDrinkName.trim()) return;
    addBtnScale.value = withSequence(
      withSpring(1.22, { damping: 6, stiffness: 400, mass: 0.6 }),
      withSpring(1,    { damping: 12, stiffness: 200 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const emoji = newDrinkEmoji.trim() || '🍺';
    const priceCents = euroStrToCents(newDrinkPrice);
    const { data, error } = await supabase.from('drinks').insert({
      group_id: groupId,
      name: newDrinkName.trim(),
      emoji,
      category: newDrinkCat,
      price_override: priceCents,
    }).select().single();
    if (error) { Alert.alert('Fout', error.message); return; }
    if (data) setDrinks((prev) => [...prev, {
      id: data.id,
      name: data.name,
      emoji: data.emoji ?? '🍺',
      category: data.category,
      priceStr: centsToEuroStr(data.price_override),
    }]);
    setNewDrinkName('');
    setNewDrinkEmoji('');
    setNewDrinkPrice('');
  };

  const handleRemoveDrink = async (drinkId: string) => {
    await supabase.from('drinks').delete().eq('id', drinkId);
    setDrinks((prev) => prev.filter((d) => d.id !== drinkId));
  };

  // Update a drink's price_override (called on blur from price input)
  const handleUpdateDrinkPrice = async (drinkId: string, newPriceStr: string) => {
    const cents = euroStrToCents(newPriceStr);
    await supabase.from('drinks').update({ price_override: cents }).eq('id', drinkId);
    setDrinks((prev) => prev.map((d) =>
      d.id === drinkId ? { ...d, priceStr: centsToEuroStr(cents) } : d
    ));
  };

  const handleUpdateDrinkPriceLocal = (drinkId: string, newPriceStr: string) => {
    setDrinks((prev) => prev.map((d) =>
      d.id === drinkId ? { ...d, priceStr: newPriceStr } : d
    ));
  };

  // Step 4: Copy & share
  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Gekopieerd!', 'Uitnodigingscode is gekopieerd.');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join ${groupName} op Streeps!\nhttps://streeps.app/join/${inviteCode}`,
      });
    } catch {}
  };

  const contentStyle = {
    opacity: contentAnim,
    transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  };

  if (!showOpen) return null;

  // ── Progress bar ──
  const renderProgress = () => (
    <View style={ws.progressWrap}>
      <View style={ws.progressBar}>
        <Animated.View style={[ws.progressFill, {
          width: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }]} />
      </View>
      <Text style={ws.progressText}>Stap {step} van {TOTAL_STEPS}</Text>
    </View>
  );

  // ── Step 1: Group photo ──
  const renderStep1 = () => (
    <View style={ws.stepContent}>
      <Text style={ws.stepTitle}>Groepsfoto</Text>
      <Text style={ws.stepSubtitle}>Voeg een groepsfoto toe</Text>

      <Pressable style={ws.avatarCircle} onPress={() => setCameraVisible(true)} disabled={uploadingAvatar}>
        {groupAvatarUrl ? (
          <Image source={{ uri: groupAvatarUrl }} style={ws.avatarImage} transition={200} cachePolicy="memory-disk" />
        ) : (
          <Ionicons name="camera" size={40} color={brand.inactive} />
        )}
        {uploadingAvatar && (
          <View style={ws.avatarOverlay}>
            <Text style={ws.uploadingText}>Uploaden...</Text>
          </View>
        )}
      </Pressable>

      {groupAvatarUrl && (
        <Text style={ws.avatarHint}>Tik om te wijzigen</Text>
      )}

      {/* Auto-trust toggle */}
      <View style={ws.divider} />
      <View style={ws.autoTrustRow}>
        <View style={{ flex: 1 }}>
          <Text style={ws.autoTrustLabel}>Nieuwe leden automatisch vertrouwen?</Text>
          <Text style={ws.autoTrustHint}>Nieuwe leden worden automatisch admin</Text>
        </View>
        <Switch
          value={autoTrust}
          onValueChange={setAutoTrust}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: brand.cyan }}
          thumbColor={colors.dark.text.primary}
        />
      </View>
    </View>
  );

  // ── Step 2: Drinks (was step 3) ──
  const renderStep2 = () => (
    <KeyboardAvoidingView
      style={{ flex: 1, width: '100%' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={-(104 + insets.bottom)}
    >
    <View style={[ws.stepContent, { paddingBottom: 104 + insets.bottom }]}>
      <Text style={ws.stepTitle}>Drankjes</Text>
      <Text style={ws.stepSubtitle}>Beheer de drankjes en prijzen</Text>

      <ScrollView
        style={ws.drinksList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {drinks.map((drink, i) => (
          <React.Fragment key={drink.id}>
            {i > 0 && <View style={ws.divider} />}
            <View style={ws.drinkRow}>
              <Text style={ws.drinkEmoji}>{drink.emoji}</Text>
              <Text style={ws.drinkName} numberOfLines={1}>{drink.name}</Text>
              <View style={[ws.catPriceWrapper, { marginRight: 8 }]}>
                <Text style={ws.euroSign}>€</Text>
                <TextInput
                  style={ws.catPriceInput}
                  value={drink.priceStr}
                  onChangeText={(val) => handleUpdateDrinkPriceLocal(drink.id, val)}
                  onBlur={() => handleUpdateDrinkPrice(drink.id, drink.priceStr)}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={brand.inactive}
                />
              </View>
              <Pressable onPress={() => handleRemoveDrink(drink.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#EB5466" /* TODO(theme-migration): #EB5466 vs semantic.error #FF5272 — hue-adjacent red, R:-20 G:0 B:-12 delta, keep exact for visual fidelity */ />
              </Pressable>
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
      <View style={ws.divider} />
      <View style={ws.addDrinkRow}>
        <View style={ws.addDrinkInputRow}>
          <View style={[ws.addDrinkEmojiWrap, newDrinkEmoji === '' ? ws.addDrinkEmojiEmpty : ws.addDrinkEmojiFilled]}>
            {newDrinkEmoji === '' && (
              <Text style={ws.addDrinkEmojiPlaceholder} pointerEvents="none">🍺</Text>
            )}
            <TextInput
              style={ws.addDrinkEmoji}
              value={newDrinkEmoji}
              onChangeText={setNewDrinkEmoji}
            />
          </View>
          <TextInput
            style={ws.addDrinkInput}
            placeholder="Naam"
            placeholderTextColor={brand.inactive}
            value={newDrinkName}
            onChangeText={setNewDrinkName}
            returnKeyType="done"
            onSubmitEditing={handleAddDrink}
          />
          <View style={ws.catPriceWrapper}>
            <Text style={ws.euroSign}>€</Text>
            <TextInput
              style={ws.catPriceInput}
              value={newDrinkPrice}
              onChangeText={setNewDrinkPrice}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={brand.inactive}
            />
          </View>
          <Reanimated.View style={addBtnAnimStyle}>
            <Pressable onPress={handleAddDrink} style={ws.addDrinkBtn}>
              <Ionicons name="add" size={20} color={colors.dark.text.primary} />
            </Pressable>
          </Reanimated.View>
        </View>
      </View>
    </View>
    </KeyboardAvoidingView>
  );

  // ── Step 3: Invite (was step 4) ──
  const renderStep3 = () => (
    <View style={ws.stepContent}>
      <Text style={ws.stepTitle}>Nodig vrienden uit</Text>
      <Text style={ws.stepSubtitle}>Deel de code met je groep</Text>

      <View style={ws.inviteCodeWrap}>
        <Text style={ws.inviteCodeText}>{inviteCode}</Text>
      </View>

      <View style={ws.inviteActions}>
        <Pressable style={ws.inviteBtn} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={20} color={colors.dark.text.primary} />
          <Text style={ws.inviteBtnText}>Kopieer</Text>
        </Pressable>
        <Pressable style={[ws.inviteBtn, { backgroundColor: brand.cyan }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={colors.dark.text.primary} />
          <Text style={ws.inviteBtnText}>Deel</Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Step 4: Done (was step 5) ──
  const renderStep4 = () => (
    <View style={ws.stepContent}>
      <View style={ws.doneIcon}>
        <Ionicons name="checkmark-circle" size={80} color={brand.cyan} />
      </View>
      <Text style={ws.doneTitle}>Klaar!</Text>
      <Text style={ws.doneSubtitle}>{groupName} is helemaal ingesteld</Text>
    </View>
  );

  // ── Bottom bar ──
  const renderBottomBar = () => {
    if (step === 4) {
      return (
        <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={ws.beginBtn} onPress={handleFinish}>
            <Text style={ws.beginBtnText}>Begin</Text>
          </Pressable>
        </View>
      );
    }

    if (step === 1) {
      // Morph button: "Overslaan" (grey) when no photo, "Volgende" (teal) when photo
      const morphBg = morphBtnAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.08)', brand.cyan],
      });
      const morphTextColor = morphBtnAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [brand.inactive, colors.dark.text.primary],
      });
      return (
        <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ width: 52 }} />
          <Pressable
            style={{ flex: 1 }}
            onPress={groupAvatarUrl ? handleNext : handleSkip}
          >
            <Animated.View style={[ws.morphBtn, { backgroundColor: morphBg }]}>
              <Animated.Text style={[ws.morphBtnText, { color: morphTextColor }]}>
                {groupAvatarUrl ? 'Volgende' : 'Overslaan'}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        </View>
      );
    }

    // Steps 2, 3: Back button + Volgende
    return (
      <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={ws.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={18} color={brand.inactive} />
          <Text style={ws.backBtnText}>Terug</Text>
        </Pressable>
        <Pressable style={[ws.nextBtn, { flex: 1 }]} onPress={handleNext}>
          <Text style={ws.nextBtnText}>Volgende</Text>
        </Pressable>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  return (
    <Modal
      visible={showOpen}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Frosted scrim */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
          <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
          <View style={ws.scrim} />
        </Animated.View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Animated.View style={[ws.container, { paddingTop: insets.top + 20 }, contentStyle]} pointerEvents="auto">
            {renderProgress()}

            <Animated.View style={[ws.stepContainer, { opacity: stepOpacity }]}>
              <View
                style={{ flex: 1 }}
                onStartShouldSetResponder={() => { Keyboard.dismiss(); return false; }}
              >
                {renderCurrentStep()}
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {renderBottomBar()}

        <CameraModal
          visible={cameraVisible}
          onClose={() => setCameraVisible(false)}
          onImageCaptured={handleImageCaptured}
        />
      </View>
    </Modal>
  );
}

const ws = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  container: { flex: 1, paddingHorizontal: space[5] },

  // Progress
  progressWrap: { marginBottom: space[6] },
  progressBar: {
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: brand.cyan,
  },
  progressText: {
    fontFamily: 'Unbounded',
    fontSize: typography.caption.fontSize,
    color: brand.inactive,
    marginTop: space[2],
  },

  // Step container
  stepContainer: { flex: 1 },
  stepContent: { flex: 1, alignItems: 'center', paddingTop: space[5] },
  stepTitle: {
    fontFamily: 'Unbounded',
    fontSize: 24, // TODO(theme-migration): typography.heading2 is 22 (-2 delta) but fontWeight differs ('400' vs semibold) — keep literal for fidelity
    fontWeight: '400',
    color: colors.dark.text.primary,
    marginBottom: space[2],
  },
  stepSubtitle: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: brand.inactive,
    marginBottom: space[8],
  },

  // Step 1: Avatar
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    fontFamily: 'Unbounded',
    fontSize: typography.caption.fontSize,
    color: colors.dark.text.primary,
  },
  avatarHint: {
    fontFamily: 'Unbounded',
    fontSize: typography.caption.fontSize,
    color: brand.cyan,
    marginTop: space[3],
  },

  // Step 2: Categories
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14, // TODO(theme-migration): 14 not on 4px grid (space[3]=12 or space[4]=16, ±2 delta) — keep exact
    paddingHorizontal: space[1],
    minHeight: 72,
  },
  catRowDisabled: {
    opacity: 0.4,
  },
  catNameInput: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    height: 44,
  },
  catPriceWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, // TODO(theme-migration): 10 between radius.sm=8 and radius.md=12, keep for compact price-wrapper look
    paddingHorizontal: 10,
    height: 40,
  },
  euroSign: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: brand.inactive,
    marginRight: 2,
  },
  catPriceInput: {
    fontFamily: 'Unbounded',
    width: 52,
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    textAlign: 'right' as const,
    height: 40,
  },
  catDisabledText: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    color: brand.inactive,
  },

  // Auto-trust
  autoTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14, // TODO(theme-migration): 14 not on 4px grid — keep to match catRow rhythm
    paddingHorizontal: space[1],
  },
  autoTrustLabel: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
  },
  autoTrustHint: {
    fontFamily: 'Unbounded',
    fontSize: 11, // TODO(theme-migration): 11 matches typography.overline.fontSize but no uppercase/letterSpacing intended here — keep literal
    color: brand.inactive,
    marginTop: space[1],
  },

  // Step 3: Drinks
  drinksList: {
    width: '100%',
    flex: 1,
  },
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[1],
  },
  drinkEmoji: {
    fontSize: 20,
    marginRight: space[3],
  },
  drinkName: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    flex: 1,
  },
  addDrinkRow: {
    flexDirection: 'column',
    paddingVertical: space[2],
    paddingHorizontal: space[1],
    gap: space[2],
    width: '100%',
  },
  addDrinkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  addDrinkEmojiWrap: {
    width: 40,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addDrinkEmojiEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addDrinkEmojiFilled: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addDrinkEmojiPlaceholder: {
    position: 'absolute',
    fontSize: 18,
    opacity: 0.35,
    textAlign: 'center',
  },
  addDrinkEmoji: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    textAlign: 'center',
    width: 40,
    height: 44,
  },
  addDrinkInput: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
  addDrinkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: brand.streepsRed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 4: Invite
  inviteCodeWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    paddingVertical: space[6],
    paddingHorizontal: space[8],
    marginBottom: space[6],
  },
  inviteCodeText: {
    fontFamily: 'Unbounded',
    fontSize: 28, // TODO(theme-migration): 28 not in typography scale (heading1=26, display=32) — keep for invite-code emphasis
    fontWeight: fontWeights.bold,
    color: colors.dark.text.primary,
    letterSpacing: 6,
    textAlign: 'center',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: space[3],
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 48,
    paddingHorizontal: space[6],
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  inviteBtnText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    fontWeight: fontWeights.semibold,
  },

  // Step 5: Done
  doneIcon: {
    marginBottom: space[4],
    marginTop: space[10],
  },
  doneTitle: {
    fontFamily: 'Unbounded',
    fontSize: typography.display.fontSize,
    fontWeight: '400', // TODO(theme-migration): typography.display is bold (700), keeping '400' for wizard done-screen softer look
    color: colors.dark.text.primary,
    marginBottom: space[2],
  },
  doneSubtitle: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: brand.inactive,
    textAlign: 'center',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: '100%',
  },

  // Bottom bar — absolute at the bottom so it never gets pushed off-screen
  // by greedy flex:1 siblings or a keyboard push.
  bottomBar: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[4],
  },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    fontWeight: fontWeights.medium,
    color: brand.inactive,
  },
  morphBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morphBtnText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    fontWeight: fontWeights.semibold,
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.cyan,
  },
  nextBtnText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.primary,
    fontWeight: fontWeights.semibold,
  },
  beginBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.cyan,
  },
  beginBtnText: {
    fontFamily: 'Unbounded',
    fontSize: typography.body.fontSize,
    color: colors.dark.text.primary,
    fontWeight: fontWeights.semibold,
  },
});
