import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useGroups } from '@/src/hooks/useGroups';
import { supabase } from '@/src/lib/supabase';

const PENDING_INVITE_KEY = 'streeps_pending_invite_code';

type GroupInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, loading: authLoading } = useAuth();
  const { joinGroup } = useGroups();
  const router = useRouter();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // If not authenticated, save code and redirect to login
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      AsyncStorage.setItem(PENDING_INVITE_KEY, code ?? '').then(() => {
        router.replace('/(auth)/login' as any);
      });
    }
  }, [session, authLoading, code]);

  // Look up the group once authenticated
  useEffect(() => {
    if (authLoading || !session || !code) return;

    const lookup = async () => {
      setLoading(true);
      setError(null);

      const normalizedCode = code.toLowerCase().trim();

      // Find group by invite code
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, avatar_url')
        .eq('invite_code', normalizedCode)
        .single();

      if (groupError || !groupData) {
        setError('Groep niet gevonden');
        setLoading(false);
        return;
      }

      // Check if user is already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', session.user.id)
        .single();

      if (existing) {
        setAlreadyMember(true);
      }

      setGroup(groupData);
      setLoading(false);
    };

    lookup();
  }, [session, authLoading, code]);

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    setError(null);

    const result = await joinGroup(code);
    if (result.error) {
      setError(result.error);
      setJoining(false);
      return;
    }

    router.replace('/(tabs)/home' as any);
  };

  const handleGoHome = () => {
    router.replace('/(tabs)/home' as any);
  };

  // Don't render anything while checking auth — will redirect if needed
  if (authLoading || !session) {
    return (
      <LinearGradient colors={['#0E0D1C', '#202020']} style={s.container}>
        <ActivityIndicator size="large" color="#FF0085" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0E0D1C', '#202020']} style={s.container}>
      <View style={s.content}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#FF0085" />
            <Text style={s.loadingText}>Groep opzoeken...</Text>
          </>
        ) : error && !group ? (
          <>
            <View style={s.iconCircle}>
              <Ionicons name="alert-circle-outline" size={56} color="#FF5272" />
            </View>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.backBtn} onPress={handleGoHome}>
              <Text style={s.backBtnText}>Terug naar home</Text>
            </Pressable>
          </>
        ) : group ? (
          <>
            <View style={s.iconCircle}>
              {group.avatar_url ? (
                <View style={s.avatarCircle}>
                  <Ionicons name="people" size={40} color="#FFFFFF" />
                </View>
              ) : (
                <Ionicons name="people" size={40} color="#FF0085" />
              )}
            </View>

            <Text style={s.groupName}>{group.name}</Text>

            {alreadyMember ? (
              <>
                <Text style={s.subtitle}>Je bent al lid van deze groep</Text>
                <Pressable style={s.joinBtn} onPress={handleGoHome}>
                  <Text style={s.joinBtnText}>Naar groep</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.subtitle}>
                  Je bent uitgenodigd om deel te nemen
                </Text>

                {error ? (
                  <Text style={s.errorText}>{error}</Text>
                ) : null}

                <Pressable
                  style={[s.joinBtn, joining && s.joinBtnDisabled]}
                  onPress={handleJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={s.joinBtnText}>Deelnemen</Text>
                  )}
                </Pressable>
              </>
            )}

            <Pressable style={s.backBtn} onPress={handleGoHome}>
              <Text style={s.backBtnText}>Terug</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  loadingText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginTop: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 0, 133, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontFamily: 'Unbounded-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FF5272',
    marginBottom: 16,
    textAlign: 'center',
  },
  joinBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF0085',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  backBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2D2D44',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  backBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
  },
});
