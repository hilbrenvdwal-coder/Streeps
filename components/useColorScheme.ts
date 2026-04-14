// Streeps heeft alleen een donker thema. Deze hook blijft bestaan zodat de
// bestaande consumers (9+ files die isDark / mode gebruiken) niet breken.
export function useColorScheme(): 'dark' {
  return 'dark';
}
