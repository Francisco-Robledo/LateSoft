import { z } from 'zod';

/**
 * Expresiones regulares reutilizables para validación consistente en formularios
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const FULL_NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜñÑ\s'-]+$/;
export const PHONE_ALLOWED_REGEX = /^\+?[\d\s()-]+$/;

/**
 * Sanitizadores de entrada en tiempo real (especialmente necesarios en Web donde
 * keyboardType="numeric" o "phone-pad" no bloquea letras del teclado físico).
 */
export function sanitizeDecimal(value: string): string {
  // Permite dígitos y un único separador decimal (. o ,) con hasta 2 decimales
  const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

export function sanitizeDigitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function sanitizePhone(value: string): string {
  // Permite + solo al principio, números, espacios, guiones y paréntesis
  const hasPlus = value.startsWith('+');
  const body = value.replace(/[^0-9\s()-]/g, '');
  return (hasPlus ? '+' : '') + body;
}

export function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜñÑ\s'-]/g, '');
}

/**
 * Validadores puntuales para formularios controlados con useState
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= 120 && EMAIL_REGEX.test(trimmed);
}

export function validateFullName(name: string, requireLastName = false): string | null {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Ingresá el nombre completo';
  if (trimmed.length < 3) return 'El nombre debe tener al menos 3 caracteres';
  if (trimmed.length > 80) return 'El nombre no puede superar los 80 caracteres';
  if (!FULL_NAME_REGEX.test(trimmed)) {
    return 'El nombre solo puede contener letras y espacios';
  }
  if (requireLastName && trimmed.split(' ').length < 2) {
    return 'Ingresá nombre y apellido';
  }
  return null;
}

export function validatePhone(phone: string, required = false): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return required ? 'Ingresá un número de teléfono' : null;
  }
  if (!PHONE_ALLOWED_REGEX.test(trimmed)) {
    return 'El teléfono contiene caracteres inválidos';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return 'El teléfono debe tener entre 8 y 15 dígitos';
  }
  return null;
}

export function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasUpperAndLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    noSpaces: password.length > 0 && !/\s/.test(password),
  };
}

/**
 * Esquemas Zod para Login y Registro (react-hook-form)
 */
export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresá tu correo electrónico')
    .max(120, 'El correo es demasiado largo')
    .regex(EMAIL_REGEX, 'Ingresá un correo electrónico válido (ej. nombre@dominio.com)'),
  password: z
    .string()
    .min(1, 'Ingresá tu contraseña')
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(72, 'La contraseña es demasiado larga')
    .refine((val) => val.trim().length > 0, 'La contraseña no puede contener solo espacios'),
});

export const registerFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Ingresá tu nombre y apellido')
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(80, 'El nombre no puede superar los 80 caracteres')
      .regex(FULL_NAME_REGEX, 'Solo se permiten letras y espacios (sin números ni símbolos)')
      .refine((val) => val.replace(/\s+/g, ' ').split(' ').length >= 2, {
        message: 'Ingresá tu nombre y apellido completo',
      }),
    email: z
      .string()
      .trim()
      .min(1, 'Ingresá tu correo electrónico')
      .max(120, 'El correo es demasiado largo')
      .regex(EMAIL_REGEX, 'Ingresá un correo electrónico válido (ej. nombre@dominio.com)'),
    phone: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          if (!PHONE_ALLOWED_REGEX.test(val)) return false;
          const digits = val.replace(/\D/g, '');
          return digits.length >= 8 && digits.length <= 15;
        },
        { message: 'Ingresá un teléfono válido (entre 8 y 15 dígitos)' }
      ),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(64, 'La contraseña no puede superar los 64 caracteres')
      .refine((val) => !/\s/.test(val), 'La contraseña no debe contener espacios')
      .refine((val) => /[a-z]/.test(val) && /[A-Z]/.test(val), {
        message: 'Debe incluir al menos una mayúscula y una minúscula',
      })
      .refine((val) => /\d/.test(val), {
        message: 'Debe incluir al menos un número',
      }),
    confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
