import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { brand, colors, radius, space, typography } from '@/src/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  group: any;
  isDrinkMode: boolean;
  activeCategories: number[];
  categoryColors: readonly string[];
  getCategoryName: (cat: number) => string;
  addDrink: (name: string, category: number, emoji: string, priceOverride?: number) => Promise<void>;
  onDone?: (addedCount: number) => void;
}

/** Converteer centen (integer) naar euro display string met Nederlandse komma-notatie */
function centsToEuroStr(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Converteer euro input string (accepteert komma of punt) naar centen. Retourneert null bij ongeldige invoer. */
function euroStrToCents(str: string): number | null {
  if (!str.trim()) return null;
  const normalized = str.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0.01 || parsed > 99.99) return null;
  return Math.round(parsed * 100);
}

export default function AddDrinkOverlay({
  visible,
  onClose,
  group,
  isDrinkMode,
  activeCategories,
  categoryColors,
  getCategoryName,
  addDrink,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const [nameInput, setNameInput] = useState('');
  const [emojiInput, setEmojiInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number>(1);
  const [sending, setSending] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (visible) {
      setShow(true);
      // reset state
      setNameInput('');
      setEmojiInput('');
      setAddedCount(0);
      setSending(false);
      if (isDrinkMode) {
        setPriceInput(centsToEuroStr(group?.price_category_1 ?? 0));
      } else {
        setPriceInput('');
        setSelectedCategory(activeCategories[0] ?? 1);
      }
      scrimOpacity.setValue(0);
      contentAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(contentAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 300,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const performClose = () => {
    Animated.parallel([
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShow(false);
      onClose();
    });
  };

  const onDoneWithToast = () => {
    onDone?.(addedCount);
    setAddedCount(0);
    setNameInput('');
    setEmojiInput('');
    setPriceInput('');
    performClose();
  };

  const handleSubmit = async () => {
    const name = nameInput.trim();
    if (!name || sending) return;
    const emoji = (emojiInput || '🍺').trim().slice(0, 2);
    setSending(true);
    try {
      if (isDrinkMode) {
        const priceInCents = euroStrToCents(priceInput) ?? (group?.price_category_1 ?? 0);
        await addDrink(name, 1, emoji, priceInCents);
      } else {
        await addDrink(name, selectedCategory, emoji);
      }
      setAddedCount((c) => c + 1);
      setNameInput('');
      setEmojiInput('');
      // priceInput blijft staan in drankmodus voor snelle batch-invoer met zelfde prijs
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  if (!show) return null;

  const contentAnimStyle = {
    opacity: contentAnim,
    transform: [
      { translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
    ],
  };

  const submitDisabled = !nameInput.trim() || sending;

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="none"
      visible={show}
      onRequestClose={onDoneWithToast}
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Scrim */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
          <BlurView
            intensity={30}
            tint="dark"
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.scrim} />
        </Animated.View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              s.container,
              { paddingTop: insets.top + space[5] },
              contentAnimStyle,
            ]}
            pointerEvents="auto"
          >
            {/* Header */}
            <View style={s.header}>
              <Pressable onPress={onDoneWithToast} hitSlop={12} accessibilityLabel="Sluiten" accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.dark.text.primary} />
              </Pressable>
              <Text style={s.title}>Drankje toevoegen</Text>
              <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
              keyboardVerticalOffset={-(insets.bottom + space[4])}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: space[6] }}
                style={{ flex: 1 }}
              >
                {/* Naam */}
                <Text style={s.label}>Naam</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Bier"
                  // TODO(theme-migration): placeholder color #6B6B6B replaced with brand.inactive (#848484); ~+24 luminance shift (slightly lighter placeholder)
                  placeholderTextColor={brand.inactive}
                  style={s.input}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />

                {/* Emoji */}
                <Text style={s.label}>Emoji</Text>
                <TextInput
                  value={emojiInput}
                  onChangeText={(v) => setEmojiInput(v.slice(0, 2))}
                  placeholder="🍺"
                  // TODO(theme-migration): placeholder color #6B6B6B replaced with brand.inactive (#848484); ~+24 luminance shift (slightly lighter placeholder)
                  placeholderTextColor={brand.inactive}
                  style={s.input}
                  maxLength={2}
                />

                {isDrinkMode ? (
                  <>
                    <Text style={s.label}>Prijs</Text>
                    <View style={s.priceInputWrap}>
                      <Text style={s.priceEuroPrefix}>€</Text>
                      <TextInput
                        value={priceInput}
                        onChangeText={setPriceInput}
                        placeholder="1,50"
                        // TODO(theme-migration): placeholder color #6B6B6B replaced with brand.inactive (#848484); ~+24 luminance shift (slightly lighter placeholder)
                        placeholderTextColor={brand.inactive}
                        style={s.priceInput}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={s.label}>Categorie</Text>
                    <View style={s.catPillRow}>
                      {activeCategories.map((cat) => {
                        const color = categoryColors[(cat - 1) % categoryColors.length];
                        const selected = selectedCategory === cat;
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => {
                              setSelectedCategory(cat);
                              Haptics.selectionAsync();
                            }}
                            style={[
                              s.catPill,
                              {
                                backgroundColor: selected ? color : color + '20',
                                borderColor: color,
                                borderWidth: selected ? 0 : 1,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <Text
                              style={[
                                s.catPillText,
                                { color: selected ? colors.dark.background.primary : color },
                              ]}
                            >
                              {getCategoryName(cat)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {addedCount > 0 && (
                  <Text style={s.addedCountHint}>
                    {addedCount === 1 ? '1 drankje toegevoegd' : `${addedCount} drankjes toegevoegd`}
                  </Text>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={[s.footer, { paddingBottom: insets.bottom + space[4] }]}>
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitDisabled}
                  style={({ pressed }) => [
                    s.primaryBtn,
                    submitDisabled && { opacity: 0.45 },
                    pressed && !submitDisabled && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Toevoegen"
                >
                  <Text style={s.primaryBtnText}>{sending ? 'Bezig...' : 'Toevoegen'}</Text>
                </Pressable>
                <Pressable
                  onPress={onDoneWithToast}
                  style={({ pressed }) => [s.ghostBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Klaar"
                >
                  <Text style={s.ghostBtnText}>Klaar</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  container: {
    flex: 1,
    paddingHorizontal: space[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  title: {
    fontFamily: 'Unbounded',
    fontSize: typography.heading3.fontSize,
    fontWeight: '500',
    color: colors.dark.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  label: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): label fontSize 13 kept literal; no exact typography scale match (caption=12, bodySm=14)
    fontSize: 13,
    color: brand.inactive,
    marginTop: space[2],
    marginBottom: 6,
  },
  input: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): input fontSize 15 kept literal; no exact typography scale match (bodySm=14, body=16)
    fontSize: 15,
    color: colors.dark.text.primary,
    // TODO(theme-migration): background #2A2A2A mapped to colors.dark.surface.default (#252540); hue shifts neutral grey -> bluish tint
    backgroundColor: colors.dark.surface.default,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: space[3],
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    // TODO(theme-migration): background #2A2A2A mapped to colors.dark.surface.default (#252540); hue shifts neutral grey -> bluish tint
    backgroundColor: colors.dark.surface.default,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  priceEuroPrefix: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): prefix fontSize 15 kept literal; no exact typography scale match
    fontSize: 15,
    color: brand.inactive,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'Unbounded',
    // TODO(theme-migration): priceInput fontSize 15 kept literal; no exact typography scale match
    fontSize: 15,
    color: colors.dark.text.primary,
    paddingVertical: space[3],
  },
  catPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: space[2],
    // TODO(theme-migration): catPill borderRadius 14 mapped to radius.lg (16); +2px change
    borderRadius: radius.lg,
  },
  catPillText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): catPillText fontSize 13 kept literal; no exact typography scale match
    fontSize: 13,
    fontWeight: '600',
  },
  addedCountHint: {
    fontFamily: 'Unbounded',
    fontSize: typography.caption.fontSize,
    color: brand.cyan,
    marginTop: space[3],
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: space[4],
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: brand.cyan,
    paddingVertical: 14,
    // TODO(theme-migration): primaryBtn borderRadius 14 mapped to radius.lg (16); +2px change
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): primaryBtnText fontSize 15 kept literal; no exact typography scale match
    fontSize: 15,
    fontWeight: '600',
    color: colors.dark.text.primary,
  },
  ghostBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    // TODO(theme-migration): ghostBtn borderRadius 14 mapped to radius.lg (16); +2px change
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // TODO(theme-migration): border #3A3A3A mapped to colors.dark.border.strong (#3A3A55); hue shifts neutral grey -> bluish tint
    borderColor: colors.dark.border.strong,
  },
  ghostBtnText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): ghostBtnText fontSize 15 kept literal; no exact typography scale match
    fontSize: 15,
    fontWeight: '500',
    color: colors.dark.text.primary,
  },
});
