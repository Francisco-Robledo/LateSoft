import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../src/context/CartContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function CustomerLayout() {
  const { totalItemsCount } = useCart();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarLabel: () => null,
        tabBarLabelStyle: { display: 'none' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56,
          paddingBottom: 0,
          paddingTop: 0,
          maxWidth: 500,
          width: '100%',
          alignSelf: 'center',
          justifyContent: 'center',
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 90,
          height: 56,
        },
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
  );
}
