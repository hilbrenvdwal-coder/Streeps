import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
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
import AuroraBackground from '@/src/components/AuroraBackground';
import PillInput from '@/src/components/PillInput';
import PillButton from '@/src/components/PillButton';
import { brand } from '@/src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
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
    const { error } = await signUp(normalizedEmail, password, fullName);
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
    <View style={styles.root}>
      <AuroraBackground />
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#A0A0B8" />
        </Pressable>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo + Branding */}
            <View style={styles.hero}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../logo_dark.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Account aanmaken</Text>
              <Text style={styles.subtitle}>Vul je gegevens in</Text>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <PillInput
                placeholder="Volledige naam"
                value={fullName}
                onChangeText={setFullName}
              />
              <PillInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <PillInput
                placeholder="Wachtwoord"
                value={password}
                onChangeText={setPassword}
                isPassword
              />
              <PillInput
                placeholder="Wachtwoord herhalen"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
              />
            </View>

            {/* Register Button */}
            <PillButton
              title={loading ? 'Laden...' : 'Stuur e-mail verificatie'}
              onPress={handleRegister}
              disabled={loading}
              color={brand.magenta}
            />

            {/* Login link */}
            <Pressable onPress={() => router.back()} style={styles.link}>
              <Text style={styles.linkText}>
                Al een account?{' '}
                <Text style={styles.linkAccent}>Inloggen</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1E' },
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
    paddingBottom: 40,
  },

  // Hero
  hero: { alignItems: 'center', marginBottom: 40 },
  logoContainer: {
    width: 94,
    height: 94,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  logo: { width: 94, height: 94 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0B8',
    textAlign: 'center',
    marginTop: 8,
  },

  // Inputs
  inputGroup: { gap: 14, marginBottom: 20 },

  // Link
  link: {
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: { fontSize: 14, color: '#666680' },
  linkAccent: { color: '#E91E8C', fontWeight: '600' },
});
