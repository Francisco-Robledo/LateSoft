import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { LoadingView } from '../src/components/LoadingView';

export default function Index() {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'LOADING') return;

    if (status === 'UNAUTHENTICATED') {
      router.replace('/(auth)/login');
      return;
    }

    if (status === 'AUTHENTICATED') {
      switch (role) {
        case 'CUSTOMER':
          router.replace('/(customer)/home');
          break;
        case 'CASHIER':
          router.replace('/(staff)/pos');
          break;
        case 'BARISTA':
          router.replace('/(staff)/kds');
          break;
        case 'MANAGER':
          router.replace('/(staff)/manager');
          break;
        case 'ADMIN':
          router.replace('/(admin)/dashboard');
          break;
        default:
          router.replace('/(auth)/login');
      }
    }
  }, [status, role, router]);

  return <LoadingView message="Verificando sesión..." />;
}
