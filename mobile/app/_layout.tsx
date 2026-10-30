// Layout Raíz de la Aplicación LateSoft
import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/context/ThemeContext';
import { PopupProvider } from '../src/context/PopupContext';
import { AuthProvider } from '../src/context/AuthContext';
import { BranchProvider } from '../src/context/BranchContext';
import { CartProvider } from '../src/context/CartContext';
import { ThemeFloatingButton } from '../src/components/ThemeFloatingButton';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PopupProvider>
        <AuthProvider>
          <BranchProvider>
            <CartProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(customer)" options={{ headerShown: false }} />
                <Stack.Screen name="(staff)" options={{ headerShown: false }} />
                <Stack.Screen name="(admin)" options={{ headerShown: false }} />
              </Stack>
              <ThemeFloatingButton />
            </CartProvider>
          </BranchProvider>
        </AuthProvider>
      </PopupProvider>
    </ThemeProvider>
  );
}
