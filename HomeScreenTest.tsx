// HomeScreen.tsx - Voorbeeld gebruik van aurora componenten
// Dit laat zien hoe je de aurora's integreert met je native UI

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import {
  HeaderAurora,
  CategoryRowAurora,
  DrankenlijstAurora,
  LedenlijstAurora,
  NormaalAurora,
  SpeciaalAurora,
  Cat3Aurora,
  Cat4Aurora,
} from './aurora-components';

// ============================================================
// VOORBEELD: Categorie rij met aurora achtergrond
// ============================================================
const CategoryRow = ({ name, price, AuroraComponent }) => (
  <View style={styles.categoryRow}>
    {/* Aurora als achtergrond */}
    <View style={styles.auroraContainer}>
      <AuroraComponent width={350} height={50} />
    </View>
    {/* Tekst erboven */}
    <View style={styles.categoryContent}>
      <Text style={styles.categoryName}>{name}</Text>
      <Text style={styles.categoryPrice}>{price}</Text>
    </View>
  </View>
);

// ============================================================
// VOORBEELD: Dynamische kleuren aanpassen
// ============================================================
const CustomizableAurora = () => {
  // Gebruiker kan deze kleuren aanpassen!
  const [colors, setColors] = useState({
    color1: '#FF0085',
    color2: '#FF00F5',
    color3: '#00BEAE',
    color4: '#00FE96',
  });

  return (
    <CategoryRowAurora
      color1={colors.color1}
      color2={colors.color2}
      color3={colors.color3}
      color4={colors.color4}
      width={350}
      height={50}
    />
  );
};

// ============================================================
// HOME SCREEN
// ============================================================
export default function HomeScreen() {
  const [count, setCount] = useState(8);

  return (
    <View style={styles.container}>
      {/* Header aurora achtergrond */}
      <HeaderAurora />

      <ScrollView style={styles.scroll}>
        {/* Groep header */}
        <View style={styles.header}>
          <View style={styles.avatar} />
          <Text style={styles.groupName}>It Hok</Text>
        </View>
        <Text style={styles.activeMembers}>3 actief</Text>

        {/* Counter */}
        <View style={styles.counter}>
          <Pressable
            style={styles.counterBtn}
            onPress={() => setCount((c) => Math.max(0, c - 1))}
          >
            <Text style={styles.counterBtnText}>−</Text>
          </Pressable>
          <Text style={styles.counterValue}>{count}</Text>
          <Pressable
            style={styles.counterBtn}
            onPress={() => setCount((c) => c + 1)}
          >
            <Text style={styles.counterBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Categorie rijen met aurora achtergronden */}
        <CategoryRow name="Normaal" price="€ 1,50" AuroraComponent={NormaalAurora} />
        <CategoryRow name="Speciaal" price="€ 2,50" AuroraComponent={SpeciaalAurora} />
        <CategoryRow name="cat3" price="€ 1,50" AuroraComponent={Cat3Aurora} />
        <CategoryRow name="cat4" price="€ 1,50" AuroraComponent={Cat4Aurora} />

        {/* Info sectie */}
        <Text style={styles.sectionTitle}>Info</Text>

        {/* Drankenlijst button met blob aurora */}
        <View style={styles.drankenlijstContainer}>
          <DrankenlijstAurora />
          <Text style={styles.drankenlijstText}>Drankenlijst</Text>
        </View>

        {/* Leden sectie */}
        <View style={styles.ledenSection}>
          <LedenlijstAurora />
          <View style={styles.ledenHeader}>
            <Text style={styles.sectionTitle}>Leden</Text>
            <Text style={styles.ledenCount}>13 leden</Text>
          </View>
          {['Riemer', 'Syme', 'Ruben', 'Hilbren'].map((naam) => (
            <View key={naam} style={styles.lid}>
              <View style={styles.lidAvatar} />
              <Text style={styles.lidNaam}>{naam}</Text>
            </View>
          ))}
          <Text style={styles.bekijkMeer}>Bekijk meer \/</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e', // Donkere achtergrond uit je gradient
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 52,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F1F1F1',
  },
  groupName: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    color: 'white',
    marginLeft: 13,
  },
  activeMembers: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'white',
    paddingHorizontal: 40,
    marginTop: 10,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  counterBtn: {
    width: 125,
    height: 73,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    color: '#F1F1F1',
    fontSize: 24,
  },
  counterValue: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    fontWeight: '600',
    color: 'white',
  },
  categoryRow: {
    marginHorizontal: 20,
    marginTop: 10,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  auroraContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  categoryName: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'white',
  },
  categoryPrice: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'white',
  },
  sectionTitle: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    color: 'white',
    paddingHorizontal: 40,
    marginTop: 30,
  },
  drankenlijstContainer: {
    marginHorizontal: 0,
    marginTop: 20,
    height: 92,
  },
  drankenlijstText: {
    position: 'absolute',
    left: 40,
    top: 36,
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'white',
  },
  ledenSection: {
    marginTop: 20,
    position: 'relative',
  },
  ledenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 40,
  },
  ledenCount: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
  },
  lid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 15,
  },
  lidAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#F1F1F1',
  },
  lidNaam: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    color: 'white',
    marginLeft: 16,
  },
  bekijkMeer: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#848484',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
});
