import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../src/context/CartContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function CustomerLayout() {
  const { totalItemsCount } = useCart();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const bottomInset = Math.max(insets.bottom, 8);
  const tabHeight = isDesktop ? 62 : 56 + bottomInset;

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: isDesktop,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: isDesktop ? 8 : bottomInset,
            paddingTop: 6,
            width: '100%',
            justifyContent: 'center',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
          tabBarItemStyle: isDesktop
            ? {
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: 160,
                height: 48,
                paddingHorizontal: 12,
              }
            : {
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: 90,
                height: 48,
              },
          tabBarLabelStyle: isDesktop
            ? {
                fontSize: 12,
                fontWeight: '600',
                marginTop: 2,
              }
            : { display: 'none' },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Carta',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cafe-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="branches"
          options={{
            title: 'Sucursales',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="location-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: 'Carrito',
            tabBarBadge: totalItemsCount > 0 ? totalItemsCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#C84B31', fontSize: 10 },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Mis Pedidos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Mi Perfil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color as string} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
