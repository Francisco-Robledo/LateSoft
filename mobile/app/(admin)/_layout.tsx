import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width > 1140;

  const bottomInset = Math.max(insets.bottom, 8);
  const tabHeight = 56 + bottomInset;

  return (
    <View style={[styles.rootContainer, { backgroundColor: isDesktop ? (isDark ? '#140E0A' : '#EFEAE4') : colors.background }]}>
      <View
        style={[
          styles.appFrame,
          isDesktop && [
            styles.appFrameDesktop,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ],
        ]}
      >
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
              height: tabHeight,
              paddingBottom: bottomInset,
              paddingTop: 6,
              maxWidth: 500,
              width: '100%',
              alignSelf: 'center',
              justifyContent: 'center',
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            tabBarItemStyle: {
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: 90,
              height: 48,
            },
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
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  appFrameDesktop: {
    maxWidth: 1140,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
});
