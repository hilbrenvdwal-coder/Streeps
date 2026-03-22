import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/src/constants/Colors';
import { useAuth } from '@/src/contexts/AuthContext';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image
          source={require('../../logo_dark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Streeps</Text>
        <Text style={styles.subtitle}>Log in om door te gaan</Text>

        <TextInput
          style={styles.input}
          placeholder="E-mailadres"
          placeholderTextColor="#666680"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Wachtwoord"
          placeholderTextColor="#666680"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? 'Laden...' : 'Inloggen'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          style={styles.registerLink}
        >
          <Text style={styles.registerText}>
            Nog geen account? <Text style={styles.registerTextBold}>Registreren</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 100, height: 100, alignSelf: 'center', marginBottom: 16, borderRadius: 20 },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#A0A0A0', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    backgroundColor: '#2D2D44', borderRadius: 12, padding: 16, fontSize: 16,
    color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#3A3A55',
  },
  loginButton: { backgroundColor: Brand.magenta, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  registerLink: { marginTop: 20, alignItems: 'center' },
  registerText: { color: '#A0A0A0', fontSize: 15 },
  registerTextBold: { color: Brand.cyan, fontWeight: '600' },
});
