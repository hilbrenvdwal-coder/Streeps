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
import { useAuth } from '@/src/contexts/AuthContext';
import AuroraLogin from '@/src/components/AuroraLogin';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { resetRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [confirmHidden, setConfirmHidden] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!password || !confirmPassword) {
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

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Fout', error.message);
    } else {
      resetRecovery();
      Alert.alert('Gelukt!', 'Je wachtwoord is gewijzigd.', [
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
            {/* Logo */}
            <View style={s.logoWrap}>
              <Image
                source={require('../../logo_dark.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={s.title}>Nieuw wachtwoord</Text>
            <Text style={s.subtitle}>Kies een nieuw wachtwoord.</Text>

            {/* Nieuw wachtwoord */}
            <View style={s.inputWrap}>
              <TextInput
                style={s.inputText}
                placeholder="Nieuw wachtwoord"
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

            {/* Button */}
            <Pressable
              style={[s.btn, loading && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={s.btnText}>{loading ? 'Laden...' : 'Wachtwoord opslaan'}</Text>
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

  // Inputs
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
