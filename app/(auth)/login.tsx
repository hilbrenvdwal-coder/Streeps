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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
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
 * Login screen — pixel-exact from Figma CSS export (node 65:11, 390×844).
 *
 * All values taken directly from Figma:
 *   Font: Unbounded (Google Font), weight 400 throughout
 *   Background: linear-gradient(180deg, #0E0D1C → #3D3D3D)
 *   Aurora: #00FE96 vector, blur(44.15px), at (-159,-219) 690×527
 *   Inputs: #F1F1F1, 278×50, border-radius 25px, shadow 0 4 10 rgba(0,0,0,0.25)
 *   Buttons: #FF0085, 144×25, border-radius 25px, glow 0 0 6.8px #FF0085
 *   Social: #F1F1F1 circles 50×50
 */

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = React.useRef<TextInput>(null);
  const emailRef = React.useRef<TextInput>(null);

  const validateEmail = (v: string): string | null => {
    const t = v.trim();
    if (!t) return 'Vul je e-mailadres in.';
    if (!EMAIL_RE.test(t)) return 'Dit ziet er niet uit als een geldig e-mailadres.';
    return null;
  };
  const validatePassword = (v: string): string | null => {
    if (!v) return 'Vul je wachtwoord in.';
    return null;
  };

  const handleLogin = async () => {
    setFormError(null);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr) { emailRef.current?.focus(); return; }
    if (pErr) { passwordRef.current?.focus(); return; }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      setFormError(mapAuthError(error.message));
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <View style={s.root}>
      <AuroraLogin />
      <StatusBar style="light" />
      <SafeAreaView style={s.flex}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Logo ──
              94×94, border-radius 21, drop-shadow(0 4 4 rgba(0,0,0,0.25))
              Figma: (148, 172)
            */}
            <View style={s.logoWrap}>
              <Image
                source={require('../../logo_dark.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            {/* ── "Welkom terug." ──
              Figma: font-size 24, weight 400, color #FFF, center
              at (56, 279), 278×30
            */}
            <Text style={s.title}>Welkom terug.</Text>

            {/* ── "Klaar om gas te geven?" ──
              Figma: font-size 13, weight 400, color #D9D9D9, center
              at (81, 299), 227×58
            */}
            <Text style={s.subtitle}>Klaar om gas te geven?</Text>

            {/* ── Email input ──
              Figma: 278×50, bg #F1F1F1, border-radius 25,
              shadow 0 4 10 rgba(0,0,0,0.25)
              Placeholder: font-size 12, color #848484
              padding-left: 82 - 56 = 26px
            */}
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

            {/* ── Wachtwoord input ──
              Same as email + eye icon 16×16, border 2px solid #848484
              at right edge (300 - 56 = 244px from input left)
            */}
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
                }}
                secureTextEntry={passwordHidden}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setPasswordHidden((h) => !h)}
                style={({ pressed }) => [s.eyeBtn, pressed && { opacity: 0.6 }]}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={passwordHidden ? 'Wachtwoord tonen' : 'Wachtwoord verbergen'}
              >
                <Ionicons
                  name={passwordHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color="#848484"
                />
              </Pressable>
            </View>
            {passwordError && <Text style={s.fieldError}>{passwordError}</Text>}

            {/* ── Wachtwoord vergeten? link ── */}
            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              hitSlop={12}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={s.forgotLink}>Wachtwoord vergeten?</Text>
            </Pressable>

            {/* ── Form-level error ── */}
            {formError && (
              <View style={s.formErrorBox}>
                <Ionicons name="alert-circle" size={14} color="#FF5A5A" />
                <Text style={s.formErrorText}>{formError}</Text>
              </View>
            )}

            {/* ── "Log in." button ── */}
            <Pressable
              style={({ pressed }) => [
                s.btnPrimary,
                pressed && s.btnPrimaryPressed,
                loading && s.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#F1F1F1" />
              ) : (
                <Text style={s.btnText}>Log in.</Text>
              )}
            </Pressable>

            {/* ── "Of" divider ──
              Two lines: 95×4, bg #D9D9D9, border-radius 25
              "Of" text: font-size 12, color #F1F1F1
              Total width: 216px, centered at (87, 581)
            */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>Of</Text>
              <View style={s.dividerLine} />
            </View>

            {/* ── Social circles ──
              50×50, bg #F1F1F1, Google at (129,614), Apple at (211,614)
              gap = 211 - (129+50) = 32px
            */}
            <View style={s.socialRow}>
              <Pressable
                style={s.socialCircle}
                onPress={() => Alert.alert('Binnenkort beschikbaar')}
              >
                <Ionicons name="logo-google" size={21} color="#000" />
              </Pressable>
              <Pressable
                style={s.socialCircle}
                onPress={() => Alert.alert('Binnenkort beschikbaar')}
              >
                <Ionicons name="logo-apple" size={22} color="#000" />
              </Pressable>
            </View>

            {/* ── "Nog geen account?" ──
              Figma: font-size 12, color #848484, weight 400
              at (124, 687), 140×15
            */}
            <Text style={s.bottomLabel}>Nog geen account?</Text>

            {/* ── "Maak aan." button — secondary (outline) ── */}
            <Pressable
              style={({ pressed }) => [
                s.btnSecondary,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="button"
            >
              <Text style={s.btnSecondaryText}>Maak aan.</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0D1C', overflow: 'hidden' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    // Inputs are 278px wide on 390px screen → 56px padding each side
    paddingHorizontal: 56,
    paddingBottom: 32,
  },

  /* ── Logo ── */
  logoWrap: {
    alignSelf: 'center',
    width: 94,
    height: 94,
    borderRadius: 21,
    overflow: 'hidden',
    marginBottom: 13, // gap to title: 279 - (172+94) = 13
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.25)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  logo: { width: 94, height: 94 },

  /* ── Title: "Welkom terug." ── */
  title: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },

  /* ── Subtitle: "Klaar om gas te geven?" ── */
  subtitle: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
    color: '#D9D9D9',
    textAlign: 'center',
    lineHeight: 16,
    // gap to email: 380 - (299+58) = 23, but subtitle starts at y=299
    // total visual gap managed by marginTop + marginBottom
    marginTop: 4,
    marginBottom: 23,
  },

  /* ── Inputs ── 278×50, #F1F1F1, radius 25, shadow */
  inputWrap: {
    width: 278,
    height: 50,
    backgroundColor: '#F1F1F1',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26, // text starts at x=82, input at x=56 → 26px
    paddingRight: 18,
    marginBottom: 23, // gap between inputs: 453 - (380+50) = 23
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.25)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
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
  eyeBtn: {
    marginLeft: 8,
  },

  /* ── Forgot password link ── */
  forgotLink: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    fontWeight: '400',
    color: '#848484',
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 12,
  },

  /* ── Buttons ── 144×25, #FF0085, radius 25, glow 0 0 6.8px #FF0085 */
  btn: {
    alignSelf: 'center',
    width: 144,
    height: 25,
    borderRadius: 25,
    backgroundColor: '#FF0085',
    alignItems: 'center',
    justifyContent: 'center',
    // margin-top adjusts per position
    // Login btn: 533 - (453+50) - 23(last input marginBottom) = 7
    marginTop: 7,
    ...Platform.select({
      ios: {
        shadowColor: '#FF0085',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6.8,
      },
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

  /* ── Upgraded primary/secondary buttons ── */
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
  btnSecondary: {
    alignSelf: 'center',
    minWidth: 160,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnSecondaryText: { fontFamily: 'Unbounded', fontSize: 13, fontWeight: '400', color: '#F1F1F1', lineHeight: 16 },

  /* ── "Of" divider ──
     Two lines 95×4 each, #D9D9D9, radius 25
     "Of": font-size 12, color #F1F1F1
     Total area: 216px wide
  */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: 216,
    marginTop: 23, // 581 - (533+25) = 23
    marginBottom: 18, // 614 - (581+15) = 18
  },
  dividerLine: {
    width: 95,
    height: 4,
    backgroundColor: '#D9D9D9',
    borderRadius: 25,
  },
  dividerText: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    fontWeight: '400',
    color: '#F1F1F1',
    lineHeight: 15,
    marginHorizontal: 6, // (216 - 95 - 95 - ~18text) / 2
    textAlign: 'center',
  },

  /* ── Social circles ── 50×50, bg #F1F1F1, gap 32px */
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 23, // 687 - (614+50) = 23
  },
  socialCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Bottom label ── */
  bottomLabel: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    fontWeight: '400',
    color: '#848484',
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 8, // 710 - (687+15) = 8
  },
});
