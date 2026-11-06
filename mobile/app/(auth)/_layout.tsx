import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
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
