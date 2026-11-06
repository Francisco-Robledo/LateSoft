import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { LoadingView } from '../../src/components/LoadingView';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';

function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return Linking.createURL('auth/callback');
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
    stateParam === 'google' || !!idToken
      ? 'GOOGLE'
      : stateParam === 'discord'
      ? 'DISCORD'
      : 'GITHUB';

  const providerName =
    provider === 'GOOGLE' ? 'Google' : provider === 'DISCORD' ? 'Discord' : 'GitHub';

  useEffect(() => {
    if (hasProcessed) return;

    async function handleOAuthCallback() {
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

  return <LoadingView message={`Verificando autenticación con ${providerName}...`} />;
}
