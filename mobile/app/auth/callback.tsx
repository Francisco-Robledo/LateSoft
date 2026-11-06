import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { LoadingView } from '../../src/components/LoadingView';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';

const DEFAULT_WEB_URL = 'https://latesoft-mobile.vercel.app';

function getWebBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL;
}

function getOAuthRedirectUri(): string {
  const base = getWebBaseUrl();
  return `${base}/auth/callback`;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  }>();
  const incomingUrl = Linking.useURL();
  const { socialLogin } = useAuth();
  const { showPopup } = usePopup();
  const [hasProcessed, setHasProcessed] = useState(false);
  const [redirectToAppUrl, setRedirectToAppUrl] = useState<string | null>(null);

  // Extraer fragmentos URL (#id_token=...&state=google) para OAuth2 / OpenID Connect de Google
  const getHashParams = (): URLSearchParams => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
      return new URLSearchParams(window.location.hash.replace(/^#/, ''));
    }
    if (incomingUrl && incomingUrl.includes('#')) {
      const hashPart = incomingUrl.split('#')[1] || '';
      return new URLSearchParams(hashPart);
    }
    return new URLSearchParams();
  };

  const hashParams = getHashParams();
  const stateParam = (params.state as string) || hashParams.get('state') || '';
  const idToken = (params.id_token as string) || hashParams.get('id_token') || '';
  const accessToken = (params.access_token as string) || hashParams.get('access_token') || '';
  const code = (params.code as string) || hashParams.get('code') || '';
  const oauthError = (params.error as string) || hashParams.get('error') || '';
  const oauthErrorDesc =
    (params.error_description as string) || hashParams.get('error_description') || '';

  const provider: 'GOOGLE' | 'DISCORD' | 'GITHUB' =
    stateParam.startsWith('google') || !!idToken
      ? 'GOOGLE'
      : stateParam.startsWith('discord')
      ? 'DISCORD'
      : 'GITHUB';

  const providerName =
    provider === 'GOOGLE' ? 'Google' : provider === 'DISCORD' ? 'Discord' : 'GitHub';

  useEffect(() => {
    if (hasProcessed) return;

    async function handleOAuthCallback() {
      // 1. Si la redirección llega al navegador Web en el celular pero el usuario inició desde la App (APK)
      if (Platform.OS === 'web' && typeof window !== 'undefined' && stateParam.endsWith('_mobile')) {
        setHasProcessed(true);
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        const appDeepLink = `latesoft://auth/callback${hash || search}`;
        try {
          window.location.href = appDeepLink;
        } catch {
          // Si el navegador restringe la redirección automática, el botón en pantalla permite abrirla
        }
        setRedirectToAppUrl(appDeepLink);
        return;
      }

      setHasProcessed(true);

      // Limpiar el hash de la barra de direcciones en Web por seguridad
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
        try {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          // Ignorar si el navegador restringe history API
        }
      }

      if (oauthError) {
        showPopup({
          title: 'Error de Autorización',
          message:
            oauthErrorDesc ||
            `El inicio de sesión con ${providerName} fue cancelado o rechazado (${oauthError}).`,
          type: 'error',
          confirmText: 'Volver al Login',
          onConfirm: () => router.replace('/(auth)/login'),
        });
        return;
      }

      try {
        const redirectUrl = getOAuthRedirectUri();

        if (provider === 'GOOGLE') {
          if (!idToken && !accessToken) {
            router.replace('/(auth)/login');
            return;
          }
          await socialLogin({
            provider: 'GOOGLE',
            idToken: idToken || undefined,
            accessToken: accessToken || undefined,
          });
        } else {
          if (!code) {
            router.replace('/(auth)/login');
            return;
          }
          await socialLogin({
            provider,
            code,
            redirectUri: redirectUrl,
          });
        }

        router.replace('/');
      } catch (err: any) {
        showPopup({
          title: 'Error de Inicio de Sesión',
          message: err.message || `No se pudo validar la sesión con ${providerName}.`,
          type: 'error',
          confirmText: 'Volver al Login',
          onConfirm: () => router.replace('/(auth)/login'),
        });
      }
    }

    handleOAuthCallback();
  }, [
    hasProcessed,
    stateParam,
    oauthError,
    oauthErrorDesc,
    provider,
    providerName,
    idToken,
    accessToken,
    code,
    socialLogin,
    router,
    showPopup,
  ]);

  if (redirectToAppUrl) {
    return (
      <View style={styles.redirectContainer}>
        <Text style={styles.redirectTitle}>¡Identificación exitosa!</Text>
        <Text style={styles.redirectSubtitle}>
          Abriendo la aplicación LateSoft en tu teléfono...
        </Text>
        <TouchableOpacity
          style={styles.openAppButton}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.href = redirectToAppUrl;
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.openAppButtonText}>Abrir la app LateSoft</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <LoadingView message={`Verificando autenticación con ${providerName}...`} />;
}

const styles = StyleSheet.create({
  redirectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAF8F5',
  },
  redirectTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1810',
    marginBottom: 12,
    textAlign: 'center',
  },
  redirectSubtitle: {
    fontSize: 15,
    color: '#7D5A44',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 360,
    lineHeight: 22,
  },
  openAppButton: {
    backgroundColor: '#6F4E37',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  openAppButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
