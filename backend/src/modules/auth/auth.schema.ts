import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    email: z.string().email('El correo electrónico no es válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    phone: z.string().max(30).optional(),
    // Invariable: Si envian role, se ignora o se rechaza. Aqui lo ignoramos forzando CUSTOMER
    role: z.any().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('El correo electrónico no es válido'),
    password: z.string().min(1, 'La contraseña es requerida'),
  }),
});

export const socialLoginSchema = z.object({
  body: z.object({
    provider: z.enum(['GOOGLE', 'FACEBOOK', 'GITHUB', 'DISCORD'], {
      errorMap: () => ({ message: 'El proveedor social debe ser GOOGLE, FACEBOOK, GITHUB o DISCORD' }),
    }),
    idToken: z.string().optional(),
    accessToken: z.string().optional(),
    code: z.string().optional(),
    redirectUri: z.string().optional(),
  }).refine((data) => {
    if (data.provider === 'GOOGLE') return !!data.idToken;
    if (data.provider === 'FACEBOOK') return !!data.accessToken;
    if (data.provider === 'GITHUB') return !!data.code;
    if (data.provider === 'DISCORD') return !!(data.code || data.accessToken);
    return false;
  }, {
    message: 'Credencial requerida faltante para el proveedor social seleccionado',
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'El token de renovación es requerido'),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'El token de renovación es requerido'),
  }),
});
