import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

export default function ConfirmScreen() {
  const { token_hash, type } = useLocalSearchParams<{ token_hash: string; type: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token_hash || !type) return;

    supabase.auth.verifyOtp({ token_hash, type: type as any }).then(({ error }) => {
      if (error) {
        setError('Verificatie mislukt. De link is mogelijk verlopen.');
        setTimeout(() => router.replace('/(auth)/login'), 3000);
      }
      // Op succes vuurt onAuthStateChange → _layout.tsx navigeert naar home
    });
  }, [token_hash, type]);

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#FF0085" />
          <Text style={styles.text}>Bezig met verifiëren...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E0D1C',
    gap: 16,
  },
  text: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FF5272',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
