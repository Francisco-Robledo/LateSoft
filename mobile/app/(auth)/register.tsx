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
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import {
  registerFormSchema,
  sanitizeName,
  sanitizePhone,
  getPasswordChecks,
} from '../../src/utils/validation';

type RegisterFormData = z.infer<typeof registerFormSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { register: registerCustomer, error, isOffline } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const watchedPassword = watch('password') || '';
  const pwdChecks = getPasswordChecks(watchedPassword);

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    try {
      await registerCustomer({
        fullName: data.fullName.trim().replace(/\s+/g, ' '),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        phone: data.phone?.trim() || undefined,
      });
      router.replace('/');
    } catch {
      // Manejado en contexto
    } finally {
      setIsSubmitting(false);
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
        <Text style={[styles.title, { color: colors.text }]}>Creá tu cuenta</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sumate a LateSoft para pedir y retirar al instante
        </Text>
      </View>

      {isOffline && (
        <ErrorBanner
          isOffline
          message="No tenés conexión a Internet. Verificá tu red para registrarte."
        />
      )}

      {error && !isOffline && (
        <ErrorBanner message={error} />
      )}

      <Card style={styles.card}>
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nombre y Apellido *"
              placeholder="Ej. Lucas Rossi"
              autoCapitalize="words"
              maxLength={80}
              value={value}
              onBlur={onBlur}
              onChangeText={(txt) => onChange(sanitizeName(txt))}
              error={errors.fullName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Correo electrónico *"
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoComplete="email"
              maxLength={120}
              value={value}
              onBlur={onBlur}
              onChangeText={(txt) => onChange(txt.replace(/\s/g, ''))}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Teléfono / Celular (opcional)"
              placeholder="+54 11 1234-5678"
              keyboardType="phone-pad"
              maxLength={22}
              value={value || ''}
              onBlur={onBlur}
              onChangeText={(txt) => onChange(sanitizePhone(txt))}
              error={errors.phone?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <View>
              <Input
                label="Contraseña *"
                placeholder="Mínimo 8 caracteres"
                isPassword
                maxLength={64}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.password?.message}
              />
              {watchedPassword.length > 0 && (
                <View style={[styles.pwdChecklist, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={styles.pwdCheckItem}>
                    <Ionicons
                      name={pwdChecks.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={pwdChecks.minLength ? '#16A34A' : colors.textSecondary}
                    />
                    <Text style={[styles.pwdCheckText, { color: pwdChecks.minLength ? '#16A34A' : colors.textSecondary }]}>
                      Al menos 8 caracteres
                    </Text>
                  </View>
                  <View style={styles.pwdCheckItem}>
                    <Ionicons
                      name={pwdChecks.hasUpperAndLower ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={pwdChecks.hasUpperAndLower ? '#16A34A' : colors.textSecondary}
                    />
                    <Text style={[styles.pwdCheckText, { color: pwdChecks.hasUpperAndLower ? '#16A34A' : colors.textSecondary }]}>
                      Una letra mayúscula y una minúscula
                    </Text>
                  </View>
                  <View style={styles.pwdCheckItem}>
                    <Ionicons
                      name={pwdChecks.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={pwdChecks.hasNumber ? '#16A34A' : colors.textSecondary}
                    />
                    <Text style={[styles.pwdCheckText, { color: pwdChecks.hasNumber ? '#16A34A' : colors.textSecondary }]}>
                      Al menos un número
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Repetir Contraseña *"
              placeholder="Repetí la contraseña"
              isPassword
              maxLength={64}
              returnKeyType="done"
              onSubmitEditing={() => {
                handleSubmit(onSubmit)();
              }}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.confirmPassword?.message}
            />
          )}
        />

        <Button
          title="Crear mi cuenta"
          onPress={handleSubmit(onSubmit)}
          isLoading={isSubmitting}
          style={styles.submitBtn}
        />

        <View style={styles.loginPrompt}>
          <Text style={[styles.loginPromptText, { color: colors.textSecondary }]}>¿Ya tenés cuenta?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Iniciá sesión</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2A1810',
  },
  subtitle: {
    fontSize: 14,
    color: '#7D5A44',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 22,
  },
  pwdChecklist: {
    marginTop: -8,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  pwdCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pwdCheckText: {
    fontSize: 12,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 8,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  loginPromptText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6F4E37',
  },
});
