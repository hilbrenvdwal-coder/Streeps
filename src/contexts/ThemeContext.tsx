import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  preference: 'system',
  setPreference: () => {},
});

const STORAGE_KEY = 'streeps_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setPreferenceState(val);
      }
      setLoaded(true);
    });
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  };

  const theme: 'light' | 'dark' =
    preference === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : preference;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
