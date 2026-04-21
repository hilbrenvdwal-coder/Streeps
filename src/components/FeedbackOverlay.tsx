import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';
import { brand, colors, radius, space, typography } from '@/src/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function FeedbackOverlay({ visible, onClose, userId }: Props) {
  const [show, setShow] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setShow(true);
      setContent('');
      setSuccess(false);
      setSubmitting(false);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 150 }),
      ]).start();
    }
  }, [visible]);

  const performClose = () => {
    Animated.parallel([
      Animated.timing(scrimOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setShow(false);
      onClose();
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: userId,
      content: content.trim(),
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Versturen mislukt', error.message || 'Er ging iets mis. Probeer het later opnieuw.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSuccess(true);
    setTimeout(() => {
      performClose();
    }, 2000);
  };

  if (!show) return null;

  const contentAnimStyle = {
    opacity: contentAnim,
    transform: [
      {
        translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
      },
    ],
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={s.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={performClose} />
      </Animated.View>

      <Animated.View style={[s.container, { paddingTop: insets.top + space[3] }, contentAnimStyle]} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          pointerEvents="auto"
        >
          <View style={s.header}>
            <Pressable onPress={performClose} hitSlop={12} disabled={submitting}>
              <Ionicons name="close" size={24} color={submitting ? brand.inactive : colors.dark.text.primary} />
            </Pressable>
            <Text style={s.headerTitle}>Feedback</Text>
            <View style={{ width: 24 }} />
          </View>

          {success ? (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle-outline" size={64} color={brand.cyan} />
              <Text style={s.successTitle}>Bedankt!</Text>
              <Text style={s.successBody}>Je feedback is ontvangen. We kijken ernaar.</Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: space[10] }}
            >
              <Text style={s.intro}>
                Heb je een probleem met de app of een idee om 'm beter te maken? Laat het weten, dan kijken we ernaar.
              </Text>
              <View style={s.card}>
                <TextInput
                  style={s.textInput}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Typ hier je idee of probleem..."
                  placeholderTextColor={brand.inactive}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  editable={!submitting}
                />
              </View>
              <Text style={s.charCount}>{content.length}/2000</Text>
              <Pressable
                style={({ pressed }) => [
                  s.submitBtn,
                  (!content.trim() || submitting) && s.submitBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
                disabled={!content.trim() || submitting}
                onPress={handleSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.dark.background.primary} />
                ) : (
                  <Text style={s.submitText}>Verstuur</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  container: { flex: 1, paddingHorizontal: space[5] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[4] },
  headerTitle: { fontFamily: 'Unbounded', fontSize: 24, fontWeight: '400', color: colors.dark.text.primary },
  // TODO(theme-migration): intro color #BBBBBB mapped to colors.dark.text.secondary (#A0A0B8); ~-27 luminance shift + hue moves neutral -> slight bluish; fontSize 14 = typography.bodySm
  intro: { fontFamily: 'Unbounded', fontSize: typography.bodySm.fontSize, color: colors.dark.text.secondary, lineHeight: 22, marginTop: space[6], marginBottom: space[5], paddingHorizontal: space[1] },
  // TODO(theme-migration): card borderRadius 25 kept literal; no exact radius scale match (xl=20, 2xl=24). rgba(78,78,78,0.2) scrim bg kept as rgba literal per addendum.
  card: { borderRadius: 25, backgroundColor: 'rgba(78, 78, 78, 0.2)', padding: space[4], minHeight: 200 },
  textInput: { fontFamily: 'Unbounded', fontSize: typography.bodySm.fontSize, color: colors.dark.text.primary, minHeight: 180, maxHeight: 260 },
  charCount: { fontFamily: 'Unbounded', fontSize: 11, color: brand.inactive, textAlign: 'right', marginTop: 6, marginRight: space[1] },
  // TODO(theme-migration): submitBtn borderRadius 25 kept literal; no exact radius scale match (xl=20, 2xl=24)
  submitBtn: { marginTop: space[6], height: 50, borderRadius: 25, backgroundColor: brand.cyan, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  // TODO(theme-migration): submitText color #0E0D1C mapped to colors.dark.background.primary (#0F0F1E); perceptually identical dark navy
  submitText: { fontFamily: 'Unbounded', fontSize: typography.body.fontSize, fontWeight: '600', color: colors.dark.background.primary },
  successBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  successTitle: { fontFamily: 'Unbounded', fontSize: typography.heading2.fontSize, color: colors.dark.text.primary, marginTop: space[4] },
  // TODO(theme-migration): successBody color #BBBBBB mapped to colors.dark.text.secondary (#A0A0B8); ~-27 luminance shift + hue moves neutral -> slight bluish
  successBody: { fontFamily: 'Unbounded', fontSize: typography.bodySm.fontSize, color: colors.dark.text.secondary, textAlign: 'center', marginTop: space[2], paddingHorizontal: space[6] },
});
