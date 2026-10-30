import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatPrice, formatDateTime } from '../../src/utils/format';
import { ScrollToTopButton, useScrollToTop } from '../../src/components/ScrollToTopButton';
import { useTheme } from '../../src/context/ThemeContext';

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface Order {
  id: number;
  branch_id: number;
  branch_name: string;
  order_number: number;
  business_date: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  payment_status: 'UNPAID' | 'PAID' | 'PENDING_VERIFICATION';
  payment_method: string | null;
  transfer_reference?: string | null;
  transfer_receipt_url?: string | null;
  transfer_rejected_reason?: string | null;
  order_type: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: OrderItem[];
}

export default function CustomerOrdersScreen() {
  const { colors, isDark } = useTheme();
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { scrollRef, showScrollTop, handleScroll, scrollToTop } = useScrollToTop(150);

  // Modal para re-subir comprobante corregido si fue rechazado
  const [orderToReupload, setOrderToReupload] = useState<Order | null>(null);
  const [newReference, setNewReference] = useState('');
  const [newReceiptUrl, setNewReceiptUrl] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.post('/orders', { limit: 25, isList: true });
      setOrders(res.data.data);
    } catch (err) {
      console.error('[Orders] Error al consultar pedidos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Polling cada 5 segundos mientras la pantalla está activa
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const interval = setInterval(() => {
        fetchOrders();
      }, 5000);

      return () => clearInterval(interval);
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const openReuploadModal = (order: Order) => {
    setOrderToReupload(order);
    setNewReference(order.transfer_reference || '');
    setNewReceiptUrl(order.transfer_receipt_url || null);
  };

  const handlePickNewReceipt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewReceiptUrl(result.assets[0].uri);
      }
    } catch {
      handleSimulateSampleReceipt();
    }
  };

  const handleSimulateSampleReceipt = () => {
    const randomOp = Math.floor(10000000 + Math.random() * 90000000);
    const mock = `https://storage.latesoft.com.ar/receipts/mp_reupload_${randomOp}.jpg`;
    setNewReceiptUrl(mock);
    if (!newReference) {
      setNewReference(String(randomOp));
    }
  };

  const handleSubmitNewProof = async () => {
    if (!orderToReupload) return;
    if (!newReference.trim() || newReference.trim().length < 4) {
      showPopup({
        title: 'N° de operación requerido',
        message: 'Por favor ingresá el número de comprobante (mínimo 4 caracteres).',
        type: 'warning',
      });
      return;
    }
    if (!newReceiptUrl) {
      showPopup({
        title: 'Comprobante requerido',
        message: 'Por favor adjuntá la imagen del comprobante corregido.',
        type: 'warning',
      });
      return;
    }

    setIsSubmittingProof(true);
    try {
      await apiClient.post(`/orders/${orderToReupload.id}/transfer-proof`, {
        transferReference: newReference.trim(),
        transferReceiptUrl: newReceiptUrl,
      });

      showPopup({
        title: 'Comprobante reenviado',
        message: 'Tu comprobante fue enviado al cajero para una nueva verificación.',
        type: 'success',
      });

      setOrderToReupload(null);
      fetchOrders();
    } catch (err: any) {
      showPopup({
        title: 'Error al enviar comprobante',
        message: err.message || 'No se pudo registrar el nuevo comprobante.',
        type: 'error',
      });
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const renderStepper = (status: Order['status'], paymentStatus: Order['payment_status']) => {
    if (status === 'CANCELLED') {
      return (
        <View style={styles.cancelledBadge}>
          <Ionicons name="close-circle" size={16} color="#C62828" />
          <Text style={styles.cancelledText}>Pedido Cancelado</Text>
        </View>
      );
    }

    const firstStepLabel =
      paymentStatus === 'PENDING_VERIFICATION'
        ? 'Comprobante en revisión'
        : paymentStatus === 'UNPAID'
        ? 'Por cobrar en caja'
        : 'Recibido';

    const steps = [
      { key: 'PENDING', label: firstStepLabel },
      { key: 'PREPARING', label: 'En preparación' },
      { key: 'READY', label: '¡Listo para retirar!' },
      { key: 'DELIVERED', label: 'Entregado' },
    ];

    const currentStepIndex =
      status === 'PENDING' ? 0 :
      status === 'PREPARING' ? 1 :
      status === 'READY' ? 2 : 3;

    return (
      <View style={styles.stepperContainer}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <View key={step.key} style={styles.stepItem}>
              <View style={styles.stepIndicatorRow}>
                {idx > 0 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E0E0E0' },
                      (isCompleted || isCurrent) && styles.stepLineActive,
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: isDark ? colors.surfaceSecondary : '#EEE', borderColor: colors.border },
                    isCompleted && [styles.stepDotCompleted, { backgroundColor: colors.primary }],
                    isCurrent && [
                      styles.stepDotCurrent,
                      { backgroundColor: colors.primary, borderColor: isDark ? '#FBBF24' : '#D4B996' },
                    ],
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepDotNumber,
                        { color: isDark ? '#FFF' : '#777' },
                        isCurrent && styles.stepDotNumberCurrent,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>
                {idx < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E0E0E0' },
                      isCompleted && styles.stepLineActive,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: isCurrent ? (isDark ? '#FBBF24' : colors.primary) : colors.textSecondary },
                  isCurrent && styles.stepLabelCurrent,
                ]}
                numberOfLines={2}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const getPaymentBadgeInfo = (paymentStatus: Order['payment_status']) => {
    if (paymentStatus === 'PAID') {
      return {
        label: 'PAGADO',
        bg: isDark ? 'rgba(46, 125, 50, 0.2)' : '#E8F5E9',
        color: isDark ? '#4ADE80' : '#2E7D32',
      };
    }
    if (paymentStatus === 'PENDING_VERIFICATION') {
      return {
        label: 'VERIFICANDO PAGO (MP)',
        bg: isDark ? 'rgba(0, 158, 227, 0.25)' : '#E0F2FE',
        color: isDark ? '#38BDF8' : '#0284C7',
      };
    }
    return {
      label: 'PENDIENTE DE PAGO EN CAJA',
      bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFF3E0',
      color: isDark ? '#FBBF24' : '#E65100',
    };
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mis Pedidos</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Seguimiento en vivo cada 5 segundos
        </Text>
      </View>

      <FlatList
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="receipt-outline"
              title="Aún no realizaste ningún pedido"
              description="Tus comandas y pedidos anteriores aparecerán acá con su estado en tiempo real."
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const badgeInfo = getPaymentBadgeInfo(item.payment_status);

          return (
            <Card style={styles.orderCard}>
              <View style={[styles.orderHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.orderNumber, { color: colors.primary }]}>Pedido #{item.order_number}</Text>
                  <Text style={[styles.orderBranch, { color: colors.textSecondary }]}>{item.branch_name}</Text>
                </View>

                <View style={styles.dateAndPayment}>
                  <Text style={[styles.orderDate, { color: colors.textSecondary }]}>{formatDateTime(item.created_at)}</Text>
                  <View
                    style={[
                      styles.paymentBadge,
                      { backgroundColor: badgeInfo.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paymentBadgeText,
                        { color: badgeInfo.color, fontWeight: '800' },
                      ]}
                    >
                      {badgeInfo.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stepper visual en vivo */}
              <View style={styles.stepperWrapper}>
                {renderStepper(item.status, item.payment_status)}
              </View>

              {/* Aviso de verificación de comprobante Mercado Pago */}
              {item.payment_status === 'PENDING_VERIFICATION' && (
                <View style={[styles.verificationBox, { backgroundColor: isDark ? 'rgba(0,158,227,0.15)' : '#EBF7FF', borderColor: '#009EE3' }]}>
                  <View style={styles.verificationHeader}>
                    <Ionicons name="time" size={18} color="#009EE3" />
                    <Text style={[styles.verificationTitle, { color: isDark ? '#7DD3FC' : '#0369A1' }]}>
                      Comprobante enviado • En verificación
                    </Text>
                  </View>
                  <Text style={[styles.verificationSubtitle, { color: colors.textSecondary }]}>
                    Esperando confirmación del cajero o encargado de la sucursal para pasar a preparación en cocina.
                  </Text>
                  {item.transfer_reference ? (
                    <View style={styles.verificationDetailRow}>
                      <Text style={[styles.verificationOpText, { color: colors.text }]}>
                        N° de Operación: <Text style={{ fontWeight: '800', color: colors.primary }}>{item.transfer_reference}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Aviso de rechazo de comprobante con opción de re-subida */}
              {item.payment_status === 'UNPAID' && item.transfer_rejected_reason && (
                <View style={[styles.rejectedBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: '#EF4444' }]}>
                  <View style={styles.rejectedHeader}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={[styles.rejectedTitle, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                      Comprobante no acreditado o rechazado
                    </Text>
                  </View>
                  <Text style={[styles.rejectedReason, { color: isDark ? '#F87171' : '#991B1B' }]}>
                    Motivo: {item.transfer_rejected_reason}
                  </Text>
                  <TouchableOpacity
                    style={[styles.reuploadBtn, { backgroundColor: colors.primary }]}
                    onPress={() => openReuploadModal(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                    <Text style={styles.reuploadBtnText}>Volver a subir comprobante</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Resumen de productos con contraste dinámico oscuro/claro */}
              <View
                style={[
                  styles.itemsSummary,
                  {
                    backgroundColor: isDark ? colors.surfaceSecondary : '#F8F5F2',
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                {item.items.map((line, idx) => (
                  <View key={idx} style={styles.orderLineRow}>
                    <Text style={[styles.orderLineName, { color: colors.text }]}>
                      {line.quantity}x {line.product_name}
                    </Text>
                    <Text style={[styles.orderLinePrice, { color: isDark ? '#FCD34D' : colors.primary }]}>
                      {formatPrice(line.unit_price * line.quantity)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.orderFooter}>
                <Text style={[styles.orderTotalLabel, { color: colors.text }]}>Total con IVA:</Text>
                <Text style={[styles.orderTotalValue, { color: colors.primary }]}>{formatPrice(item.total_amount)}</Text>
              </View>
            </Card>
          );
        }}
      />
      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />

      {/* Modal para re-subir comprobante corregido */}
      <Modal visible={!!orderToReupload} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reenviar comprobante #{orderToReupload?.order_number}
              </Text>
              <TouchableOpacity
                onPress={() => setOrderToReupload(null)}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel="Cerrar modal"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Ingresá el número de operación y la captura del comprobante corregido para que el cajero lo apruebe.
            </Text>

            <Text style={[styles.formLabel, { color: colors.text }]}>N° de Operación de Mercado Pago *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Ej: 89341258"
              placeholderTextColor={colors.placeholder}
              value={newReference}
              onChangeText={setNewReference}
              keyboardType="numeric"
            />

            <Text style={[styles.formLabel, { color: colors.text, marginTop: 10 }]}>Comprobante de transferencia *</Text>
            {newReceiptUrl ? (
              <View style={styles.previewBox}>
                <Image source={{ uri: newReceiptUrl }} style={styles.previewImage} />
                <TouchableOpacity onPress={handlePickNewReceipt}>
                  <Text style={[styles.changeReceiptText, { color: colors.primary }]}>Cambiar imagen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 8, marginVertical: 8 }}>
                <Button
                  title="Elegir captura de pantalla"
                  variant="outline"
                  onPress={handlePickNewReceipt}
                  icon={<Ionicons name="image-outline" size={18} color={colors.primary} />}
                />
                <Button
                  title="Usar comprobante simulado"
                  variant="outline"
                  onPress={handleSimulateSampleReceipt}
                  icon={<Ionicons name="sparkles-outline" size={18} color="#D97706" />}
                />
              </View>
            )}

            <Button
              title="Reenviar al cajero"
              onPress={handleSubmitNewProof}
              isLoading={isSubmittingProof}
              style={{ marginTop: 16 }}
            />
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
    fontSize: 13,
    color: '#7D5A44',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  orderCard: {
    padding: 16,
    marginBottom: 14,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE9',
    paddingBottom: 10,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6F4E37',
  },
  orderBranch: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginTop: 2,
  },
  dateAndPayment: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontSize: 11,
    color: '#888',
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  paidBadge: {
    backgroundColor: '#E8F5E9',
  },
  paidBadgeDark: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  unpaidBadge: {
    backgroundColor: '#FFF3E0',
  },
  unpaidBadgeDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  paidText: {
    color: '#2E7D32',
  },
  paidTextDark: {
    color: '#4ADE80',
  },
  unpaidText: {
    color: '#E65100',
  },
  unpaidTextDark: {
    color: '#FBBF24',
  },
  stepperWrapper: {
    marginVertical: 14,
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  cancelledText: {
    color: '#C62828',
    fontWeight: '700',
    fontSize: 13,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
  },
  stepLineActive: {
    backgroundColor: '#6F4E37',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCompleted: {
    backgroundColor: '#6F4E37',
  },
  stepDotCurrent: {
    backgroundColor: '#6F4E37',
    borderWidth: 2,
    borderColor: '#D4B996',
  },
  stepDotNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#777',
  },
  stepDotNumberCurrent: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  stepLabelCurrent: {
    color: '#6F4E37',
    fontWeight: '700',
  },
  itemsSummary: {
    backgroundColor: '#F8F5F2',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    gap: 4,
  },
  orderLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderLineName: {
    fontSize: 12,
    color: '#444',
  },
  orderLinePrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6F4E37',
  },
  verificationBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    marginVertical: 10,
    gap: 4,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  verificationSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  verificationDetailRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 158, 227, 0.2)',
  },
  verificationOpText: {
    fontSize: 12,
  },
  rejectedBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    marginVertical: 10,
    gap: 6,
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rejectedTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  rejectedReason: {
    fontSize: 12,
    fontWeight: '600',
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
    marginTop: 4,
  },
  reuploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
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
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
  },
  previewBox: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  changeReceiptText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
