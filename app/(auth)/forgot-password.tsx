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
import { supabase } from '@/src/lib/supabase';
import AuroraLogin from '@/src/components/AuroraLogin';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Vul je e-mailadres in');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Ongeldig e-mailadres', 'Controleer je e-mailadres en probeer opnieuw.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'streeps://reset-password',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Fout', error.message);
    } else {
      setSent(true);
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
            {/* Logo */}
            <View style={s.logoWrap}>
              <Image
                source={require('../../logo_dark.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            {sent ? (
              <>
                <Text style={s.title}>Check je e-mail.</Text>
                <Text style={s.subtitle}>
                  We hebben een reset link gestuurd naar {email.trim().toLowerCase()}. Klik op de link in de e-mail om je wachtwoord te wijzigen.
                </Text>
                <Pressable
                  style={s.btn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={s.btnText}>Terug naar login</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.title}>Wachtwoord vergeten?</Text>
                <Text style={s.subtitle}>Vul je e-mailadres in.</Text>

                {/* Email input */}
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

                {/* Button */}
                <Pressable
                  style={[s.btn, loading && { opacity: 0.4 }]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  <Text style={s.btnText}>{loading ? 'Laden...' : 'Verstuur reset link'}</Text>
                </Pressable>
              </>
            )}
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

  // Title
  title: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },

  // Subtitle
  subtitle: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
    color: '#D9D9D9',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 30,
  },

  // Input
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

  // Button
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
