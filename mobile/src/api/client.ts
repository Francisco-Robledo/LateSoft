import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
  fieldErrors?: Record<string, string>;
  isOffline?: boolean;
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Almacenamiento del token de acceso en memoria
let inMemoryAccessToken: string | null = null;
let onAuthFailedCallback: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function registerAuthFailedCallback(callback: () => void) {
  onAuthFailedCallback = callback;
}

// Mutex para evitar multiples renovaciones en simultaneo (single-flight refresh)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Interceptor de Peticiones:
// 1. REGLA DEL PROYECTO: En esta arquitectura GET está prohibido, todo se transmite por POST.
//    Convierte cualquier llamada a POST y transfiere 'params' a 'data'.
// 2. Inyecta Bearer token si existe en memoria.
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.method?.toLowerCase() === 'get') {
      config.method = 'post';
      if (config.params && !config.data) {
        config.data = config.params;
        config.params = undefined;
      }
    }

    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas: manejo de 401 y renovacion single-flight
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Si no hay respuesta o falla de red
    if (!error.response) {
      const normalizedError: ApiError = {
        code: 'NETWORK_ERROR',
        message: 'No pudimos conectar con el servidor. Verificá tu conexión a Internet.',
        isOffline: true,
      };
      return Promise.reject(normalizedError);
    }

    const status = error.response.status;
    const isAuthRoute = originalRequest.url?.includes('/auth/login') ||
                        originalRequest.url?.includes('/auth/register') ||
                        originalRequest.url?.includes('/auth/refresh') ||
                        originalRequest.url?.includes('/auth/social');

    // Manejo de expiracion de token (401)
    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await storage.getItem('refreshToken');
        if (!storedRefreshToken) {
          throw new Error('No refresh token');
        }

        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken = refreshRes.data.accessToken;
        const newRefreshToken = refreshRes.data.refreshToken;

        setAccessToken(newAccessToken);
        await storage.setItem('refreshToken', newRefreshToken);

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        await storage.deleteItem('refreshToken').catch(() => {});
        if (onAuthFailedCallback) {
          onAuthFailedCallback();
        }
        return Promise.reject(normalizeError(error));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export function normalizeError(error: any): ApiError {
  if (error.isOffline) return error;

  const res = error.response?.data?.error;
  if (res) {
    const fieldErrors: Record<string, string> = {};
    if (Array.isArray(res.details)) {
      res.details.forEach((d: any) => {
        if (d.path) fieldErrors[d.path] = d.message;
      });
    }

    // Si existen detalles específicos de validación, construimos un mensaje claro y legible
    let message = res.message || 'Ocurrió un error inesperado';
    if (Array.isArray(res.details) && res.details.length > 0) {
      const detailsText = res.details.map((d: any) => `${d.path ? d.path + ': ' : ''}${d.message}`).join(', ');
      message = `${message} (${detailsText})`;
    }

    return {
      code: res.code || 'UNKNOWN_ERROR',
      message,
      details: res.details,
      fieldErrors,
      isOffline: false,
    };
  }

  return {
    code: 'CLIENT_ERROR',
    message: error.message || 'No fue posible completar la operación',
    isOffline: false,
  };
}
