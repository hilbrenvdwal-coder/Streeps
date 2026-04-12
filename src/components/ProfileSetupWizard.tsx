import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  Animated,
  Easing,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import CameraModal from '@/src/components/CameraModal';
import { supabase } from '@/src/lib/supabase';

const TOTAL_STEPS = 4;

const GENDER_OPTIONS: { value: 'man' | 'vrouw' | 'anders' | 'onbekend'; label: string; icon: string }[] = [
  { value: 'man', label: 'Man', icon: 'male' },
  { value: 'vrouw', label: 'Vrouw', icon: 'female' },
  { value: 'anders', label: 'Anders', icon: 'transgender' },
  { value: 'onbekend', label: 'Zeg ik liever niet', icon: 'remove-circle-outline' },
];

interface ProfileSetupWizardProps {
  visible: boolean;
  onComplete: () => void;
  userId: string;
}

export default function ProfileSetupWizard({
  visible,
  onComplete,
  userId,
}: ProfileSetupWizardProps) {
  const insets = useSafeAreaInsets();
  const [showOpen, setShowOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Scrim & content animation
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // Step 1: Name
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Step 2: Gender
  const [gender, setGender] = useState<'man' | 'vrouw' | 'anders' | 'onbekend' | null>(null);
  const genderBtnAnim = useRef(new Animated.Value(0)).current;

  // Animate gender button morph (Overslaan → Volgende)
  useEffect(() => {
    Animated.timing(genderBtnAnim, {
      toValue: gender !== null ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [gender]);

  // Animated values for each gender option card
  const genderAnims = useRef({
    man: new Animated.Value(0),
    vrouw: new Animated.Value(0),
    anders: new Animated.Value(0),
    onbekend: new Animated.Value(0),
  }).current;

  // Crossfade gender option cards when selection changes
  useEffect(() => {
    (Object.entries(genderAnims) as [string, Animated.Value][]).forEach(([key, anim]) => {
      Animated.timing(anim, {
        toValue: gender === key ? 1 : 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });
  }, [gender]);

  // Step 3: Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  // Open animation
  useEffect(() => {
    if (visible) {
      setShowOpen(true);
      setStep(1);
      setFullName('');
      setGender(null);
      setAvatarUrl(null);

      scrimOpacity.setValue(0);
      contentAnim.setValue(0);
      stepOpacity.setValue(1);
      progressAnim.setValue(1 / TOTAL_STEPS);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 1, damping: 20, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Animate progress bar when step changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step]);

  // Fade transition between steps
  const goToStep = useCallback((nextStep: number) => {
    Animated.timing(stepOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(stepOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    });
  }, []);

  // Step 1: Save name
  const handleNextStep1 = useCallback(async () => {
    if (!fullName.trim()) return;
    setSavingName(true);
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId);
    } catch (e: any) {
      Alert.alert('Fout', e.message ?? 'Kon naam niet opslaan');
      setSavingName(false);
      return;
    }
    setSavingName(false);
    goToStep(2);
  }, [fullName, userId, goToStep]);

  // Step 2: Gender
  const handleNextStep2Gender = useCallback(async () => {
    if (gender) {
      await supabase.from('profiles').update({ gender }).eq('id', userId);
    }
    goToStep(3);
  }, [gender, userId, goToStep]);

  const handleSkipStep2Gender = useCallback(() => {
    goToStep(3);
  }, [goToStep]);

  // Step 3: Image captured
  const handleImageCaptured = async (uri: string, mimeType?: string) => {
    setUploadingAvatar(true);
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: mimeType ?? 'image/jpeg', upsert: true });
    if (error) { Alert.alert('Upload mislukt', error.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
  };

  // Step 3: Next (after optional photo)
  const handleNextStep3Avatar = useCallback(() => {
    goToStep(4);
  }, [goToStep]);

  // Step 3: Skip
  const handleSkipStep3Avatar = useCallback(() => {
    goToStep(4);
  }, [goToStep]);

  // Step 4: Finish
  const handleFinish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
    // Close animation
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setShowOpen(false);
      onComplete();
    });
  }, [userId, onComplete]);

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

  // ── Step 1: Name ──
  const renderStep1 = () => (
    <View style={ws.stepContent}>
      <Text style={ws.stepTitle}>Hoe heet je?</Text>
      <Text style={ws.stepSubtitle}>Stel je weergavenaam in</Text>

      <TextInput
        style={ws.nameInput}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Je naam"
        placeholderTextColor="#848484"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleNextStep1}
      />
    </View>
  );

  // ── Step 2: Gender ──
  const renderStep2 = () => (
    <View style={ws.stepContent}>
      <Text style={ws.stepTitle}>Geslacht</Text>
      <Text style={ws.stepSubtitleGender}>Hoe wil je aangesproken worden?</Text>

      <View style={ws.genderGrid}>
        {GENDER_OPTIONS.map((opt) => {
          const anim = genderAnims[opt.value];
          const animBorderColor = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.15)', '#00BEAE'],
          });
          const animBgColor = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.06)', 'rgba(0,190,174,0.1)'],
          });
          const animIconColor = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#848484', '#00BEAE'],
          });
          const animTextColor = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['#FFFFFF', '#00BEAE'],
          });
          return (
            <Animated.View
              key={opt.value}
              style={[
                ws.genderOption,
                { borderColor: animBorderColor, backgroundColor: animBgColor },
              ]}
            >
              <Pressable
                style={ws.genderOptionPressable}
                onPress={() => setGender(opt.value)}
              >
                <Animated.Text style={{ color: animIconColor }}>
                  <Ionicons name={opt.icon as any} size={32} />
                </Animated.Text>
                <Animated.Text style={[ws.genderLabel, { color: animTextColor }]}>
                  {opt.label}
                </Animated.Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );

  // ── Step 3: Avatar ──
  const renderStep3 = () => (
    <View style={ws.stepContent}>
      <Text style={ws.stepTitle}>Profielfoto</Text>
      <Text style={ws.stepSubtitle}>Voeg een profielfoto toe</Text>

      <Pressable style={ws.avatarCircle} onPress={() => setCameraVisible(true)} disabled={uploadingAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={ws.avatarImage} transition={200} cachePolicy="memory-disk" />
        ) : (
          <Ionicons name="camera" size={40} color="#848484" />
        )}
        {uploadingAvatar && (
          <View style={ws.avatarOverlay}>
            <Text style={ws.uploadingText}>Uploaden...</Text>
          </View>
        )}
      </Pressable>

      {avatarUrl && (
        <Text style={ws.avatarHint}>Tik om te wijzigen</Text>
      )}
    </View>
  );

  // ── Step 4: Done ──
  const renderStep4 = () => (
    <View style={ws.stepContent}>
      <View style={ws.doneIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#00BEAE" />
      </View>
      <Text style={ws.doneTitle}>Welkom, {fullName.trim() || 'gebruiker'}!</Text>
      <Text style={ws.doneSubtitle}>Je profiel is ingesteld</Text>
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
      return (
        <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ flex: 1 }} />
          <Pressable
            style={[ws.nextBtn, !fullName.trim() && ws.nextBtnDisabled]}
            onPress={handleNextStep1}
            disabled={!fullName.trim() || savingName}
          >
            <Text style={[ws.nextBtnText, !fullName.trim() && ws.nextBtnTextDisabled]}>
              {savingName ? 'Opslaan...' : 'Volgende'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (step === 2) {
      // Step 2: gender — single button that morphs from "Overslaan" to "Volgende"
      const hasGender = gender !== null;
      const btnBg = genderBtnAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.08)', 'rgba(0, 190, 174, 1)'],
      });
      const textColor = genderBtnAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#848484', '#FFFFFF'],
      });
      return (
        <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={ws.backBtn} onPress={() => goToStep(1)}>
            <Ionicons name="chevron-back" size={18} color="#848484" />
            <Text style={ws.backBtnText}>Terug</Text>
          </Pressable>
          <Animated.View style={[ws.genderBtn, { backgroundColor: btnBg }]}>
            <Pressable
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}
              onPress={hasGender ? handleNextStep2Gender : handleSkipStep2Gender}
            >
              <Animated.Text style={[ws.genderBtnText, { color: textColor }]}>
                {hasGender ? 'Volgende' : 'Overslaan'}
              </Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
      );
    }

    // Step 3: avatar (optional)
    return (
      <View style={[ws.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={ws.backBtn} onPress={() => goToStep(2)}>
          <Ionicons name="chevron-back" size={18} color="#848484" />
          <Text style={ws.backBtnText}>Terug</Text>
        </Pressable>
        <Pressable style={ws.nextBtn} onPress={handleNextStep3Avatar}>
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
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Frosted scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={StyleSheet.absoluteFillObject} />
        <View style={ws.scrim} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[ws.container, { paddingTop: insets.top + 20 }, contentStyle]} pointerEvents="auto">
        {renderProgress()}

        <Animated.View style={[ws.stepContainer, { opacity: stepOpacity }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              {renderCurrentStep()}
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {renderBottomBar()}
      </Animated.View>

      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onImageCaptured={handleImageCaptured}
      />
    </View>
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
  stepSubtitleGender: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginBottom: 50,
  },

  // Step 1: Name input
  nameInput: {
    fontFamily: 'Unbounded',
    width: '100%',
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 25,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Step 2: Gender
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    width: '100%',
  },
  genderOption: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  genderOptionPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  genderLabel: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 8,
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
    color: '#848484',
    fontWeight: '600',
  },
  genderBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  genderBtnActive: {
    backgroundColor: '#00BEAE',
  },
  genderBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    fontWeight: '600',
  },
  genderBtnTextActive: {
    color: '#FFFFFF',
  },

  // Step 3: Avatar
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

  // Step 4: Done
  doneIcon: {
    marginBottom: 16,
    marginTop: 40,
  },
  doneTitle: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
  },
  skipBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skipBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
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
  nextBtnDisabled: {
    backgroundColor: 'rgba(0, 190, 174, 0.3)',
  },
  nextBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  nextBtnTextDisabled: {
    opacity: 0.5,
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
