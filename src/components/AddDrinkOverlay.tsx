import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
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
import * as Haptics from 'expo-haptics';

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
      { translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
  };

  const submitDisabled = !nameInput.trim() || sending;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={s.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDoneWithToast} />
      </Animated.View>

      {/* Card */}
      <View style={s.cardWrap} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={{ width: '100%', alignItems: 'center' }}
        >
          <Animated.View style={[s.card, contentAnimStyle]}>
            {/* Header */}
            <View style={s.header}>
              <Pressable onPress={onDoneWithToast} hitSlop={12} accessibilityLabel="Sluiten" accessibilityRole="button">
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={s.title}>Drankje toevoegen</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Naam */}
              <Text style={s.label}>Naam</Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Bier"
                placeholderTextColor="#6B6B6B"
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
                placeholderTextColor="#6B6B6B"
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
                      placeholderTextColor="#6B6B6B"
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
                              { color: selected ? '#0F0F1E' : color },
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
            <View style={s.footer}>
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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    backgroundColor: '#1F1F1F',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Unbounded',
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  label: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    color: '#848484',
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  priceEuroPrefix: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    color: '#848484',
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'Unbounded',
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 12,
  },
  catPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  catPillText: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '600',
  },
  addedCountHint: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    color: '#00BEAE',
    marginTop: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#00BEAE',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ghostBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  ghostBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
