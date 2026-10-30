import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { apiClient } from '../../src/api/client';
import { formatPrice } from '../../src/utils/format';

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [loyalty, setLoyalty] = useState<{ pointsBalance: number; lifetimePoints: number } | null>(null);

  React.useEffect(() => {
    apiClient.post('/loyalty/me')
      .then((res) => setLoyalty(res.data.data))
      .catch((err) => console.log('[Loyalty] Error cargando puntos:', err));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ fullName, phone });
      setIsEditing(false);
      showPopup({
        title: 'Éxito',
        message: 'Tus datos fueron actualizados correctamente.',
        type: 'success',
      });
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudieron guardar los cambios.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que querés salir de tu cuenta?',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await logout();
          router.replace('/(auth)/login');
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.message || 'No se pudo cerrar sesión.',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen scrollable showScrollToTop={false} style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Ionicons name="person" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName}</Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || 'Sin correo asociado'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>CLIENTE REGISTRADO</Text>
        </View>
      </View>

      {/* Tarjeta de Fidelización / Puntos */}
      <Card style={[styles.loyaltyCard, isDark && { backgroundColor: '#261C13', borderColor: '#4A371B' }]}>
        <View style={styles.loyaltyHeader}>
          <View style={styles.loyaltyIconCircle}>
            <Ionicons name="sparkles" size={24} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.loyaltyTitle, isDark && { color: '#FCD34D' }]}>LatePoints • Beneficios</Text>
            <Text style={[styles.loyaltySubtitle, isDark && { color: '#FBBF24' }]}>Sumás 1 punto por cada $100 en tus compras</Text>
          </View>
        </View>
        <View style={[styles.loyaltyContent, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={styles.loyaltyPointsNum}>{loyalty?.pointsBalance ?? 0}</Text>
          <Text style={[styles.loyaltyPointsLabel, { color: colors.textSecondary }]}>Puntos Disponibles</Text>
          <Text style={styles.loyaltyDiscountEq}>
            Equivalen a {formatPrice((loyalty?.pointsBalance ?? 0) * 10)} de descuento
          </Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Datos personales</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={[styles.editBtnText, { color: colors.primary }]}>{isEditing ? 'Cancelar' : 'Editar'}</Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            <Input
              label="Nombre y Apellido"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              label="Teléfono / Celular"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Button
              title="Guardar cambios"
              onPress={handleSave}
              isLoading={isSaving}
              style={styles.saveBtn}
            />
          </View>
        ) : (
          <View style={styles.infoList}>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Nombre:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.fullName}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email || 'N/A'}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Teléfono:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.phone || 'No especificado'}</Text>
            </View>
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <TouchableOpacity
          style={[styles.menuRow, { borderBottomColor: colors.border }]}
          onPress={() => router.push('/(customer)/branches')}
        >
          <View style={styles.menuRowLeft}>
            <Ionicons name="star-outline" size={20} color={colors.primary} />
            <Text style={[styles.menuRowText, { color: colors.text }]}>Sucursales favoritas</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuRow, { borderBottomColor: colors.border }]}
          onPress={() => router.push('/(customer)/orders')}
        >
          <View style={styles.menuRowLeft}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={[styles.menuRowText, { color: colors.text }]}>Historial de pedidos</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      {/* Selector de Modo Claro / Oscuro */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Apariencia</Text>
          </View>
        </View>

        <Text style={[styles.themeSubtitle, { color: colors.textSecondary }]}>
          Elegí cómo querés visualizar la aplicación de LateSoft:
        </Text>

        <View style={styles.themeSelectorRow}>
          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: themeMode === 'light' ? colors.primary : colors.inputBg, borderColor: colors.border },
            ]}
            onPress={() => setThemeMode('light')}
          >
            <Ionicons
              name="sunny"
              size={18}
              color={themeMode === 'light' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: themeMode === 'light' ? '#FFFFFF' : colors.text },
              ]}
            >
              Claro
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: themeMode === 'dark' ? colors.primary : colors.inputBg, borderColor: colors.border },
            ]}
            onPress={() => setThemeMode('dark')}
          >
            <Ionicons
              name="moon"
              size={18}
              color={themeMode === 'dark' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: themeMode === 'dark' ? '#FFFFFF' : colors.text },
              ]}
            >
              Oscuro
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: themeMode === 'system' ? colors.primary : colors.inputBg, borderColor: colors.border },
            ]}
            onPress={() => setThemeMode('system')}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={themeMode === 'system' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: themeMode === 'system' ? '#FFFFFF' : colors.text },
              ]}
            >
              Sistema
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Button
        title="Cerrar sesión"
        variant="danger"
        onPress={handleLogout}
        style={styles.logoutBtn}
        icon={<Ionicons name="log-out-outline" size={18} color="#FFF" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#6F4E37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A1810',
  },
  userEmail: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#EFEBE9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6F4E37',
  },
  loyaltyCard: {
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  loyaltyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  loyaltySubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  loyaltyContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  loyaltyPointsNum: {
    fontSize: 32,
    fontWeight: '900',
    color: '#D97706',
  },
  loyaltyPointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
  },
  loyaltyDiscountEq: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginTop: 4,
  },
  card: {
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1810',
  },
  editBtnText: {
    fontSize: 13,
    color: '#6F4E37',
    fontWeight: '700',
  },
  editForm: {
    marginTop: 4,
  },
  saveBtn: {
    marginTop: 8,
  },
  infoList: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#222',
    fontWeight: '600',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  logoutBtn: {
    marginTop: 10,
  },
  themeSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
