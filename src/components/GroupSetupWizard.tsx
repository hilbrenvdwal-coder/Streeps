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
import { categoryColors } from '@/src/theme';

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
          <Ionicons name="camera" size={40} color="#848484" />
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
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#00BEAE' }}
          thumbColor="#FFFFFF"
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
              <View style={[ws.catBadge, { backgroundColor: categoryColors[(drink.category - 1) % 4] + '30', marginRight: 8 }]}>
                <Text style={[ws.catBadgeText, { color: categoryColors[(drink.category - 1) % 4] }]}>
                  {[catName1, catName2, catName3, catName4][(drink.category - 1) % 4] || `Groep ${drink.category}`}
                </Text>
              </View>
              <View style={[ws.catPriceWrapper, { marginRight: 8 }]}>
                <Text style={ws.euroSign}>€</Text>
                <TextInput
                  style={ws.catPriceInput}
                  value={drink.priceStr}
                  onChangeText={(val) => handleUpdateDrinkPriceLocal(drink.id, val)}
                  onBlur={() => handleUpdateDrinkPrice(drink.id, drink.priceStr)}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor="#848484"
                />
              </View>
              <Pressable onPress={() => handleRemoveDrink(drink.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#EB5466" />
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
            placeholderTextColor="#848484"
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
              placeholderTextColor="#848484"
            />
          </View>
        </View>
        <View style={ws.addDrinkCatRow}>
          <View style={ws.catSelectorRow}>
            {[1, 2, 3, 4]
              .filter((c) => c === 1 || (c === 2 && cat2Enabled) || (c === 3 && cat3Enabled) || (c === 4 && cat4Enabled))
              .map((c) => {
                const isSelected = newDrinkCat === c;
                const color = categoryColors[(c - 1) % 4];
                const label = [catName1, catName2, catName3, catName4][(c - 1) % 4] || `Groep ${c}`;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setNewDrinkCat(c)}
                    style={[
                      ws.catSelectorPill,
                      { backgroundColor: isSelected ? color : color + '30' },
                    ]}
                  >
                    <Text style={[ws.catSelectorPillText, { color: isSelected ? '#0F0F1E' : color }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
          <Reanimated.View style={addBtnAnimStyle}>
            <Pressable onPress={handleAddDrink} style={ws.addDrinkBtn}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
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
          <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
          <Text style={ws.inviteBtnText}>Kopieer</Text>
        </Pressable>
        <Pressable style={[ws.inviteBtn, { backgroundColor: '#00BEAE' }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          <Text style={ws.inviteBtnText}>Deel</Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Step 4: Done (was step 5) ──
  const renderStep4 = () => (
    <View style={ws.stepContent}>
      <View style={ws.doneIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#00BEAE" />
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
        outputRange: ['rgba(255,255,255,0.08)', '#00BEAE'],
      });
      const morphTextColor = morphBtnAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#848484', '#FFFFFF'],
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
          <Ionicons name="chevron-back" size={18} color="#848484" />
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
  container: { flex: 1, paddingHorizontal: 20 },

  // Progress
  progressWrap: { marginBottom: 24 },
  progressBar: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#00BEAE',
  },
  progressText: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    color: '#848484',
    marginTop: 8,
  },

  // Step container
  stepContainer: { flex: 1 },
  stepContent: { flex: 1, alignItems: 'center', paddingTop: 20 },
  stepTitle: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginBottom: 32,
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
    fontSize: 12,
    color: '#FFFFFF',
  },
  avatarHint: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    color: '#00BEAE',
    marginTop: 12,
  },

  // Step 2: Categories
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 72,
  },
  catRowDisabled: {
    opacity: 0.4,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 72,
    alignItems: 'center' as const,
  },
  catBadgeText: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    fontWeight: '600',
  },
  catNameInput: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    height: 44,
  },
  catPriceWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  euroSign: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginRight: 2,
  },
  catPriceInput: {
    fontFamily: 'Unbounded',
    width: 52,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'right' as const,
    height: 40,
  },
  catDisabledText: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: 14,
    color: '#848484',
  },

  // Auto-trust
  autoTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  autoTrustLabel: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
  },
  autoTrustHint: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    color: '#848484',
    marginTop: 4,
  },

  // Step 3: Drinks
  drinksList: {
    width: '100%',
    flex: 1,
  },
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  drinkEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  drinkName: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  addDrinkRow: {
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
    width: '100%',
  },
  addDrinkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addDrinkCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addDrinkEmojiWrap: {
    width: 40,
    height: 44,
    borderRadius: 12,
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
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    width: 40,
    height: 44,
  },
  addDrinkInput: {
    fontFamily: 'Unbounded',
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  catSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  catSelectorPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catSelectorPillText: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    fontWeight: '600',
  },
  addDrinkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF004D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 4: Invite
  inviteCodeWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  inviteCodeText: {
    fontFamily: 'Unbounded',
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 6,
    textAlign: 'center',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  inviteBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Step 5: Done
  doneIcon: {
    marginBottom: 16,
    marginTop: 40,
  },
  doneTitle: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  doneSubtitle: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
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
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
  },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '500',
    color: '#848484',
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
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BEAE',
  },
  nextBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  beginBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BEAE',
  },
  beginBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
