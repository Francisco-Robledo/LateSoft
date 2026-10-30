import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useBranch, Branch } from '../../src/context/BranchContext';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatDistance } from '../../src/utils/haversine';
import { useTheme } from '../../src/context/ThemeContext';

export default function BranchesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { showPopup } = usePopup();
  const {
    branches,
    selectedBranch,
    selectBranch,
    selectBranchBySlug,
    locationPermissionDenied,
    refreshBranches,
  } = useBranch();

  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteBranchIds, setFavoriteBranchIds] = useState<number[]>([]);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [manualSlug, setManualSlug] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await apiClient.post('/me/favorite-branches');
      const favs: Branch[] = res.data.data;
      setFavoriteBranchIds(favs.map((f) => f.id));
    } catch (err) {
      console.warn('[Branches] Error al obtener favoritas:', err);
    }
  };

  const toggleFavorite = async (branchId: number) => {
    const isFav = favoriteBranchIds.includes(branchId);
    try {
      if (isFav) {
        await apiClient.delete(`/me/favorite-branches/${branchId}`);
        setFavoriteBranchIds((prev) => prev.filter((id) => id !== branchId));
      } else {
        await apiClient.post('/me/favorite-branches', { branchId });
        setFavoriteBranchIds((prev) => [...prev, branchId]);
      }
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo actualizar favorita.',
        type: 'error',
      });
    }
  };

  const handleSelect = (branch: Branch) => {
    selectBranch(branch);
    router.replace('/(customer)/home');
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        showPopup({
          title: 'Permiso de Cámara Requerido',
          message: 'Para escanear el código QR del local necesitamos acceso a tu cámara. Podés ingresar el código manualmente abajo.',
          type: 'warning',
        });
        return;
      }
    }
    setIsQrModalVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setIsQrModalVisible(false);
    // Extraer slug del QR (puede ser url tipo latesoft://branch/palermo-soho o directamente el slug)
    const cleaned = data.replace('latesoft://branch/', '').trim();
    const success = await selectBranchBySlug(cleaned);
    if (success) {
      showPopup({
        title: '¡Sucursal encontrada!',
        message: 'Se seleccionó la sucursal correspondiente.',
        type: 'success',
        confirmText: 'Aceptar',
        onConfirm: () => router.replace('/(customer)/home'),
      });
    } else {
      showPopup({
        title: 'Código QR no reconocido',
        message: `No encontramos una sucursal activa con el código "${cleaned}".`,
        type: 'error',
      });
    }
  };

  const handleManualSlugSubmit = async () => {
    if (!manualSlug.trim()) return;
    const success = await selectBranchBySlug(manualSlug.trim());
    if (success) {
      setManualSlug('');
      router.replace('/(customer)/home');
    } else {
      showPopup({
        title: 'No encontrada',
        message: 'No existe una sucursal con ese código.',
        type: 'error',
      });
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sucursales LateSoft</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Elegí dónde vas a retirar tu pedido de café
        </Text>
      </View>

      {locationPermissionDenied && (
        <View
          style={[
            styles.permissionNotice,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFF3E0',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FFE0B2',
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={isDark ? '#FBBF24' : '#E65100'} />
          <Text style={[styles.permissionNoticeText, { color: isDark ? '#FDE68A' : '#795548' }]}>
            Ubicación desactivada. Podés buscar en la lista o escanear el QR del local.
          </Text>
        </View>
      )}

      {/* Barra de búsqueda y botón de escanear QR */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar por barrio o dirección..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.qrButton, { backgroundColor: colors.primary }]} onPress={handleOpenScanner}>
          <Ionicons name="qr-code-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Ingreso manual alternativo de código QR / Slug */}
      <View style={styles.manualCodeContainer}>
        <TextInput
          style={[styles.manualInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="¿Tenés el código del local? Ej. palermo-soho"
          placeholderTextColor={colors.placeholder}
          value={manualSlug}
          onChangeText={setManualSlug}
          autoCapitalize="none"
        />
        <Button
          title="Ingresar"
          size="small"
          onPress={handleManualSlugSubmit}
          style={styles.manualBtn}
        />
      </View>

      {/* Listado de sucursales */}
      <FlatList
        data={filteredBranches}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onRefresh={refreshBranches}
        refreshing={false}
        renderItem={({ item }) => {
          const isSelected = selectedBranch?.id === item.id;
          const isFav = favoriteBranchIds.includes(item.id);

          return (
            <Card
              style={
                isSelected
                  ? [
                      styles.selectedCard,
                      {
                        borderColor: colors.primary,
                        backgroundColor: isDark ? 'rgba(212, 163, 115, 0.14)' : '#FAF5F1',
                      },
                    ]
                  : undefined
              }
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
                style={styles.branchCardContent}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.nameContainer}>
                    <Text style={[styles.branchName, { color: colors.text }]}>{item.name}</Text>
                    {item.distanceKm !== undefined && (
                      <View style={[styles.distanceBadge, { backgroundColor: isDark ? 'rgba(212, 163, 115, 0.18)' : '#FAF5F1' }]}>
                        <Ionicons name="navigate-outline" size={12} color={colors.primary} />
                        <Text style={[styles.distanceBadgeText, { color: colors.primary }]}>{formatDistance(item.distanceKm)}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.starBtn}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Ionicons
                      name={isFav ? 'star' : 'star-outline'}
                      size={22}
                      color={isFav ? '#FFA000' : colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.branchAddress, { color: colors.textSecondary }]}>{item.address}</Text>

                <View style={styles.cardFooter}>
                  <View
                    style={[
                      styles.statusTag,
                      item.is_open
                        ? { backgroundColor: isDark ? 'rgba(46, 125, 50, 0.25)' : '#E8F5E9' }
                        : { backgroundColor: isDark ? 'rgba(198, 40, 40, 0.25)' : '#FFEBEE' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: item.is_open ? (isDark ? '#4ADE80' : '#2E7D32') : (isDark ? '#F87171' : '#C62828') },
                      ]}
                    >
                      {item.is_open ? 'Abierto ahora' : 'Cerrado'}
                    </Text>
                  </View>

                  {isSelected && (
                    <View
                      style={[
                        styles.activeTag,
                        {
                          backgroundColor: isDark ? 'rgba(212, 163, 115, 0.22)' : 'rgba(111, 78, 55, 0.1)',
                          borderColor: isDark ? 'rgba(212, 163, 115, 0.45)' : 'rgba(111, 78, 55, 0.25)',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.activeTagText, { color: colors.primary }]}>Sucursal seleccionada</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Card>
          );
        }}
      />

      {/* Modal con Escáner de Cámara para Código QR */}
      <Modal
        visible={isQrModalVisible}
        animationType="slide"
        onRequestClose={() => setIsQrModalVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCameraBtn}
              onPress={() => setIsQrModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.scanTarget}>
              <View style={[styles.targetCorner, styles.tl]} />
              <View style={[styles.targetCorner, styles.tr]} />
              <View style={[styles.targetCorner, styles.bl]} />
              <View style={[styles.targetCorner, styles.br]} />
            </View>

            <Text style={styles.scanInstructions}>
              Apuntá al código QR del mostrador o mesa para seleccionar la sucursal automáticamente
            </Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1810',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7D5A44',
    marginTop: 2,
  },
  permissionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    marginHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 6,
  },
  permissionNoticeText: {
    fontSize: 12,
    color: '#E65100',
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  qrButton: {
    backgroundColor: '#6F4E37',
    borderRadius: 10,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualCodeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#333',
  },
  manualBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  selectedCard: {
    borderWidth: 2,
  },
  branchCardContent: {
    padding: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1810',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F4E37',
  },
  starBtn: {
    padding: 4,
  },
  branchAddress: {
    fontSize: 13,
    color: '#666',
    marginVertical: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusOpen: {
    backgroundColor: '#E8F5E9',
  },
  statusClosed: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextOpen: {
    color: '#2E7D32',
  },
  statusTextClosed: {
    color: '#C62828',
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeCameraBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  scanTarget: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  targetCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFF',
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanInstructions: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 10,
  },
});
