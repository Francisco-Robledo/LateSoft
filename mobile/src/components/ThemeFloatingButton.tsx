import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export interface ThemeFloatingButtonProps {
  bottomOffset?: number;
  rightOffset?: number;
  style?: ViewStyle;
}

export function ThemeFloatingButton({
  bottomOffset,
  rightOffset = 16,
  style,
}: ThemeFloatingButtonProps) {
  const { isDark, toggleTheme, colors } = useTheme();
  const pathname = usePathname() || '';
  const insets = useSafeAreaInsets();

  // Detección de pantallas con barra de pestañas (Tabs) inferior
  // KDS, Login, Register y SplashScreen son a pantalla completa sin tabs
  const isFullScreenWithoutTabs =
    pathname.includes('/kds') ||
    pathname.includes('/login') ||
    pathname.includes('/register') ||
    pathname === '/' ||
    pathname.includes('/callback');

  // En perfil el usuario ya tiene su selector de tema (Claro / Oscuro / Sistema) y botón de cierre de sesión
  if (pathname.includes('/profile')) {
    return null;
  }

  const safeBottom = Math.max(insets.bottom, 0);
  // Con tabs: 56px de tab + safeBottom + 12px de margen
  // Sin tabs: safeBottom + 16px
  const defaultBottom = isFullScreenWithoutTabs ? (safeBottom + 16) : (56 + safeBottom + 12);
  const calculatedBottom = bottomOffset !== undefined ? bottomOffset : defaultBottom;

  const handlePress = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics no soportado en web
    }
    await toggleTheme();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.button,
        {
          bottom: calculatedBottom,
          right: rightOffset,
          backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
          borderColor: isDark ? colors.border : 'rgba(0, 0, 0, 0.1)',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      accessibilityHint="Alterna la apariencia visual de la aplicación entre modo claro y oscuro"
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={22}
        color={isDark ? '#FBBF24' : '#6F4E37'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        cursor: 'pointer',
      },
    }),
  },
});
