import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
  bottomOffset?: number;
  rightOffset?: number;
  style?: ViewStyle;
}

export function ScrollToTopButton({
  visible,
  onPress,
  bottomOffset,
  rightOffset = 16,
  style,
}: ScrollToTopButtonProps) {
  const { colors, isDark } = useTheme();
  const pathname = usePathname() || '';
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  // Detección de pantallas a pantalla completa sin barra de navegación inferior
  const isFullScreenWithoutTabs =
    pathname.includes('/kds') ||
    pathname.includes('/login') ||
    pathname.includes('/register') ||
    pathname === '/' ||
    pathname.includes('/callback');

  // En pantallas con Tabs, la pantalla ya está contenida sobre las tabs.
  // Colocamos el botón de volver arriba justo arriba del botón de tema (44px de alto + 8px separación)
  const safeBottom = Math.max(insets.bottom, 0);
  const defaultBottom = isFullScreenWithoutTabs ? (safeBottom + 68) : (safeBottom + 64);
  const calculatedBottom = bottomOffset !== undefined ? bottomOffset : defaultBottom;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          bottom: calculatedBottom,
          right: rightOffset,
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.button,
          {
            backgroundColor: isDark ? colors.surfaceSecondary : colors.primary,
            borderColor: isDark ? colors.border : 'rgba(255,255,255,0.2)',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Volver al inicio de la pantalla"
        accessibilityHint="Desplaza el contenido al tope superior"
      >
        <Ionicons
          name="arrow-up"
          size={20}
          color={isDark ? colors.primary : '#FFFFFF'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Hook utilitario para vincular cualquier ScrollView o FlatList al botón de Scroll to Top
 */
export function useScrollToTop(threshold = 180) {
  const scrollRef = useRef<any>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const shouldShow = y > threshold;
      setShowScrollTop((prev) => (prev !== shouldShow ? shouldShow : prev));
    },
    [threshold]
  );

  const scrollToTop = useCallback(() => {
    if (!scrollRef.current) return;
    if (typeof scrollRef.current.scrollTo === 'function') {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    } else if (typeof scrollRef.current.scrollToOffset === 'function') {
      scrollRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  return {
    scrollRef,
    showScrollTop,
    handleScroll,
    scrollToTop,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
  },
});
