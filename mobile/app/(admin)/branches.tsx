import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { apiClient } from '../../src/api/client';

export default function AdminBranchesScreen() {
  const { colors, isDark } = useTheme();
  const { showPopup, showConfirm } = usePopup();
  const [branches, setBranches] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Formulario de Sucursal
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('+54 11 4000-0000');
  const [taxRate, setTaxRate] = useState('21.00');

  const fetchBranches = useCallback(async () => {
    try {
      const res = await apiClient.post('/branches', { activeOnly: false });
      setBranches(res.data.data);
    } catch (err) {
      console.error('[AdminBranches] Error:', err);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleNameChange = (val: string) => {
    setName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
  };

  const handleCreateBranch = async () => {
    if (!name || !address || !phone) {
      showPopup({
        title: 'Campos requeridos',
        message: 'Por favor completá nombre, dirección y teléfono.',
        type: 'warning',
      });
      return;
    }

    try {
      const branchSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const payload = {
        name,
        slug: branchSlug.toLowerCase().trim(),
        address,
        latitude: -34.6037,
        longitude: -58.3816,
        phone,
        taxRate: parseFloat(taxRate) || 21.00,
        openingHours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '21:00' },
          saturday: { open: '09:00', close: '21:00' },
          sunday: { open: '09:00', close: '20:00' },
        },
      };

      await apiClient.post('/branches', payload);
      showPopup({
        title: 'Éxito',
        message: 'Sucursal dada de alta correctamente.',
        type: 'success',
      });

      setIsModalVisible(false);
      setName('');
      setSlug('');
      setAddress('');
      fetchBranches();
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo crear la sucursal',
        type: 'error',
      });
    }
  };

  const handleToggleActive = async (branch: any) => {
    if (branch.is_active) {
      showConfirm({
        title: 'Desactivar sucursal',
        message: `¿Estás seguro de que querés desactivar la sucursal "${branch.name}"?`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        isDestructive: true,
        onConfirm: async () => {
          try {
            await apiClient.delete(`/branches/${branch.id}`);
            showPopup({
              title: 'Sucursal desactivada',
              message: `La sucursal "${branch.name}" fue desactivada.`,
              type: 'info',
            });
            fetchBranches();
          } catch (err: any) {
            showPopup({
              title: 'Error',
              message: err.message || 'No se pudo desactivar la sucursal',
              type: 'error',
            });
          }
        },
      });
    } else {
      try {
        await apiClient.put(`/branches/${branch.id}`, { isActive: true });
        showPopup({
          title: 'Sucursal reactivada',
          message: `La sucursal "${branch.name}" fue reactivada.`,
          type: 'success',
        });
        fetchBranches();
      } catch (err: any) {
        showPopup({
          title: 'Error',
          message: err.message || 'No se pudo reactivar la sucursal',
          type: 'error',
        });
      }
    }
  };

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Gestión de Sucursales</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Alta, baja y configuración de locales</Text>
        </View>
        <Button
          title="+ Nueva Sucursal"
          size="small"
          onPress={() => setIsModalVisible(true)}
        />
      </View>

      <FlatList
        data={branches}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.branchCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.branchName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.branchSlug, { color: colors.primary }]}>Slug QR: {item.slug}</Text>
              </View>
              <View style={[styles.badge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, item.is_active ? styles.textActive : styles.textInactive]}>
                  {item.is_active ? 'ACTIVA' : 'INACTIVA'}
                </Text>
              </View>
            </View>

            <Text style={[styles.branchAddress, { color: colors.textSecondary }]}>{item.address}</Text>
            <Text style={[styles.branchMeta, { color: colors.textSecondary }]}>
              Coords: ({item.latitude}, {item.longitude}) • IVA: {item.tax_rate}%
            </Text>

            <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, item.is_active ? styles.btnDanger : styles.btnSuccess]}
                onPress={() => handleToggleActive(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.is_active ? 'Desactivar' : 'Activar'} ${item.name}`}
              >
                <Text style={styles.toggleBtnText}>
                  {item.is_active ? 'Desactivar' : 'Activar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />

      {/* Modal Nueva Sucursal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Sucursal</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel="Cerrar modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Nombre del local (ej. LateSoft Recoleta)"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={handleNameChange}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Slug único para QR (ej. recoleta)"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              value={slug}
              onChangeText={setSlug}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Dirección completa"
              placeholderTextColor={colors.placeholder}
              value={address}
              onChangeText={setAddress}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Teléfono"
                placeholderTextColor={colors.placeholder}
                value={phone}
                onChangeText={setPhone}
              />
              <TextInput
                style={[styles.modalInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Alícuota IVA (%)"
                placeholderTextColor={colors.placeholder}
                value={taxRate}
                onChangeText={setTaxRate}
              />
            </View>

            <Button title="Crear Sucursal" onPress={handleCreateBranch} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1810',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7D5A44',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  branchCard: {
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  branchName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1810',
  },
  branchSlug: {
    fontSize: 12,
    color: '#6F4E37',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: '#E8F5E9',
  },
  badgeInactive: {
    backgroundColor: '#FFEBEE',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textActive: {
    color: '#2E7D32',
  },
  textInactive: {
    color: '#C62828',
  },
  branchAddress: {
    fontSize: 13,
    color: '#555',
    marginVertical: 4,
  },
  branchMeta: {
    fontSize: 11,
    color: '#888',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  btnDanger: {
    backgroundColor: '#FFEBEE',
  },
  btnSuccess: {
    backgroundColor: '#E8F5E9',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2A1810',
  },
  modalInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 10,
  },
});
