import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/src/constants/Colors';
import { useAuth } from '@/src/contexts/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Vul alle velden in');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Account aanmaken</Text>
        <Text style={styles.subtitle}>Vul je gegevens in</Text>

        <TextInput
          style={styles.input}
          placeholder="Volledige naam"
          placeholderTextColor="#666680"
          value={fullName}
          onChangeText={setFullName}
        />
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
          style={[styles.registerButton, loading && styles.disabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.registerButtonText}>
            {loading ? 'Laden...' : 'Registreren'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginText}>
            Al een account? <Text style={styles.loginTextBold}>Inloggen</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#A0A0A0', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    backgroundColor: '#2D2D44', borderRadius: 12, padding: 16, fontSize: 16,
    color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#3A3A55',
  },
  registerButton: { backgroundColor: Brand.cyan, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  registerButtonText: { color: '#1A1A2E', fontSize: 18, fontWeight: '600' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: '#A0A0A0', fontSize: 15 },
  loginTextBold: { color: Brand.magenta, fontWeight: '600' },
});
