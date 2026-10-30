import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ManagerPinModal } from '../../src/components/ManagerPinModal';
import { apiClient } from '../../src/api/client';
import { formatTimeOnly } from '../../src/utils/format';

interface KdsItem {
  id: number;
  product_name: string;
  quantity: number;
  notes?: string;
}

interface KdsOrder {
  id: number;
  order_number: number;
  business_date: string;
  status: 'PENDING' | 'PREPARING' | 'READY';
  order_type: string;
  notes: string | null;
  customer_name: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  items: KdsItem[];
}

export default function KdsScreen() {
  const router = useRouter();
  // Mantener la pantalla siempre encendida en la estación de barista (solo en dispositivos móviles)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        activateKeepAwakeAsync().catch(() => {});
        return () => {
          deactivateKeepAwake().catch(() => {});
        };
      } catch {
        // Ignorar si no está disponible en la plataforma
      }
    }
  }, []);

  const { user, logout } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const { colors, isDark } = useTheme();
  const branchId = user?.branchId || 1;

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [activeMobileTab, setActiveMobileTab] = useState<'PENDING' | 'PREPARING' | 'READY'>('PENDING');

  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const previousOrderIdsRef = useRef<number[]>([]);

  // Modal para pausar producto rápidamente desde la estación
  const [isPauseModalVisible, setIsPauseModalVisible] = useState(false);
  const [branchProducts, setBranchProducts] = useState<any[]>([]);
  const [pauseReason, setPauseReason] = useState('Sin stock / falta de insumos');
  const [orderToOverride, setOrderToOverride] = useState<{ id: number; orderNumber: number } | null>(null);

  const fetchKdsOrders = useCallback(async () => {
    try {
      const res = await apiClient.post('/orders/kds');
      const incoming: KdsOrder[] = res.data.data;

      // Detección de pedidos nuevos para emitir alerta háptica
      const currentIds = incoming.map((o) => o.id);
      const prevIds = previousOrderIdsRef.current;

      const hasNewOrders = currentIds.some((id) => !prevIds.includes(id));
      if (hasNewOrders && prevIds.length > 0 && Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics no soportado en esta plataforma
        }
      }

      previousOrderIdsRef.current = currentIds;
      setOrders(incoming);
    } catch (err) {
      console.error('[KDS] Error al consultar comandas:', err);
    }
  }, []);

  const fetchBranchMenu = useCallback(async () => {
    try {
      const res = await apiClient.post(`/branches/${branchId}/menu`);
      const list: any[] = [];
      res.data.menu.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          list.push(item);
        });
      });
      setBranchProducts(list);
    } catch (err) {
      console.error('[KDS] Error al cargar productos para pausa:', err);
    }
  }, [branchId]);

  useEffect(() => {
    fetchKdsOrders();
    fetchBranchMenu();

    const interval = setInterval(() => {
      fetchKdsOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchKdsOrders, fetchBranchMenu]);

  // Transición de comanda (POST obligatorio)
  const advanceOrderStatus = async (orderId: number, nextStatus: 'PREPARING' | 'READY' | 'DELIVERED') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.post(`/orders/${orderId}/status`, { status: nextStatus });
      fetchKdsOrders();
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo cambiar el estado de la comanda',
        type: 'error',
      });
    }
  };

  // Popup de confirmación previo a cualquier transición de estado
  const promptAdvanceOrderStatus = (
    order: KdsOrder,
    nextStatus: 'PREPARING' | 'READY' | 'DELIVERED',
    nextLabel: string
  ) => {
    let title = 'Actualizar comanda';
    let message = `¿Confirmás pasar la Comanda #${order.order_number} al siguiente estado?`;
    let confirmText = nextLabel;

    if (nextStatus === 'PREPARING') {
      title = 'Iniciar Preparación';
      message = `¿Comenzar la preparación de la Comanda #${order.order_number} (${order.customer_name || 'Mostrador'})?`;
      confirmText = 'Comenzar a preparar';
    } else if (nextStatus === 'READY') {
      title = 'Comanda Lista';
      message = `¿Confirmás que la Comanda #${order.order_number} está lista para que el cliente la retire?`;
      confirmText = 'Marcar como listo';
    } else if (nextStatus === 'DELIVERED') {
      title = 'Entregar al Cliente';
      message = `¿Confirmás la entrega de la Comanda #${order.order_number} al cliente? Se completará y saldrá de la pantalla.`;
      confirmText = 'Entregar al cliente';
    }

    showConfirm({
      title,
      message,
      confirmText,
      cancelText: 'Cancelar',
      onConfirm: () => advanceOrderStatus(order.id, nextStatus),
    });
  };

  // Popup de confirmación previo a solicitar anulación
  const promptCancelOrder = (order: KdsOrder) => {
    showConfirm({
      title: 'Anular Comanda',
      message: `¿Deseás iniciar la anulación de la Comanda #${order.order_number}? Esta acción requerirá el PIN de autorización del encargado.`,
      confirmText: 'Continuar',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: () => setOrderToOverride({ id: order.id, orderNumber: order.order_number }),
    });
  };

  // Pausar o reanudar producto con confirmación previa
  const promptToggleProduct = (product: any) => {
    // Cerrar temporalmente el modal de lista para que la confirmación se muestre al frente sin solapamientos
    setIsPauseModalVisible(false);

    const nextAvailability = !product.is_available;
    const title = nextAvailability ? 'Reactivar Producto' : 'Pausar Producto';
    const message = nextAvailability
      ? `¿Confirmás reactivar "${product.name}" para que vuelva a estar disponible en venta?`
      : `¿Confirmás pausar temporalmente "${product.name}" por: "${pauseReason}"?`;

    showConfirm({
      title,
      message,
      confirmText: nextAvailability ? 'Reactivar' : 'Pausar',
      cancelText: 'Cancelar',
      isDestructive: !nextAvailability,
      onConfirm: () => handleToggleProduct(product),
      onCancel: () => {
        // Si el usuario cancela la confirmación, reabrir la lista de productos
        setIsPauseModalVisible(true);
      },
    });
  };

  const handleToggleProduct = async (product: any) => {
    const nextAvailability = !product.is_available;
    try {
      await apiClient.post(`/branches/${branchId}/menu/${product.product_id}/availability`, {
        isAvailable: nextAvailability,
        pausedReason: nextAvailability ? null : pauseReason,
      });

      await fetchBranchMenu();

      showPopup({
        title: nextAvailability ? 'Producto Reanudado' : 'Producto Pausado',
        message: `"${product.name}" ${nextAvailability ? 'ahora está disponible' : 'se marcó como pausado'}.`,
        type: nextAvailability ? 'success' : 'warning',
        onConfirm: () => {
          // Reabrir la lista actualizada para que el barista vea el cambio
          setIsPauseModalVisible(true);
        },
      });
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo actualizar el producto',
        type: 'error',
        onConfirm: () => {
          setIsPauseModalVisible(true);
        },
      });
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const renderOrderCard = (order: KdsOrder, nextStatus: 'PREPARING' | 'READY' | 'DELIVERED', nextLabel: string) => {
    const advanceBtnTextColor = isDark ? '#111827' : '#FFFFFF';

    return (
      <Card
        key={order.id}
        style={[
          styles.kdsCard,
          {
            backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        {/* Cabecera de comanda con distribución equilibrada sin solapamientos */}
        <View style={[styles.kdsCardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.headerInfoCol}>
            <Text style={[styles.kdsOrderNumber, { color: colors.text }]} numberOfLines={1}>
              Comanda #{order.order_number}
            </Text>
            <View style={styles.customerRow}>
              <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.kdsCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
                {order.customer_name || 'Mostrador'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.timeBadge,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' },
            ]}
          >
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.kdsTime, { color: colors.textSecondary }]}>
              {formatTimeOnly(order.created_at)}
            </Text>
          </View>
        </View>

        {/* Notas del pedido */}
        {order.notes && (
          <View
            style={[
              styles.kdsOrderNotes,
              {
                backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
              },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={isDark ? '#FBBF24' : '#B45309'}
            />
            <Text
              style={[
                styles.kdsOrderNotesText,
                { color: isDark ? '#FBBF24' : '#92400E' },
              ]}
            >
              {order.notes}
            </Text>
          </View>
        )}

        {/* Listado de ítems */}
        <View style={styles.kdsItemsList}>
          {order.items.map((line, idx) => (
            <View key={idx} style={styles.kdsItemRow}>
              <Text style={[styles.kdsItemName, { color: colors.text }]}>
                <Text style={[styles.kdsItemQty, { color: colors.primary }]}>
                  {line.quantity}x{' '}
                </Text>
                {line.product_name}
              </Text>
              {line.notes && (
                <Text style={[styles.kdsItemDetail, { color: colors.textSecondary }]}>
                  • {line.notes}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Botones de acción inferior */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={[styles.advanceBtn, { backgroundColor: colors.primary }]}
            onPress={() => promptAdvanceOrderStatus(order, nextStatus, nextLabel)}
            activeOpacity={0.8}
          >
            <Text style={[styles.advanceBtnText, { color: advanceBtnTextColor }]}>
              {nextLabel}
            </Text>
            <Ionicons name="arrow-forward-circle" size={18} color={advanceBtnTextColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelKdsBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
              },
            ]}
            onPress={() => promptCancelOrder(order)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Confirmás salir de la cuenta de Barista?',
      confirmText: 'Salir',
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
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header del KDS */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.topBarLeft}>
          <Ionicons name="flame" size={22} color={colors.primary} />
          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
                KDS Cocina
              </Text>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>EN VIVO</Text>
              </View>
            </View>
            <Text style={[styles.topBarSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Sucursal #{branchId}
            </Text>
          </View>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={[
              styles.quickPauseBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
              },
            ]}
            onPress={() => setIsPauseModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Pausar producto"
          >
            <Ionicons name="pause-circle-outline" size={17} color="#EF4444" />
            <Text style={[styles.quickPauseBtnText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
              {width < 500 ? 'Pausar' : 'Pausar Producto'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kdsLogoutBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector de pestañas para móvil */}
      {isMobile ? (
        <>
          <View style={[styles.mobileTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.mobileTab,
                { backgroundColor: activeMobileTab === 'PENDING' ? '#D97706' : colors.surfaceSecondary },
              ]}
              onPress={() => setActiveMobileTab('PENDING')}
            >
              <Text
                style={[
                  styles.mobileTabText,
                  { color: activeMobileTab === 'PENDING' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Pendientes ({pendingOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mobileTab,
                { backgroundColor: activeMobileTab === 'PREPARING' ? '#2563EB' : colors.surfaceSecondary },
              ]}
              onPress={() => setActiveMobileTab('PREPARING')}
            >
              <Text
                style={[
                  styles.mobileTabText,
                  { color: activeMobileTab === 'PREPARING' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                En Curso ({preparingOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mobileTab,
                { backgroundColor: activeMobileTab === 'READY' ? '#16A34A' : colors.surfaceSecondary },
              ]}
              onPress={() => setActiveMobileTab('READY')}
            >
              <Text
                style={[
                  styles.mobileTabText,
                  { color: activeMobileTab === 'READY' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Listos ({readyOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.mobileColumnContainer} contentContainerStyle={styles.mobileColumnContent}>
            {activeMobileTab === 'PENDING' && (
              pendingOrders.length > 0 ? (
                pendingOrders.map((o) => renderOrderCard(o, 'PREPARING', 'Comenzar a preparar'))
              ) : (
                <EmptyState
                  icon="time-outline"
                  title="Sin pedidos pendientes"
                  description="No hay pedidos esperando en la cola."
                />
              )
            )}
            {activeMobileTab === 'PREPARING' && (
              preparingOrders.length > 0 ? (
                preparingOrders.map((o) => renderOrderCard(o, 'READY', 'Marcar como Listo'))
              ) : (
                <EmptyState
                  icon="flame-outline"
                  title="Sin pedidos en preparación"
                  description="Comenzá a elaborar un pedido pendiente."
                />
              )
            )}
            {activeMobileTab === 'READY' && (
              readyOrders.length > 0 ? (
                readyOrders.map((o) => renderOrderCard(o, 'DELIVERED', 'Entregar al cliente'))
              ) : (
                <EmptyState
                  icon="checkmark-circle-outline"
                  title="Sin pedidos listos"
                  description="Los pedidos finalizados listos para retirar aparecerán acá."
                />
              )
            )}
          </ScrollView>
        </>
      ) : (
        /* 3 Columnas Horizontales de la Comandera para Pantallas Grandes / Tablets */
        <View style={styles.columnsContainer}>
          {/* Columna 1: PENDIENTES */}
          <View
            style={[
              styles.column,
              {
                backgroundColor: isDark ? colors.surface : '#F1F5F9',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.columnHeader, styles.headerPending]}>
              <Text style={styles.columnTitle} numberOfLines={1}>PENDIENTES ({pendingOrders.length})</Text>
            </View>
            <ScrollView contentContainerStyle={styles.columnScroll}>
              {pendingOrders.map((o) => renderOrderCard(o, 'PREPARING', 'Comenzar a preparar'))}
            </ScrollView>
          </View>

          {/* Columna 2: EN PREPARACIÓN */}
          <View
            style={[
              styles.column,
              {
                backgroundColor: isDark ? colors.surface : '#F1F5F9',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.columnHeader, styles.headerPreparing]}>
              <Text style={styles.columnTitle} numberOfLines={1}>EN PREPARACIÓN ({preparingOrders.length})</Text>
            </View>
            <ScrollView contentContainerStyle={styles.columnScroll}>
              {preparingOrders.map((o) => renderOrderCard(o, 'READY', 'Marcar como Listo'))}
            </ScrollView>
          </View>

          {/* Columna 3: LISTOS PARA RETIRAR */}
          <View
            style={[
              styles.column,
              {
                backgroundColor: isDark ? colors.surface : '#F1F5F9',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.columnHeader, styles.headerReady]}>
              <Text style={styles.columnTitle} numberOfLines={1}>LISTOS ({readyOrders.length})</Text>
            </View>
            <ScrollView contentContainerStyle={styles.columnScroll}>
              {readyOrders.map((o) => renderOrderCard(o, 'DELIVERED', 'Entregar al cliente'))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Modal para pausar producto rápidamente */}
      <Modal
        visible={isPauseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPauseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Disponibilidad de Productos en Barra
              </Text>
              <TouchableOpacity onPress={() => setIsPauseModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Pausá temporalmente cualquier producto que se quede sin insumos.
            </Text>

            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Motivo de pausa (ej. sin leche vegetal)"
              placeholderTextColor={colors.placeholder}
              value={pauseReason}
              onChangeText={setPauseReason}
            />

            <ScrollView style={{ maxHeight: 300 }}>
              {branchProducts.map((p) => (
                <View
                  key={p.branch_product_id}
                  style={[styles.productRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.productRowName, { color: colors.text }]}>{p.name}</Text>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      p.is_available ? styles.btnPause : styles.btnResume,
                    ]}
                    onPress={() => promptToggleProduct(p)}
                  >
                    <Text style={styles.toggleBtnText}>
                      {p.is_available ? 'Pausar' : 'Reactivar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ManagerPinModal
        visible={!!orderToOverride}
        orderId={orderToOverride?.id || null}
        orderNumber={orderToOverride?.orderNumber}
        onClose={() => setOrderToOverride(null)}
        onSuccess={() => {
          setOrderToOverride(null);
          fetchKdsOrders();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 58,
  },
  topBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
    minWidth: 0,
  },
  titleColumn: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  topBarSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#22C55E',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  quickPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  quickPauseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kdsLogoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  mobileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    minHeight: 40,
  },
  mobileTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mobileColumnContainer: {
    flex: 1,
  },
  mobileColumnContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 40,
  },
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  column: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  columnHeader: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  headerPending: {
    backgroundColor: '#D97706', // Ámbar cálido
  },
  headerPreparing: {
    backgroundColor: '#2563EB', // Azul preparación
  },
  headerReady: {
    backgroundColor: '#16A34A', // Verde listo
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  columnScroll: {
    padding: 10,
    gap: 10,
  },
  kdsCard: {
    borderRadius: 10,
    padding: 12,
  },
  kdsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    paddingBottom: 8,
    gap: 8,
  },
  headerInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  kdsOrderNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  kdsCustomer: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  kdsTime: {
    fontSize: 11,
    fontWeight: '700',
  },
  kdsOrderNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  kdsOrderNotesText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  kdsItemsList: {
    marginVertical: 8,
    gap: 6,
  },
  kdsItemRow: {
    marginBottom: 2,
  },
  kdsItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  kdsItemQty: {
    fontWeight: '800',
  },
  kdsItemDetail: {
    fontSize: 12,
    fontStyle: 'italic',
    marginLeft: 6,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  advanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    gap: 6,
  },
  advanceBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  cancelKdsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginVertical: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  productRowName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  btnPause: {
    backgroundColor: '#DC2626',
  },
  btnResume: {
    backgroundColor: '#16A34A',
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
