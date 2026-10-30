import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
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

const loginSchema = z.object({
  email: z.string().min(1, 'Ingresá tu correo electrónico').email('El correo no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { login, socialLogin, error, isOffline } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      router.replace('/');
    } catch {
      // Error manejado en el contexto
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verificación de configuración de redes sociales
  const hasGoogleConfig = !!(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  const hasDiscordConfig = !!process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID && process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID !== 'mock_discord_client_id';
  const hasGithubConfig = !!process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;

  const handleGoogleLogin = async () => {
    if (!hasGoogleConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en el archivo .env',
        type: 'warning',
      });
      return;
    }
    setSocialLoading('GOOGLE');
    try {
      showConfirm({
        title: 'Google Sign-In',
        message: 'En un dispositivo real o APK con EAS Build se abre la cuenta nativa de Google. ¿Deseás simular el ingreso como Cliente?',
        confirmText: 'Simular Login',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          await socialLogin({
            provider: 'GOOGLE',
            idToken: 'mock-google-id-token',
          });
          router.replace('/');
        },
      });
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'Error en Google Sign-In',
        type: 'error',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  const handleDiscordLogin = async () => {
    if (!hasDiscordConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar EXPO_PUBLIC_DISCORD_CLIENT_ID en el archivo .env',
        type: 'warning',
      });
      return;
    }
    setSocialLoading('DISCORD');
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const authUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.EXPO_PUBLIC_DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=identify%20email&state=discord`;
      await Linking.openURL(authUrl);
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'Error en Discord Login',
        type: 'error',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGithubLogin = async () => {
    if (!hasGithubConfig) {
      showPopup({
        title: 'Configuración faltante',
        message: 'Falta configurar EXPO_PUBLIC_GITHUB_CLIENT_ID en el archivo .env',
        type: 'warning',
      });
      return;
    }
    setSocialLoading('GITHUB');
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=user:email&state=github`;
      await Linking.openURL(authUrl);
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'Error en GitHub Login',
        type: 'error',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
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
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
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
            !hasGoogleConfig && [styles.socialDisabled, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }],
          ]}
          onPress={handleGoogleLogin}
          disabled={!hasGoogleConfig || !!socialLoading}
        >
          <Ionicons name="logo-google" size={20} color={hasGoogleConfig ? '#DB4437' : colors.textMuted} />
          <Text
            style={[
              styles.socialButtonText,
              { color: colors.text },
              !hasGoogleConfig && { color: colors.textMuted },
            ]}
          >
            Google {!hasGoogleConfig && '(Sin config)'}
          </Text>
        </TouchableOpacity>

        {/* Discord */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !hasDiscordConfig && [styles.socialDisabled, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }],
          ]}
          onPress={handleDiscordLogin}
          disabled={!hasDiscordConfig || !!socialLoading}
        >
          <Ionicons name="logo-discord" size={20} color={hasDiscordConfig ? '#5865F2' : colors.textMuted} />
          <Text
            style={[
              styles.socialButtonText,
              { color: colors.text },
              !hasDiscordConfig && { color: colors.textMuted },
            ]}
          >
            Discord {!hasDiscordConfig && '(Sin config)'}
          </Text>
        </TouchableOpacity>

        {/* GitHub */}
        <TouchableOpacity
          style={[
            styles.socialButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !hasGithubConfig && [styles.socialDisabled, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }],
          ]}
          onPress={handleGithubLogin}
          disabled={!hasGithubConfig || !!socialLoading}
        >
          <Ionicons name="logo-github" size={20} color={hasGithubConfig ? (isDark ? '#F8FAFC' : '#24292E') : colors.textMuted} />
          <Text
            style={[
              styles.socialButtonText,
              { color: colors.text },
              !hasGithubConfig && { color: colors.textMuted },
            ]}
          >
            GitHub {!hasGithubConfig && '(Sin config)'}
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
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    opacity: 0.6,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  socialDisabledText: {
    color: '#999',
  },
});
