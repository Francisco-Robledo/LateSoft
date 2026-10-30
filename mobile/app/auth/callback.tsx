import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { LoadingView } from '../../src/components/LoadingView';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const { socialLogin } = useAuth();
  const { showPopup } = usePopup();
  const [hasProcessed, setHasProcessed] = useState(false);

  const providerName = params.state === 'discord' ? 'Discord' : 'GitHub';
  const provider = params.state === 'discord' ? 'DISCORD' : 'GITHUB';

  useEffect(() => {
    if (hasProcessed) return;

    async function handleOAuthCallback() {
      setHasProcessed(true);

      if (params.error) {
        showPopup({
          title: 'Error de Autorización',
          message: params.error_description || `El inicio de sesión con ${providerName} fue cancelado o rechazado.`,
          type: 'error',
          confirmText: 'Volver al Login',
          onConfirm: () => router.replace('/(auth)/login'),
        });
        return;
      }

      if (!params.code) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const redirectUrl = Linking.createURL('auth/callback');
        await socialLogin({
          provider,
          code: params.code,
          redirectUri: redirectUrl,
        });
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
  }, [params, hasProcessed, socialLogin, router, showPopup, provider, providerName]);

  return <LoadingView message={`Verificando autenticación con ${providerName}...`} />;
}
