import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { storage } from '../utils/storage';
import { apiClient, setAccessToken, registerAuthFailedCallback, ApiError } from '../api/client';

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'BARISTA' | 'CUSTOMER';

export interface User {
  id: number;
  fullName: string;
  email: string | null;
  role: Role;
  branchId: number | null;
  phone: string | null;
}

export type AuthStatus = 'LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  role: Role | null;
  error: string | null;
  isOffline: boolean;
}

type AuthAction =
  | { type: 'RESTORE_TOKEN'; payload: { user: User; accessToken: string } }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: AuthState = {
  status: 'LOADING',
  user: null,
  role: null,
  error: null,
  isOffline: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_TOKEN':
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        status: 'AUTHENTICATED',
        user: action.payload.user,
        role: action.payload.user.role,
        error: null,
        isOffline: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
        role: action.payload.role,
      };
    case 'LOGOUT':
      return {
        ...state,
        status: 'UNAUTHENTICATED',
        user: null,
        role: null,
        error: null,
      };
    case 'SET_OFFLINE':
      return {
        ...state,
        isOffline: action.payload,
        status: state.status === 'LOADING' ? 'UNAUTHENTICATED' : state.status,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { fullName: string; email: string; password: string; phone?: string }) => Promise<void>;
  socialLogin: (data: { provider: 'GOOGLE' | 'FACEBOOK' | 'GITHUB' | 'DISCORD'; idToken?: string; accessToken?: string; code?: string; redirectUri?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { fullName?: string; phone?: string }) => Promise<void>;
  devSwitchUser: (targetRole: Role, branchNumber?: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Inicialización de sesión persistente desde storage (SecureStore nativo / localStorage web)
  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const storedRefreshToken = await storage.getItem('refreshToken');
        if (!storedRefreshToken) {
          if (isMounted) dispatch({ type: 'LOGOUT' });
          return;
        }

        // Renovar token
        const refreshRes = await apiClient.post('/auth/refresh', {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = refreshRes.data;
        setAccessToken(accessToken);
        await storage.setItem('refreshToken', newRefreshToken);

        // Obtener datos del usuario (POST obligatorio)
        const meRes = await apiClient.post('/auth/me');
        if (isMounted) {
          dispatch({
            type: 'RESTORE_TOKEN',
            payload: { user: meRes.data.user, accessToken },
          });
        }
      } catch (err: any) {
        if (err?.isOffline && isMounted) {
          dispatch({ type: 'SET_OFFLINE', payload: true });
        } else if (isMounted) {
          await storage.deleteItem('refreshToken').catch(() => {});
          dispatch({ type: 'LOGOUT' });
        }
      }
    }

    registerAuthFailedCallback(() => {
      dispatch({ type: 'LOGOUT' });
    });

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data;

      setAccessToken(accessToken);
      await storage.setItem('refreshToken', refreshToken);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.message || 'Error al iniciar sesión' });
      throw err;
    }
  };

  const register = async (data: { fullName: string; email: string; password: string; phone?: string }) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await apiClient.post('/auth/register', data);
      const { user, accessToken, refreshToken } = res.data;

      setAccessToken(accessToken);
      await storage.setItem('refreshToken', refreshToken);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.message || 'Error al registrarte' });
      throw err;
    }
  };

  const socialLogin = async (data: { provider: 'GOOGLE' | 'FACEBOOK' | 'GITHUB' | 'DISCORD'; idToken?: string; accessToken?: string; code?: string; redirectUri?: string }) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await apiClient.post('/auth/social', data);
      const { user, accessToken, refreshToken } = res.data;

      setAccessToken(accessToken);
      await storage.setItem('refreshToken', refreshToken);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.message || 'Error al iniciar sesión con redes sociales' });
      throw err;
    }
  };

  const logout = async () => {
    try {
      const token = await storage.getItem('refreshToken');
      if (token) {
        await apiClient.post('/auth/logout', { refreshToken: token }).catch(() => {});
      }
    } finally {
      setAccessToken(null);
      await storage.deleteItem('refreshToken').catch(() => {});
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateProfile = async (data: { fullName?: string; phone?: string }) => {
    const res = await apiClient.post('/users/me', data);
    dispatch({ type: 'UPDATE_USER', payload: res.data.user });
  };

  // Selector de usuarios de prueba en desarrollo
  const devSwitchUser = async (targetRole: Role, branchNumber: number = 1) => {
    let email = 'cliente@gmail.com';
    if (targetRole === 'ADMIN') email = 'admin@latesoft.com.ar';
    else if (targetRole === 'MANAGER') email = branchNumber === 1 ? 'manager.palermo@latesoft.com.ar' : 'manager.belgrano@latesoft.com.ar';
    else if (targetRole === 'CASHIER') email = 'cajero.palermo@latesoft.com.ar';
    else if (targetRole === 'BARISTA') email = 'barista.palermo@latesoft.com.ar';

    await login(email, 'Password123!');
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        socialLogin,
        logout,
        updateProfile,
        devSwitchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
