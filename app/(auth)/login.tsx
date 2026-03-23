import React, { useState, useMemo } from 'react';
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
import AuroraBackground from '@/src/components/AuroraBackground';
import PillInput from '@/src/components/PillInput';
import PillButton from '@/src/components/PillButton';
import { brand } from '@/src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Vul alle velden in');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Fout', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex}>
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
              <Text style={styles.title}>Welkom terug.</Text>
              <Text style={styles.subtitle}>Klaar om gas te geven?</Text>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
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
            </View>

            {/* Login Button */}
            <PillButton
              title={loading ? 'Laden...' : 'Log in.'}
              onPress={handleLogin}
              disabled={loading}
              color={brand.magenta}
            />

            {/* "Of" divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Of</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social login */}
            <View style={styles.socialRow}>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Binnenkort beschikbaar')}
              >
                <Ionicons name="logo-google" size={22} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Binnenkort beschikbaar')}
              >
                <Ionicons name="logo-apple" size={24} color="#fff" />
              </Pressable>
            </View>

            {/* Register link */}
            <Text style={styles.bottomText}>Nog geen account?</Text>
            <PillButton
              title="Maak aan."
              onPress={() => router.push('/(auth)/register')}
              color={brand.magenta}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1E' },
  flex: { flex: 1 },
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

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3A3A55',
  },
  dividerText: {
    color: '#666680',
    fontSize: 14,
    marginHorizontal: 16,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  socialBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#252540',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom
  bottomText: {
    fontSize: 14,
    color: '#666680',
    textAlign: 'center',
  },
});
