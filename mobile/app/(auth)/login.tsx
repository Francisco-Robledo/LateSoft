import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { loginFormSchema } from '../../src/utils/validation';

type LoginFormData = z.infer<typeof loginFormSchema>;

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

async function openOAuthUrl(authUrl: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(authUrl);
    return;
  }
  await Linking.openURL(authUrl);
}

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { login, error, isOffline } = useAuth();
  const { showPopup } = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'GOOGLE' | 'DISCORD' | 'GITHUB' | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data.email.trim().toLowerCase(), data.password);
      router.replace('/');
    } catch {
      // Error manejado en el contexto
    } finally {
      setIsSubmitting(false);
    }
  };

  // Credenciales públicas OAuth (con respaldo de producción)
  const googleClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '902407434442-2s8218515agq037sk41gv840knr8c40g.apps.googleusercontent.com';
  const discordClientId = process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID || '1565184562135310506';
  const githubClientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || 'Iv23liztxJqVlxyQ88Yz';

  const hasGoogleConfig = !!googleClientId && !googleClientId.startsWith('mock_');
  const hasDiscordConfig = !!discordClientId && discordClientId !== 'mock_discord_client_id';
  const hasGithubConfig = !!githubClientId && !githubClientId.startsWith('mock_');

  const handleGoogleLogin = async () => {
    if (!hasGoogleConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para iniciar sesión con Google.',
        type: 'warning',
      });
      return;
    }

    setSocialLoading('GOOGLE');
    try {
      const redirectUrl = getOAuthRedirectUri();
      const isNativeMobile = Platform.OS !== 'web';
      const state = isNativeMobile ? 'google_mobile' : 'google';
      const nonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(googleClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent('openid email profile')}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&state=${encodeURIComponent(state)}` +
        `&prompt=select_account`;

      await openOAuthUrl(authUrl);
    } catch (err: any) {
      setSocialLoading(null);
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo iniciar la autenticación con Google.',
        type: 'error',
      });
    }
  };

  const handleDiscordLogin = async () => {
    if (!hasDiscordConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar Discord Client ID.',
        type: 'warning',
      });
      return;
    }

    setSocialLoading('DISCORD');
    try {
      const redirectUrl = getOAuthRedirectUri();
      const isNativeMobile = Platform.OS !== 'web';
      const state = isNativeMobile ? 'discord_mobile' : 'discord';
      const authUrl =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${encodeURIComponent(discordClientId)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&scope=${encodeURIComponent('identify email')}` +
        `&state=${encodeURIComponent(state)}`;
      await openOAuthUrl(authUrl);
    } catch (err: any) {
      setSocialLoading(null);
      showPopup({
        title: 'Error',
        message: err.message || 'Error en Discord Login.',
        type: 'error',
      });
    }
  };

  const handleGithubLogin = async () => {
    if (!hasGithubConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar GitHub Client ID.',
        type: 'warning',
      });
      return;
    }

    setSocialLoading('GITHUB');
    try {
      const redirectUrl = getOAuthRedirectUri();
      const isNativeMobile = Platform.OS !== 'web';
      const state = isNativeMobile ? 'github_mobile' : 'github';
      const authUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${encodeURIComponent(githubClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&scope=${encodeURIComponent('user:email')}` +
        `&state=${encodeURIComponent(state)}`;
      await openOAuthUrl(authUrl);
    } catch (err: any) {
      setSocialLoading(null);
      showPopup({
        title: 'Error',
        message: err.message || 'Error en GitHub Login.',
        type: 'error',
      });
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container} maxWidth={480}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={[styles.logoImage, { borderColor: colors.border }]}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.text }]}>LateSoft</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Café de especialidad en Argentina</Text>
      </View>

      {isOffline && (
        <ErrorBanner
          isOffline
          message="No tenés conexión a Internet. Conectate para iniciar sesión."
        />
      )}

      {error && !isOffline && (
        <ErrorBanner message={error} />
      )}

      <Card style={styles.card}>
        <Text style={[styles.formTitle, { color: colors.text }]}>Iniciar sesión</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoComplete="email"
              maxLength={120}
              returnKeyType="next"
              value={value}
              onBlur={onBlur}
              onChangeText={(txt) => onChange(txt.replace(/\s/g, ''))}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Contraseña"
              placeholder="••••••••"
              isPassword
              maxLength={72}
              returnKeyType="done"
              onSubmitEditing={() => {
                handleSubmit(onSubmit)();
              }}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Button
          title="Ingresar a mi cuenta"
          onPress={handleSubmit(onSubmit)}
          isLoading={isSubmitting}
          style={styles.submitBtn}
        />

        <View style={styles.registerPrompt}>
          <Text style={[styles.registerPromptText, { color: colors.textSecondary }]}>¿No tenés una cuenta?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.registerLink, { color: colors.primary }]}>Registrate acá</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>o ingresá con redes</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.socialContainer}>
        {/* Google */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            (!hasGoogleConfig || !!socialLoading) && styles.socialDisabled,
          ]}
          onPress={handleGoogleLogin}
          disabled={!hasGoogleConfig || !!socialLoading}
          activeOpacity={0.8}
        >
          {socialLoading === 'GOOGLE' ? (
            <ActivityIndicator size="small" color="#DB4437" />
          ) : (
            <Ionicons name="logo-google" size={20} color="#DB4437" />
          )}
          <Text style={[styles.socialButtonText, { color: colors.text }]}>
            {socialLoading === 'GOOGLE' ? 'Redirigiendo a Google...' : 'Continuar con Google'}
          </Text>
        </TouchableOpacity>

        {/* Discord */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            (!hasDiscordConfig || !!socialLoading) && styles.socialDisabled,
          ]}
          onPress={handleDiscordLogin}
          disabled={!hasDiscordConfig || !!socialLoading}
          activeOpacity={0.8}
        >
          {socialLoading === 'DISCORD' ? (
            <ActivityIndicator size="small" color="#5865F2" />
          ) : (
            <Ionicons name="logo-discord" size={20} color="#5865F2" />
          )}
          <Text style={[styles.socialButtonText, { color: colors.text }]}>
            {socialLoading === 'DISCORD' ? 'Redirigiendo a Discord...' : 'Continuar con Discord'}
          </Text>
        </TouchableOpacity>

        {/* GitHub */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            (!hasGithubConfig || !!socialLoading) && styles.socialDisabled,
          ]}
          onPress={handleGithubLogin}
          disabled={!hasGithubConfig || !!socialLoading}
          activeOpacity={0.8}
        >
          {socialLoading === 'GITHUB' ? (
            <ActivityIndicator size="small" color={isDark ? '#F8FAFC' : '#24292E'} />
          ) : (
            <Ionicons name="logo-github" size={20} color={isDark ? '#F8FAFC' : '#24292E'} />
          )}
          <Text style={[styles.socialButtonText, { color: colors.text }]}>
            {socialLoading === 'GITHUB' ? 'Redirigiendo a GitHub...' : 'Continuar con GitHub'}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2A1810',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#7D5A44',
    marginTop: 4,
  },
  card: {
    padding: 22,
  },
  formTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#333',
    marginBottom: 18,
  },
  submitBtn: {
    marginTop: 6,
  },
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  registerPromptText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6F4E37',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5DCD5',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#8D6E63',
    fontWeight: '500',
  },
  socialContainer: {
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E5DCD5',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  socialDisabled: {
    opacity: 0.65,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
