import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';

export default function AuthLayout() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width > 520;

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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
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
    maxWidth: 480,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
});
