import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function StaffLayout() {
  const { role } = useAuth();
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
