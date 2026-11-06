import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminLayout() {
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
          tabBarItemStyle: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            height: 48,
            paddingHorizontal: isDesktop ? 12 : 4,
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
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="branches"
          options={{
            title: 'Sucursales',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: 'Catálogo',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="managers"
          options={{
            title: 'Usuarios',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color as string} />
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
