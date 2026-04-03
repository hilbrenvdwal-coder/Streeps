import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import AuroraLogin from '@/src/components/AuroraLogin';

/**
 * Register screen — exact Figma node 78:12 (390×844)
 *
 * Differences from login:
 * - Different aurora (856×787 at different position)
 * - Subtitle: "Voer uw gegevens in." (no heading!)
 * - 3 inputs: Email, Wachtwoord, Wachtwoord herhalen
 * - Button: 218×25 (wider), "Stuur e-mail verificatie"
 * - No social login, no bottom link
 * - No naam field (comes later in onboarding)
 */

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [confirmHidden, setConfirmHidden] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Vul alle velden in');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Wachtwoorden komen niet overeen');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Ongeldig e-mailadres', 'Controleer je e-mailadres en probeer opnieuw.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const { data: exists } = await supabase.rpc('email_exists', { check_email: normalizedEmail });
    if (exists) {
      Alert.alert('E-mailadres al in gebruik', 'Log in of gebruik een ander e-mailadres.');
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) =>
      Alert.alert('Klopt dit?', `We sturen een bevestiging naar:\n\n${normalizedEmail}`, [
        { text: 'Wijzig', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Klopt!', onPress: () => resolve(true) },
      ])
    );
    if (!confirmed) return;

    setLoading(true);
    // signUp without name — name comes later in onboarding
    const { error } = await signUp(normalizedEmail, password, '');
    setLoading(false);
    if (error) {
      Alert.alert('Fout', error.message);
    } else {
      Alert.alert('Gelukt!', 'Check je e-mail om je account te bevestigen.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  };

  return (
    <View style={s.root}>
      <AuroraLogin variant="register" />
      <StatusBar style="light" />
      <SafeAreaView style={s.flex}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#848484" />
        </Pressable>

        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo — same as login */}
            <View style={s.logoWrap}>
              <Image
                source={require('../../logo_dark.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            {/* Subtitle only — no heading per Figma */}
            <Text style={s.subtitle}>Voer uw gegevens in.</Text>

            {/* Email */}
            <View style={s.inputWrap}>
              <TextInput
                style={s.inputText}
                placeholder="Email"
                placeholderTextColor="#848484"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Wachtwoord */}
            <View style={s.inputWrap}>
              <TextInput
                style={s.inputText}
                placeholder="Wachtwoord"
                placeholderTextColor="#737373"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={passwordHidden}
              />
              <Pressable onPress={() => setPasswordHidden((h) => !h)} style={s.eyeBtn} hitSlop={8}>
                <Ionicons name={passwordHidden ? 'eye-off-outline' : 'eye-outline'} size={16} color="#848484" />
              </Pressable>
            </View>

            {/* Wachtwoord herhalen */}
            <View style={s.inputWrap}>
              <TextInput
                style={s.inputText}
                placeholder="Wachtwoord herhalen"
                placeholderTextColor="#737373"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={confirmHidden}
              />
              <Pressable onPress={() => setConfirmHidden((h) => !h)} style={s.eyeBtn} hitSlop={8}>
                <Ionicons name={confirmHidden ? 'eye-off-outline' : 'eye-outline'} size={16} color="#848484" />
              </Pressable>
            </View>

            {/* Button — 218×25, wider than login */}
            <Pressable
              style={[s.btn, loading && { opacity: 0.4 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={s.btnText}>{loading ? 'Laden...' : 'Stuur e-mail verificatie'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0D1C' },
  flex: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingBottom: 32,
  },

  // Logo
  logoWrap: {
    alignSelf: 'center',
    width: 94,
    height: 94,
    borderRadius: 21,
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.25)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  logo: { width: 94, height: 94 },

  // Figma: only subtitle, no heading
  subtitle: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
    color: '#D9D9D9',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 30,
  },

  // Inputs — same as login
  inputWrap: {
    width: 278,
    height: 50,
    backgroundColor: '#F1F1F1',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 18,
    marginBottom: 23,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.25)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  inputText: {
    flex: 1,
    fontFamily: 'Unbounded',
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A2E',
    height: 50,
  },
  eyeBtn: { marginLeft: 8 },

  // Button — 218×25, wider than login's 144
  btn: {
    alignSelf: 'center',
    width: 218,
    height: 25,
    borderRadius: 25,
    backgroundColor: '#FF0085',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    ...Platform.select({
      ios: { shadowColor: '#FF0085', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6.8 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  btnText: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    fontWeight: '400',
    color: '#F1F1F1',
    lineHeight: 15,
  },
});
