import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { ManagerPinModal } from '../../src/components/ManagerPinModal';
import { apiClient } from '../../src/api/client';
import { formatPrice, formatDateTime } from '../../src/utils/format';
import { sanitizeDecimal } from '../../src/utils/validation';

interface PosProduct {
  branch_product_id: number;
  product_id: number;
  name: string;
  price: number;
  is_available: boolean;
  category_name?: string;
}

interface TicketItem {
  branchProductId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface PendingAppOrder {
  id: number;
  order_number: number;
  customer_name: string;
  total_amount: number;
  created_at: string;
  order_type: string;
  items: Array<{ product_name: string; quantity: number }>;
}

interface PendingTransferOrder {
  id: number;
  order_number: number;
  customer_name: string;
  customer_email?: string;
  total_amount: number;
  created_at: string;
  transfer_reference: string;
  transfer_receipt_url: string;
  items: Array<{ product_name: string; quantity: number }>;
}

export default function PosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompactTabs = width < 600;
  const isStackedPos = width < 680;

  const { user, logout } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const { colors, isDark } = useTheme();
  const branchId = user?.branchId || 1;

  const [activeTab, setActiveTab] = useState<'POS' | 'PENDING_APP' | 'TRANSFERS'>('POS');
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [orderType, setOrderType] = useState<'COUNTER' | 'DINE_IN' | 'TAKE_AWAY'>('COUNTER');

  // Modal de cobro de comanda mostrador
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'QR' | 'TRANSFER'>('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Pedidos por cobrar en efectivo desde la app
  const [pendingAppOrders, setPendingAppOrders] = useState<PendingAppOrder[]>([]);
  const [selectedAppOrder, setSelectedAppOrder] = useState<PendingAppOrder | null>(null);
  const [orderToOverride, setOrderToOverride] = useState<{ id: number; orderNumber: number } | null>(null);

  // Verificación de pagos con transferencia Mercado Pago
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransferOrder[]>([]);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [orderToReject, setOrderToReject] = useState<PendingTransferOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('El monto de la transferencia no coincide');
  const [isVerifyingTransfer, setIsVerifyingTransfer] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await apiClient.post(`/branches/${branchId}/menu`);
      const allItems: PosProduct[] = [];
      res.data.menu.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          allItems.push({
            ...item,
            category_name: cat.name,
          });
        });
      });
      setProducts(allItems);
    } catch (err) {
      console.error('[POS] Error cargando productos:', err);
    }
  }, [branchId]);

  const fetchPendingAppOrders = useCallback(async () => {
    try {
      const res = await apiClient.post('/orders', { branchId, status: 'PENDING', limit: 50, isList: true });
      const unpaid = res.data.data.filter((o: any) => o.payment_status === 'UNPAID');
      setPendingAppOrders(unpaid);
    } catch (err) {
      console.error('[POS] Error cargando pedidos por cobrar:', err);
    }
  }, [branchId]);

  const fetchPendingTransfers = useCallback(async () => {
    try {
      const res = await apiClient.post('/orders/pending-transfers', { branchId });
      setPendingTransfers(res.data.data || []);
    } catch (err) {
      console.error('[POS] Error cargando transferencias:', err);
    }
  }, [branchId]);

  const fetchCurrentShift = useCallback(async () => {
    try {
      const res = await apiClient.post('/shifts/current', { branchId });
      setHasOpenShift(Boolean(res.data?.data?.hasOpenShift));
    } catch (err) {
      console.error('[POS] Error verificando estado de caja:', err);
    }
  }, [branchId]);

  useEffect(() => {
    fetchMenu();
    fetchCurrentShift();
    fetchPendingAppOrders();
    fetchPendingTransfers();

    const interval = setInterval(() => {
      fetchCurrentShift();
      fetchPendingAppOrders();
      fetchPendingTransfers();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMenu, fetchCurrentShift, fetchPendingAppOrders, fetchPendingTransfers]);

  useFocusEffect(
    useCallback(() => {
      fetchCurrentShift();
      fetchPendingAppOrders();
      fetchPendingTransfers();
    }, [fetchCurrentShift, fetchPendingAppOrders, fetchPendingTransfers])
  );

  const requireOpenShift = (actionLabel: string): boolean => {
    if (hasOpenShift === true) return true;
    showConfirm({
      title: 'Caja cerrada',
      message: `No hay un turno de caja activo en esta sucursal. Abrí la caja antes de ${actionLabel}.`,
      confirmText: 'Ir a Abrir Caja',
      cancelText: 'Cerrar',
      onConfirm: () => router.push('/(staff)/shift' as any),
    });
    return false;
  };

  const addToTicket = (product: PosProduct) => {
    if (!product.is_available) {
      showPopup({
        title: 'Producto Pausado',
        message: 'Este producto está pausado por falta de insumos.',
        type: 'warning',
      });
      return;
    }

    setTicketItems((prev) => {
      const idx = prev.findIndex((i) => i.branchProductId === product.branch_product_id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          branchProductId: product.branch_product_id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateTicketQty = (branchProductId: number, delta: number) => {
    setTicketItems((prev) => {
      return prev
        .map((i) => {
          if (i.branchProductId === branchProductId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as TicketItem[];
    });
  };

  const ticketTotal = ticketItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Cobro de pedido creado en POS
  const handleConfirmPosPayment = async () => {
    if (!requireOpenShift('registrar ventas')) return;
    if (paymentMethod === 'CASH') {
      const tenderedNum = parseFloat(cashTendered.replace(',', '.'));
      if (!cashTendered.trim() || isNaN(tenderedNum) || tenderedNum < ticketTotal) {
        showPopup({
          title: 'Monto insuficiente',
          message: 'El efectivo entregado debe ser un número válido igual o mayor al total a pagar.',
          type: 'warning',
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      const payload = {
        branchId,
        orderType,
        paymentMethod,
        items: ticketItems.map((i) => ({
          branchProductId: i.branchProductId,
          quantity: i.quantity,
          notes: i.notes,
        })),
      };

      const res = await apiClient.post('/orders', payload);
      const order = res.data.order;

      const vuelto = paymentMethod === 'CASH'
        ? parseFloat(cashTendered.replace(',', '.')) - ticketTotal
        : 0;

      showPopup({
        title: '¡Venta Cobrada con Éxito!',
        message: `Pedido #${order.order_number}\nTotal: ${formatPrice(ticketTotal)}\nMedio: ${paymentMethod}${
          paymentMethod === 'CASH' ? `\nVuelto: ${formatPrice(vuelto)}` : ''
        }`,
        type: 'success',
      });

      setTicketItems([]);
      setCashTendered('');
      setIsPayModalVisible(false);
    } catch (err: any) {
      showPopup({
        title: 'Error al registrar venta',
        message: err.message || 'Error del servidor',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cobro de pedido hecho desde la app (UNPAID -> PAID)
  const handlePayAppOrder = async () => {
    if (!selectedAppOrder) return;
    if (!requireOpenShift('cobrar pedidos de la app')) return;
    if (paymentMethod === 'CASH') {
      const tenderedNum = parseFloat(cashTendered.replace(',', '.'));
      if (!cashTendered.trim() || isNaN(tenderedNum) || tenderedNum < selectedAppOrder.total_amount) {
        showPopup({
          title: 'Monto insuficiente',
          message: 'El efectivo entregado debe ser igual o mayor al total del pedido.',
          type: 'warning',
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      await apiClient.post(`/orders/${selectedAppOrder.id}/pay`, {
        paymentMethod,
      });

      showPopup({
        title: '¡Pedido Cobrado!',
        message: `El pedido #${selectedAppOrder.order_number} de ${selectedAppOrder.customer_name || 'Cliente'} ahora está habilitado en el KDS para preparación.`,
        type: 'success',
      });

      setSelectedAppOrder(null);
      fetchPendingAppOrders();
    } catch (err: any) {
      showPopup({
        title: 'Error al cobrar',
        message: err.message || 'Error en la transacción',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentPayTotal = selectedAppOrder ? selectedAppOrder.total_amount : ticketTotal;
  const cashNum = parseFloat(cashTendered.replace(',', '.')) || 0;

  const handleApproveTransfer = (order: PendingTransferOrder) => {
    if (!requireOpenShift('aprobar pagos por transferencia')) return;
    showConfirm({
      title: 'Aprobar Pago Mercado Pago',
      message: `¿Confirmás la acreditación de ${formatPrice(order.total_amount)} con N° de Operación ${order.transfer_reference} para la Comanda #${order.order_number}? El pedido se enviará de inmediato al KDS de la cocina.`,
      confirmText: 'Aprobar y Enviar a Cocina',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await apiClient.post(`/orders/${order.id}/verify-transfer`, { approved: true });
          showPopup({
            title: 'Pago Aprobado',
            message: `Comanda #${order.order_number} confirmada como PAGADA y enviada al KDS.`,
            type: 'success',
          });
          fetchPendingTransfers();
        } catch (err: any) {
          showPopup({
            title: 'Error al verificar',
            message: err.message || 'No se pudo aprobar la transferencia.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleConfirmRejectTransfer = async () => {
    if (!orderToReject) return;
    if (!requireOpenShift('rechazar comprobantes de transferencia')) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      showPopup({
        title: 'Motivo requerido',
        message: 'Por favor seleccioná o escribí un motivo de rechazo claro (mínimo 5 caracteres).',
        type: 'warning',
      });
      return;
    }

    setIsVerifyingTransfer(true);
    try {
      await apiClient.post(`/orders/${orderToReject.id}/verify-transfer`, {
        approved: false,
        rejectionReason: rejectionReason.trim(),
      });
      showPopup({
        title: 'Comprobante rechazado',
        message: `El comprobante de la Comanda #${orderToReject.order_number} fue marcado como no acreditado. El cliente fue notificado para reenviarlo.`,
        type: 'info',
      });
      setOrderToReject(null);
      fetchPendingTransfers();
    } catch (err: any) {
      showPopup({
        title: 'Error al rechazar',
        message: err.message || 'No se pudo procesar el rechazo.',
        type: 'error',
      });
    } finally {
      setIsVerifyingTransfer(false);
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Confirmás salir de la cuenta de Cajero?',
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
    <Screen maxWidth={1120} style={styles.screen}>
      {/* Cabecera superior separada para que los botones de acción nunca compriman las pestañas */}
      <View style={[styles.topHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.topHeaderInfo}>
          <Text style={[styles.topHeaderTitle, { color: colors.text }]} numberOfLines={1}>
            Caja y Cobros
          </Text>
          <Text style={[styles.topHeaderSub, { color: colors.textSecondary }]} numberOfLines={1}>
            Sucursal #{branchId} • {user?.fullName || 'Cajero'}
          </Text>
        </View>

        <View style={styles.topHeaderActions}>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              { backgroundColor: isDark ? '#3D2A14' : '#FEF3C7', borderColor: isDark ? '#78350F' : '#FDE68A' },
            ]}
            onPress={() => router.push('/(staff)/shift' as any)}
            accessibilityLabel="Ir a Turno y Caja"
          >
            <Ionicons name="wallet-outline" size={17} color={isDark ? '#FBBF24' : '#92400E'} />
            {!isCompactTabs && (
              <Text style={[styles.headerActionText, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                Turno / Caja
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              {
                backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
                borderColor: isDark ? 'rgba(220,38,38,0.35)' : '#FECACA',
              },
            ]}
            onPress={handleLogout}
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={17} color="#DC2626" />
            {!isCompactTabs && (
              <Text style={[styles.headerActionText, { color: '#DC2626' }]}>Salir</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {hasOpenShift === false && (
        <View
          style={[
            styles.shiftWarningBanner,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
              borderBottomColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
            },
          ]}
        >
          <View style={styles.shiftWarningLeft}>
            <Ionicons name="lock-closed" size={18} color={isDark ? '#FBBF24' : '#B45309'} />
            <Text style={[styles.shiftWarningText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
              Caja cerrada: abrí un turno para cobrar o aprobar pedidos.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.shiftWarningBtn, { backgroundColor: isDark ? '#D97706' : '#B45309' }]}
            onPress={() => router.push('/(staff)/shift' as any)}
          >
            <Text style={styles.shiftWarningBtnText}>Abrir Caja</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selector de 3 pestañas limpio, adaptativo y sin solapamientos de texto */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            isCompactTabs && styles.tabBtnCompact,
            activeTab === 'POS' && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('POS')}
          activeOpacity={0.75}
        >
          <View style={styles.tabIconWrap}>
            <Ionicons
              name="calculator"
              size={18}
              color={activeTab === 'POS' ? colors.primary : colors.textSecondary}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.tabBtnText,
              isCompactTabs && styles.tabBtnTextCompact,
              { color: activeTab === 'POS' ? colors.primary : colors.textSecondary },
              activeTab === 'POS' && styles.tabBtnTextActive,
            ]}
          >
            {isCompactTabs ? 'Mostrador POS' : 'Mostrador (POS)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            isCompactTabs && styles.tabBtnCompact,
            activeTab === 'PENDING_APP' && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('PENDING_APP')}
          activeOpacity={0.75}
        >
          <View style={styles.tabIconWrap}>
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={activeTab === 'PENDING_APP' ? colors.primary : colors.textSecondary}
            />
            {isCompactTabs && (
              <View
                style={[
                  styles.tabCountPill,
                  {
                    backgroundColor:
                      pendingAppOrders.length > 0
                        ? colors.primary
                        : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    { color: pendingAppOrders.length > 0 ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {pendingAppOrders.length}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.tabBtnText,
              isCompactTabs && styles.tabBtnTextCompact,
              { color: activeTab === 'PENDING_APP' ? colors.primary : colors.textSecondary },
              activeTab === 'PENDING_APP' && styles.tabBtnTextActive,
            ]}
          >
            {isCompactTabs ? 'Cobros App' : 'Por cobrar en App'}
          </Text>
          {!isCompactTabs && (
            <View
              style={[
                styles.tabCountPill,
                {
                  backgroundColor:
                    pendingAppOrders.length > 0 ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabCountText,
                  { color: pendingAppOrders.length > 0 ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {pendingAppOrders.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            isCompactTabs && styles.tabBtnCompact,
            activeTab === 'TRANSFERS' && [styles.tabBtnActive, { borderBottomColor: '#009EE3' }],
          ]}
          onPress={() => setActiveTab('TRANSFERS')}
          activeOpacity={0.75}
        >
          <View style={styles.tabIconWrap}>
            <Ionicons
              name="qr-code-outline"
              size={18}
              color={activeTab === 'TRANSFERS' ? '#009EE3' : colors.textSecondary}
            />
            {isCompactTabs && (
              <View
                style={[
                  styles.tabCountPill,
                  {
                    backgroundColor:
                      pendingTransfers.length > 0 ? '#009EE3' : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    { color: pendingTransfers.length > 0 ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {pendingTransfers.length}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.tabBtnText,
              isCompactTabs && styles.tabBtnTextCompact,
              { color: activeTab === 'TRANSFERS' ? '#009EE3' : colors.textSecondary },
              activeTab === 'TRANSFERS' && styles.tabBtnTextActive,
            ]}
          >
            Transferencias
          </Text>
          {!isCompactTabs && (
            <View
              style={[
                styles.tabCountPill,
                {
                  backgroundColor:
                    pendingTransfers.length > 0 ? '#009EE3' : colors.surfaceSecondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabCountText,
                  { color: pendingTransfers.length > 0 ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {pendingTransfers.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'POS' ? (
        <View style={[styles.posLayout, isStackedPos && styles.posLayoutStacked]}>
          {/* Catálogo de productos */}
          <View
            style={[
              styles.catalogCol,
              { borderRightColor: colors.border, borderBottomColor: colors.border },
              isStackedPos && styles.catalogColStacked,
            ]}
          >
            <View style={[styles.searchRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar producto..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => String(item.branch_product_id)}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.productGridItem,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    !item.is_available && styles.productGridPaused,
                  ]}
                  onPress={() => addToTicket(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.productGridName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.productGridPrice, { color: colors.primary }]}>{formatPrice(item.price)}</Text>
                  {!item.is_available && (
                    <Text style={styles.pausedLabel}>PAUSADO</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Comanda activa de mostrador */}
          <View
            style={[
              styles.ticketCol,
              { backgroundColor: colors.surface },
              isStackedPos && styles.ticketColStacked,
            ]}
          >
            <Text style={[styles.ticketTitle, { color: colors.text, borderBottomColor: colors.border }]}>
              Comanda Actual {ticketItems.length > 0 ? `(${ticketItems.reduce((acc, i) => acc + i.quantity, 0)} ítems)` : ''}
            </Text>

            <FlatList
              data={ticketItems}
              keyExtractor={(item) => String(item.branchProductId)}
              style={styles.ticketList}
              ListEmptyComponent={
                <Text style={[styles.emptyTicketText, { color: colors.textMuted }]}>Seleccioná productos de la lista</Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.ticketRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.ticketRowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.ticketRowPrice, { color: colors.primary }]}>{formatPrice(item.price * item.quantity)}</Text>
                  </View>
                  <View style={styles.ticketRowQty}>
                    <TouchableOpacity
                      onPress={() => updateTicketQty(item.branchProductId, -1)}
                      style={[styles.ticketQtyBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Ionicons name="remove" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.ticketQtyNum, { color: colors.text }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateTicketQty(item.branchProductId, 1)}
                      style={[styles.ticketQtyBtn, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Ionicons name="add" size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />

            <View style={[styles.ticketFooter, { borderTopColor: colors.border }]}>
              <View style={styles.ticketTotalRow}>
                <Text style={[styles.ticketTotalLabel, { color: colors.text }]}>Total a cobrar:</Text>
                <Text style={[styles.ticketTotalAmount, { color: colors.primary }]}>{formatPrice(ticketTotal)}</Text>
              </View>

              <Button
                title={`Cobrar • ${formatPrice(ticketTotal)}`}
                disabled={ticketItems.length === 0}
                onPress={() => {
                  if (!requireOpenShift('cobrar pedidos en mostrador')) return;
                  setIsPayModalVisible(true);
                }}
              />
            </View>
          </View>
        </View>
      ) : activeTab === 'PENDING_APP' ? (
        /* Pestaña: Pedidos de App Por Cobrar */
        <FlatList
          data={pendingAppOrders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No hay pedidos pendientes de cobro"
              description="Cuando un cliente ordene desde la app para pagar en caja, aparecerá acá."
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.appOrderCard}>
              <View style={[styles.appOrderHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.appOrderNumber, { color: colors.primary }]}>Pedido #{item.order_number}</Text>
                  <Text style={[styles.appOrderCustomer, { color: colors.textSecondary }]}>Cliente: {item.customer_name || 'Anónimo'}</Text>
                </View>
                <Text style={[styles.appOrderTotal, { color: colors.text }]}>{formatPrice(item.total_amount)}</Text>
              </View>

              <View style={styles.appOrderItems}>
                {item.items.map((line, idx) => (
                  <Text key={idx} style={[styles.appOrderItemText, { color: colors.textSecondary }]}>
                    • {line.quantity}x {line.product_name}
                  </Text>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button
                  title="Cobrar en caja"
                  size="small"
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (!requireOpenShift('cobrar pedidos de la app')) return;
                    setSelectedAppOrder(item);
                    setPaymentMethod('CASH');
                    setCashTendered(String(item.total_amount));
                  }}
                />
                <Button
                  title="Anular (PIN)"
                  variant="outline"
                  size="small"
                  style={{ borderColor: '#EF4444' }}
                  textStyle={{ color: '#EF4444' }}
                  onPress={() => {
                    setOrderToOverride({ id: item.id, orderNumber: item.order_number });
                  }}
                />
              </View>
            </Card>
          )}
        />
      ) : (
        /* VISTA: TRANSFERENCIAS MP PENDIENTES DE VERIFICACIÓN */
        <FlatList
          data={pendingTransfers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No hay transferencias pendientes"
              description="Cuando un cliente ordene desde la app con transferencia Mercado Pago y adjunte el comprobante, aparecerá acá para su verificación."
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.transferCard}>
              <View style={[styles.transferCardHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[styles.appOrderNumber, { color: colors.primary }]}>Comanda #{item.order_number}</Text>
                    <View style={styles.mpBadge}>
                      <Text style={styles.mpBadgeText}>MERCADO PAGO</Text>
                    </View>
                  </View>
                  <Text style={[styles.appOrderCustomer, { color: colors.textSecondary }]}>
                    Cliente: {item.customer_name || 'Cliente App'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.appOrderTotal, { color: colors.text }]}>{formatPrice(item.total_amount)}</Text>
                  <Text style={[styles.orderTimeText, { color: colors.textSecondary }]}>
                    {formatDateTime(item.created_at)}
                  </Text>
                </View>
              </View>

              {/* Información de la transferencia */}
              <View style={[styles.transferInfoBox, { backgroundColor: isDark ? 'rgba(0,158,227,0.1)' : '#F0F9FF', borderColor: colors.border }]}>
                <View style={styles.transferInfoRow}>
                  <Text style={[styles.transferInfoLabel, { color: colors.textSecondary }]}>N° de Operación MP:</Text>
                  <Text style={[styles.transferInfoValue, { color: colors.text }]} selectable>
                    {item.transfer_reference}
                  </Text>
                </View>

                {item.transfer_receipt_url && (
                  <TouchableOpacity
                    style={styles.receiptPreviewRow}
                    onPress={() => setPreviewReceiptUrl(item.transfer_receipt_url)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.transfer_receipt_url }} style={styles.receiptThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.viewReceiptLink, { color: '#009EE3' }]}>
                        Ver comprobante completo (Tocar para ampliar)
                      </Text>
                      <Text style={[styles.receiptHint, { color: colors.textSecondary }]}>
                        Comprobante adjuntado por el cliente
                      </Text>
                    </View>
                    <Ionicons name="expand-outline" size={18} color="#009EE3" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Ítems de la orden */}
              <View style={styles.appOrderItems}>
                {item.items.map((line, idx) => (
                  <Text key={idx} style={[styles.appOrderItemText, { color: colors.textSecondary }]}>
                    • {line.quantity}x {line.product_name}
                  </Text>
                ))}
              </View>

              {/* Botones de acción del cajero */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                <Button
                  title="Aprobar Pago"
                  size="small"
                  style={{ flex: 1, minWidth: 150, backgroundColor: '#16A34A' }}
                  icon={<Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
                  onPress={() => handleApproveTransfer(item)}
                />
                <Button
                  title="Rechazar"
                  variant="outline"
                  size="small"
                  style={{ borderColor: '#EF4444' }}
                  textStyle={{ color: '#EF4444' }}
                  icon={<Ionicons name="close-circle-outline" size={16} color="#EF4444" />}
                  onPress={() => {
                    if (!requireOpenShift('rechazar comprobantes de transferencia')) return;
                    setOrderToReject(item);
                    setRejectionReason('El monto de la transferencia no coincide');
                  }}
                />
              </View>
            </Card>
          )}
        />
      )}

      {/* Modal de cobro (POS o Pedido App) */}
      <Modal
        visible={isPayModalVisible || !!selectedAppOrder}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsPayModalVisible(false);
          setSelectedAppOrder(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Cobro {selectedAppOrder ? `Pedido #${selectedAppOrder.order_number}` : 'en Mostrador'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsPayModalVisible(false);
                  setSelectedAppOrder(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTotal, { color: colors.primary }]}>
              Total a cobrar: {formatPrice(currentPayTotal)}
            </Text>

            <Text style={[styles.methodTitle, { color: colors.textSecondary }]}>Medio de Pago:</Text>
            <View style={styles.methodGrid}>
              {(['CASH', 'CARD', 'QR', 'TRANSFER'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodBtn,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    paymentMethod === m && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(212, 163, 115, 0.15)' : '#F7F2EE' },
                  ]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={[styles.methodText, { color: colors.textSecondary }, paymentMethod === m && { color: colors.primary, fontWeight: '700' }]}>
                    {m === 'CASH' ? 'Efectivo' : m === 'CARD' ? 'Tarjeta' : m === 'QR' ? 'QR Mercado Pago' : 'Transferencia'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'CASH' && (
              <View style={[styles.cashSection, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.cashLabel, { color: colors.textSecondary }]}>Monto entregado por el cliente:</Text>

                {/* Accesos rápidos a billetes comunes */}
                <View style={styles.cashPresetsRow}>
                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      cashTendered === String(currentPayTotal) && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setCashTendered(String(currentPayTotal))}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        { color: colors.text },
                        cashTendered === String(currentPayTotal) && { color: '#FFFFFF' },
                      ]}
                    >
                      Exacto
                    </Text>
                  </TouchableOpacity>

                  {[1000, 2000, 5000, 10000, 20000].map((val) => {
                    if (val < currentPayTotal && val !== 10000 && val !== 20000) return null;
                    const isActive = cashTendered === String(val);
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.presetBtn,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setCashTendered(String(val))}
                      >
                        <Text style={[styles.presetBtnText, { color: colors.text }, isActive && { color: '#FFFFFF' }]}>
                          ${val.toLocaleString('es-AR')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.cashInputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>$</Text>
                  <TextInput
                    style={[styles.cashInput, { color: colors.text }]}
                    keyboardType="numeric"
                    maxLength={12}
                    placeholder="0.00"
                    placeholderTextColor={colors.placeholder}
                    value={cashTendered}
                    onChangeText={(txt) => setCashTendered(sanitizeDecimal(txt))}
                  />
                  {!!cashTendered && (
                    <TouchableOpacity
                      style={styles.clearCashBtn}
                      onPress={() => setCashTendered('')}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {cashNum > 0 ? (
                  cashNum >= currentPayTotal ? (
                    <View style={styles.changeSuccessCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                        <Text style={styles.changeSuccessLabel}>Vuelto a entregar:</Text>
                      </View>
                      <Text style={styles.changeSuccessValue}>
                        {formatPrice(cashNum - currentPayTotal)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.changeDeficitCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="alert-circle" size={16} color="#DC2626" />
                        <Text style={styles.changeDeficitLabel}>Monto insuficiente:</Text>
                      </View>
                      <Text style={styles.changeDeficitValue}>
                        Faltan {formatPrice(currentPayTotal - cashNum)}
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            )}

            <Button
              title="Confirmar Cobro"
              isLoading={isProcessing}
              onPress={selectedAppOrder ? handlePayAppOrder : handleConfirmPosPayment}
              style={{ marginTop: 16 }}
            />
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
          fetchPendingAppOrders();
        }}
      />

      {/* Modal para visualizar comprobante ampliado */}
      <Modal visible={!!previewReceiptUrl} transparent animationType="fade">
        <View style={styles.imageModalOverlay}>
          <View style={[styles.imageModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Comprobante de Transferencia</Text>
              <TouchableOpacity onPress={() => setPreviewReceiptUrl(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {previewReceiptUrl && (
              <Image source={{ uri: previewReceiptUrl }} style={styles.fullReceiptImage} resizeMode="contain" />
            )}
            <Button title="Cerrar vista previa" onPress={() => setPreviewReceiptUrl(null)} style={{ marginTop: 14 }} />
          </View>
        </View>
      </Modal>

      {/* Modal para especificar motivo de rechazo */}
      <Modal visible={!!orderToReject} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Rechazar Comprobante #{orderToReject?.order_number}
              </Text>
              <TouchableOpacity onPress={() => setOrderToReject(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.rejectionNotice, { color: colors.textSecondary }]}>
              Seleccioná o escribí el motivo por el cual no se acredita el pago para notificar al cliente:
            </Text>

            <View style={styles.reasonPillsRow}>
              {[
                'El monto de la transferencia no coincide',
                'Comprobante ilegible o borroso',
                'Operación no acreditada en la cuenta bancaria',
                'Comprobante duplicado o inválido',
              ].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    rejectionReason === reason && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                  ]}
                  onPress={() => setRejectionReason(reason)}
                >
                  <Text
                    style={[
                      styles.reasonPillText,
                      { color: colors.text },
                      rejectionReason === reason && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.customReasonInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Otro motivo..."
              placeholderTextColor={colors.placeholder}
              maxLength={200}
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button
                title="Confirmar Rechazo"
                variant="danger"
                isLoading={isVerifyingTransfer}
                onPress={handleConfirmRejectTransfer}
                style={{ flex: 1 }}
              />
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setOrderToReject(null)}
              />
            </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  topHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  topHeaderSub: {
    fontSize: 11,
    marginTop: 1,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    minWidth: 38,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    alignItems: 'stretch',
  },
  tabBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnCompact: {
    flexDirection: 'column',
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 4,
  },
  tabBtnActive: {
    borderBottomColor: '#6F4E37',
  },
  tabIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  tabBtnTextCompact: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  tabBtnTextActive: {
    fontWeight: '800',
  },
  tabCountPill: {
    minWidth: 20,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  posLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  posLayoutStacked: {
    flexDirection: 'column',
  },
  catalogCol: {
    flex: 1.35,
    padding: 10,
    borderRightWidth: 1,
  },
  catalogColStacked: {
    flex: 1.2,
    borderRightWidth: 0,
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
  },
  productGridItem: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 82,
    elevation: 1,
  },
  productGridPaused: {
    backgroundColor: '#FFEBEE',
    opacity: 0.7,
  },
  productGridName: {
    fontSize: 13,
    fontWeight: '700',
  },
  productGridPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  pausedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C62828',
  },
  ticketCol: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  ticketColStacked: {
    flex: 0.85,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  ticketList: {
    flex: 1,
  },
  emptyTicketText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  ticketRowName: {
    fontSize: 13,
    fontWeight: '600',
  },
  ticketRowPrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  ticketRowQty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
  },
  ticketQtyBtn: {
    padding: 6,
    borderRadius: 6,
  },
  ticketQtyNum: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  ticketFooter: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  ticketTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ticketTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  ticketTotalAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  appOrderCard: {
    padding: 14,
    marginBottom: 10,
  },
  appOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  appOrderNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  appOrderCustomer: {
    fontSize: 12,
  },
  appOrderTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  appOrderItems: {
    marginBottom: 10,
    gap: 2,
  },
  appOrderItemText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 480,
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
  modalTotal: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 12,
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cashSection: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
  },
  cashLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cashPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  cashInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  clearCashBtn: {
    padding: 6,
  },
  changeSuccessCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeSuccessLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  changeSuccessValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
  },
  changeDeficitCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeDeficitLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  changeDeficitValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B91C1C',
  },
  transferCard: {
    padding: 16,
    marginBottom: 14,
  },
  transferCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  mpBadge: {
    backgroundColor: 'rgba(0, 158, 227, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mpBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#009EE3',
  },
  orderTimeText: {
    fontSize: 11,
    marginTop: 2,
  },
  transferInfoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 10,
    gap: 8,
  },
  transferInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  transferInfoValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  receiptPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 158, 227, 0.2)',
  },
  receiptThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  viewReceiptLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  receiptHint: {
    fontSize: 10,
    marginTop: 1,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  imageModalContent: {
    borderRadius: 16,
    padding: 18,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  fullReceiptImage: {
    width: '100%',
    height: 340,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  rejectionNotice: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  reasonPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  reasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  reasonPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customReasonInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    marginBottom: 6,
  },
  shiftWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  shiftWarningLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  shiftWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  shiftWarningBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  shiftWarningBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
