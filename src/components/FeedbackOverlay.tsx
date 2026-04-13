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

      <Animated.View style={[s.container, { paddingTop: insets.top + 12 }, contentAnimStyle]} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          pointerEvents="auto"
        >
          <View style={s.header}>
            <Pressable onPress={performClose} hitSlop={12} disabled={submitting}>
              <Ionicons name="close" size={24} color={submitting ? '#848484' : '#FFFFFF'} />
            </Pressable>
            <Text style={s.headerTitle}>Feedback</Text>
            <View style={{ width: 24 }} />
          </View>

          {success ? (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#00BEAE" />
              <Text style={s.successTitle}>Bedankt!</Text>
              <Text style={s.successBody}>Je feedback is ontvangen. We kijken ernaar.</Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
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
                  placeholderTextColor="#848484"
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
                  <ActivityIndicator size="small" color="#0E0D1C" />
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
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontFamily: 'Unbounded', fontSize: 24, fontWeight: '400', color: '#FFFFFF' },
  intro: { fontFamily: 'Unbounded', fontSize: 14, color: '#BBBBBB', lineHeight: 22, marginTop: 24, marginBottom: 20, paddingHorizontal: 4 },
  card: { borderRadius: 25, backgroundColor: 'rgba(78, 78, 78, 0.2)', padding: 16, minHeight: 200 },
  textInput: { fontFamily: 'Unbounded', fontSize: 14, color: '#FFFFFF', minHeight: 180, maxHeight: 260 },
  charCount: { fontFamily: 'Unbounded', fontSize: 11, color: '#848484', textAlign: 'right', marginTop: 6, marginRight: 4 },
  submitBtn: { marginTop: 24, height: 50, borderRadius: 25, backgroundColor: '#00BEAE', alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontFamily: 'Unbounded', fontSize: 16, fontWeight: '600', color: '#0E0D1C' },
  successBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  successTitle: { fontFamily: 'Unbounded', fontSize: 22, color: '#FFFFFF', marginTop: 16 },
  successBody: { fontFamily: 'Unbounded', fontSize: 14, color: '#BBBBBB', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
});
