import { useTheme } from '@/src/contexts/ThemeContext';

export const useColorScheme = (): 'light' | 'dark' => {
  const { theme } = useTheme();
  return theme;
};
