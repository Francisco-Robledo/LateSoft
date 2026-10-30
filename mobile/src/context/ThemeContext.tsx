import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { storage } from '../utils/storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  inputBg: string;
  placeholder: string;
  badgeBg: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F0EB',
  card: '#FFFFFF',
  cardBorder: '#F0ECE9',
  text: '#111827', // Letras negras/oscuras de máxima legibilidad
  textSecondary: '#4B5563', // Gris oscuro con contraste superior a 5.5:1
  textMuted: '#6B7280',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  primary: '#6F4E37', // Café de especialidad
  primaryLight: '#EFEBE9',
  primaryDark: '#503525',
  accent: '#D4A373',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  success: '#16A34A',
  successBg: '#F0FDF4',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  inputBg: '#FFFFFF',
  placeholder: '#9CA3AF',
  badgeBg: '#EFEBE9',
  shadow: '#000000',
};

export const darkColors: ThemeColors = {
  background: '#121214', // Fondo oscuro profundo
  surface: '#1E1E24', // Superficie oscura elevada
  surfaceSecondary: '#282830',
  card: '#1E1E24',
  cardBorder: '#32323D',
  text: '#F8FAFC', // Letras claras/blancas de máxima legibilidad
  textSecondary: '#CBD5E1', // Texto secundario claro de alto contraste
  textMuted: '#94A3B8',
  border: '#32323D',
  borderLight: '#26262F',
  primary: '#D4A373', // Caramelo / crema cálido de especialidad (alto contraste en oscuro)
  primaryLight: '#2D2319',
  primaryDark: '#B88758',
  accent: '#E6BA8F',
  error: '#F87171',
  errorBg: '#3B1515',
  success: '#4ADE80',
  successBg: '#13351C',
  warning: '#FBBF24',
  warningBg: '#3B2D0A',
  inputBg: '#25252D',
  placeholder: '#94A3B8',
  badgeBg: '#2D2319',
  shadow: '#000000',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  theme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'latesoft_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useDeviceColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const stored = await storage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
      } catch (err) {
        console.warn('[ThemeContext] Error leyendo preferencia de tema:', err);
      }
    }
    loadStoredTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await storage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('[ThemeContext] Error guardando preferencia de tema:', err);
    }
  }, []);

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system'
      ? (systemColorScheme === 'dark' ? 'dark' : 'light')
      : themeMode;

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        theme: resolvedTheme,
        isDark,
        colors,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}
