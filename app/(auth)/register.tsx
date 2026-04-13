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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import AuroraLogin from '@/src/components/AuroraLogin';

const mapAuthError = (msg?: string): string => {
  if (!msg) return 'Er ging iets mis. Probeer het opnieuw.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail of wachtwoord klopt niet.';
  if (m.includes('email not confirmed')) return 'Bevestig eerst je e-mail via de link die we je stuurden.';
  if (m.includes('user already registered')) return 'Dit e-mailadres heeft al een account.';
  if (m.includes('password should be at least')) return 'Wachtwoord moet minimaal 6 tekens zijn.';
  if (m.includes('network')) return 'Geen internetverbinding. Controleer je netwerk.';
  return msg;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const emailRef = React.useRef<TextInput>(null);
  const passwordRef = React.useRef<TextInput>(null);
  const confirmRef = React.useRef<TextInput>(null);

  const validateEmail = (v: string): string | null => {
    const t = v.trim();
    if (!t) return 'Vul je e-mailadres in.';
    if (!EMAIL_RE.test(t)) return 'Dit ziet er niet uit als een geldig e-mailadres.';
    return null;
  };
  const validatePassword = (v: string): string | null => {
    if (!v) return 'Kies een wachtwoord.';
    if (v.length < 6) return 'Minimaal 6 tekens.';
    return null;
  };
  const validateConfirm = (v: string, pw: string): string | null => {
    if (!v) return 'Herhaal je wachtwoord.';
    if (v !== pw) return 'Wachtwoorden komen niet overeen.';
    return null;
  };

  const handleRegister = async () => {
    setFormError(null);
    setSuccess(null);

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validateConfirm(confirmPassword, password);

    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmError(cErr);

    if (eErr) { emailRef.current?.focus(); return; }
    if (pErr) { passwordRef.current?.focus(); return; }
    if (cErr) { confirmRef.current?.focus(); return; }

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      const { data: exists } = await supabase.rpc('email_exists', { check_email: normalizedEmail });
      if (exists) {
        setEmailError('Dit e-mailadres heeft al een account. Log in of gebruik een ander adres.');
        emailRef.current?.focus();
        setLoading(false);
        return;
      }

      const { error } = await signUp(normalizedEmail, password, '');
      if (error) {
        setFormError(mapAuthError(error.message));
        setLoading(false);
        return;
      }

      setSuccess(`We hebben een bevestigingsmail gestuurd naar ${normalizedEmail}. Klik op de link om je account te activeren.`);
      setLoading(false);
    } catch (err: any) {
      setFormError(mapAuthError(err?.message));
      setLoading(false);
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

            {success ? (
              <View style={s.successBox}>
                <Ionicons name="checkmark-circle" size={32} color="#00FE96" />
                <Text style={s.successTitle}>Check je e-mail.</Text>
                <Text style={s.successText}>{success}</Text>
                <Pressable
                  style={({ pressed }) => [s.btnPrimary, pressed && s.btnPrimaryPressed]}
                  onPress={() => router.replace('/(auth)/login')}
                  accessibilityRole="button"
                >
                  <Text style={s.btnText}>Terug naar login</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Email */}
                <View style={[s.inputWrap, emailError && s.inputWrapError]}>
                  <TextInput
                    ref={emailRef}
                    style={s.inputText}
                    placeholder="Email"
                    placeholderTextColor="#848484"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (emailError) setEmailError(null);
                    }}
                    onBlur={() => setEmailError(validateEmail(email))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>
                {emailError && <Text style={s.fieldError}>{emailError}</Text>}

                {/* Wachtwoord */}
                <View style={[s.inputWrap, passwordError && s.inputWrapError]}>
                  <TextInput
                    ref={passwordRef}
                    style={s.inputText}
                    placeholder="Wachtwoord"
                    placeholderTextColor="#737373"
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (passwordError) setPasswordError(null);
                      if (confirmPassword && confirmError) {
                        setConfirmError(validateConfirm(confirmPassword, v));
                      }
                    }}
                    secureTextEntry={passwordHidden}
                    textContentType="newPassword"
                    autoComplete="password-new"
                    passwordRules="minlength: 6;"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  <Pressable
                    onPress={() => setPasswordHidden((h) => !h)}
                    style={({ pressed }) => [s.eyeBtn, pressed && { opacity: 0.6 }]}
                    hitSlop={16}
                    accessibilityRole="button"
                    accessibilityLabel={passwordHidden ? 'Wachtwoord tonen' : 'Wachtwoord verbergen'}
                  >
                    <Ionicons name={passwordHidden ? 'eye-off-outline' : 'eye-outline'} size={16} color="#848484" />
                  </Pressable>
                </View>
                {passwordError && <Text style={s.fieldError}>{passwordError}</Text>}

                {/* Wachtwoord herhalen */}
                <View style={[s.inputWrap, confirmError && s.inputWrapError]}>
                  <TextInput
                    ref={confirmRef}
                    style={s.inputText}
                    placeholder="Wachtwoord herhalen"
                    placeholderTextColor="#737373"
                    value={confirmPassword}
                    onChangeText={(v) => {
                      setConfirmPassword(v);
                      if (confirmError) setConfirmError(null);
                    }}
                    secureTextEntry={confirmHidden}
                    textContentType="newPassword"
                    autoComplete="password-new"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  <Pressable
                    onPress={() => setConfirmHidden((h) => !h)}
                    style={({ pressed }) => [s.eyeBtn, pressed && { opacity: 0.6 }]}
                    hitSlop={16}
                    accessibilityRole="button"
                    accessibilityLabel={confirmHidden ? 'Wachtwoord tonen' : 'Wachtwoord verbergen'}
                  >
                    <Ionicons name={confirmHidden ? 'eye-off-outline' : 'eye-outline'} size={16} color="#848484" />
                  </Pressable>
                </View>
                {confirmError && <Text style={s.fieldError}>{confirmError}</Text>}

                {/* Form-level error */}
                {formError && (
                  <View style={s.formErrorBox}>
                    <Ionicons name="alert-circle" size={14} color="#FF5A5A" />
                    <Text style={s.formErrorText}>{formError}</Text>
                  </View>
                )}

                {/* Register button */}
                <Pressable
                  style={({ pressed }) => [
                    s.btnPrimary,
                    pressed && s.btnPrimaryPressed,
                    loading && s.btnDisabled,
                  ]}
                  onPress={handleRegister}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#F1F1F1" />
                  ) : (
                    <Text style={s.btnText}>Stuur e-mail verificatie</Text>
                  )}
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
    fontSize: 14,
    fontWeight: '400',
    color: '#F1F1F1',
    lineHeight: 15,
  },

  /* ── Field + form error styles ── */
  inputWrapError: { borderWidth: 1, borderColor: '#FF5A5A' },
  fieldError: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    color: '#FF5A5A',
    marginTop: -16,
    marginBottom: 12,
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  formErrorText: { fontFamily: 'Unbounded', fontSize: 11, color: '#FF5A5A' },

  /* ── Upgraded primary button ── */
  btnPrimary: {
    alignSelf: 'center',
    minWidth: 160,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF0085',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#FF0085', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  btnPrimaryPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  btnDisabled: { opacity: 0.5 },

  /* ── Success state ── */
  successBox: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  successTitle: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  successText: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
    color: '#D9D9D9',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
});
