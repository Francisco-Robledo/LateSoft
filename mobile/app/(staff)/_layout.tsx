import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function StaffLayout() {
  const { role } = useAuth();
  const { colors, isDark } = useTheme();

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
        name="pos"
        options={{
          title: 'Caja (POS)',
          href: ['CASHIER', 'MANAGER', 'ADMIN'].includes(role || '') ? '/pos' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calculator-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="kds"
        options={{
          title: 'Comandas (KDS)',
          href: ['BARISTA', 'MANAGER', 'ADMIN'].includes(role || '') ? '/kds' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="shift"
        options={{
          title: 'Turno y Caja',
          href: ['CASHIER', 'MANAGER', 'ADMIN'].includes(role || '') ? '/shift' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Gestión Local',
          href: ['MANAGER', 'ADMIN'].includes(role || '') ? '/manager' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
