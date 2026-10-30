import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { useCart } from '../../src/context/CartContext';
import { useBranch } from '../../src/context/BranchContext';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatPrice } from '../../src/utils/format';
import { useTheme } from '../../src/context/ThemeContext';

export default function CartScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { showPopup } = usePopup();
  const {
    items,
    branchId,
    totalAmount,
    subtotal,
    taxAmount,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();
  const { selectedBranch } = useBranch();

  const [orderType, setOrderType] = useState<'TAKE_AWAY' | 'DINE_IN'>('TAKE_AWAY');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [applyPoints, setApplyPoints] = useState(false);

  // Medio de pago: Mostrador o Mercado Pago Transferencia/QR
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [transferReference, setTransferReference] = useState('');
  const [transferReceipt, setTransferReceipt] = useState<string | null>(null);

  React.useEffect(() => {
    apiClient
      .post('/loyalty/me')
      .then((res) => setAvailablePoints(res.data.data.pointsBalance || 0))
      .catch((err) => console.log('[Cart] Error cargando puntos:', err));
  }, []);

  const maxPointsToRedeem = Math.min(
    availablePoints,
    Math.floor(totalAmount / 10)
  );
  const pointsDiscount = applyPoints ? maxPointsToRedeem * 10 : 0;
  const finalTotalAmount = Math.max(0, totalAmount - pointsDiscount);

  // Alias ficticio determinístico según la sucursal seleccionada
  const branchSlugClean = (selectedBranch?.slug || 'palermo').replace(/[^a-z0-9]/g, '');
  const branchMpAlias = `latesoft.${branchSlugClean}.mp`;

  const handleCopyAlias = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(branchMpAlias);
      }
      showPopup({
        title: '¡Alias Copiado!',
        message: `El alias "${branchMpAlias}" fue copiado al portapapeles. Abrí tu app de Mercado Pago para realizar la transferencia por ${formatPrice(finalTotalAmount)}.`,
        type: 'success',
      });
    } catch {
      showPopup({
        title: 'Alias de transferencia',
        message: branchMpAlias,
        type: 'info',
      });
    }
  };

  const handlePickReceipt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setTransferReceipt(result.assets[0].uri);
      }
    } catch {
      handleSimulateSampleReceipt();
    }
  };

  const handleSimulateSampleReceipt = () => {
    const randomOp = Math.floor(10000000 + Math.random() * 90000000);
    const mockReceipt = `https://storage.latesoft.com.ar/receipts/mp_transfer_${randomOp}.jpg`;
    setTransferReceipt(mockReceipt);
    if (!transferReference) {
      setTransferReference(String(randomOp));
    }
    showPopup({
      title: 'Comprobante simulado cargado',
      message: `Se adjuntó el comprobante ficticio con N° de Operación #${randomOp}.`,
      type: 'info',
    });
  };

  if (items.length === 0) {
    return (
      <Screen style={styles.screen}>
        <EmptyState
          icon="cart-outline"
          title="Tu carrito está vacío"
          description="Elegí tus cafés de especialidad o pastelería favorita desde la carta."
          actionTitle="Ver la carta"
          onAction={() => router.push('/(customer)/home')}
        />
      </Screen>
    );
  }

  const handleCheckout = async () => {
    if (!branchId) {
      showPopup({
        title: 'Error',
        message: 'No se ha seleccionado una sucursal.',
        type: 'error',
      });
      return;
    }

    // Validación estricta para Mercado Pago
    if (paymentMethod === 'TRANSFER') {
      if (!transferReference.trim() || transferReference.trim().length < 4) {
        showPopup({
          title: 'Número de operación requerido',
          message: 'Por favor ingresá el número de comprobante u operación de Mercado Pago (mínimo 4 caracteres).',
          type: 'warning',
        });
        return;
      }
      if (!transferReceipt) {
        showPopup({
          title: 'Comprobante requerido',
          message: 'Por favor adjuntá la foto o captura del comprobante de transferencia para que el cajero pueda verificar la acreditación.',
          type: 'warning',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        branchId,
        orderType,
        paymentMethod: paymentMethod === 'TRANSFER' ? 'TRANSFER' : 'CASH',
        pointsToRedeem: applyPoints && maxPointsToRedeem > 0 ? maxPointsToRedeem : undefined,
        notes: generalNotes.trim() || undefined,
        items: items.map((i) => ({
          branchProductId: i.branchProductId,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
      };

      if (paymentMethod === 'TRANSFER') {
        payload.transferReference = transferReference.trim();
        payload.transferReceiptUrl = transferReceipt;
      }

      const res = await apiClient.post('/orders', payload);
      const order = res.data.order;

      clearCart();

      if (paymentMethod === 'TRANSFER') {
        showPopup({
          title: '¡Comprobante Enviado!',
          message: `Tu pedido #${order.order_number} fue registrado con éxito.\n\nEl cajero o encargado de ${selectedBranch?.name || 'la sucursal'} verificará la transferencia por ${formatPrice(finalTotalAmount)} y comenzará la preparación inmediatamente.`,
          type: 'success',
          confirmText: 'Ver estado del pedido',
          onConfirm: () => router.push('/(customer)/orders'),
        });
      } else {
        showPopup({
          title: '¡Pedido Confirmado!',
          message: `Tu pedido #${order.order_number} fue generado exitosamente.\n\nPago en mostrador: abonás al retirar en ${selectedBranch?.name || 'la sucursal'}.`,
          type: 'success',
          confirmText: 'Ver mis pedidos',
          onConfirm: () => router.push('/(customer)/orders'),
        });
      }
    } catch (err: any) {
      showPopup({
        title: 'Error al enviar pedido',
        message: err.message || 'Intentá nuevamente.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mi Carrito</Text>
        <TouchableOpacity
          onPress={clearCart}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
          accessibilityLabel="Vaciar todo el carrito"
        >
          <Text style={styles.clearCartText}>Vaciar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.branchProductId)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={[styles.branchBanner, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="storefront" size={16} color={colors.primary} />
            <Text style={[styles.branchBannerText, { color: colors.text }]}>
              Retiro en: <Text style={{ fontWeight: '700' }}>{selectedBranch?.name || 'Sucursal activa'}</Text>
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemPriceUnit, { color: colors.textSecondary }]}>
                  {formatPrice(item.price)} c/u
                </Text>
                {item.notes ? (
                  <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>Nota: {item.notes}</Text>
                ) : null}
              </View>

              <Text style={[styles.itemLineTotal, { color: colors.primary }]}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>

            <View style={[styles.itemControls, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => removeItem(item.branchProductId)}
                accessibilityLabel={`Quitar ${item.name} del carrito`}
              >
                <Ionicons name="trash-outline" size={16} color="#C62828" />
                <Text style={styles.deleteBtnText}>Quitar</Text>
              </TouchableOpacity>

              <View style={[styles.counter, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity
                  style={styles.counterAction}
                  onPress={() => updateQuantity(item.branchProductId, item.quantity - 1)}
                  accessibilityLabel={`Disminuir cantidad de ${item.name}`}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.counterValue, { color: colors.text }]}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.counterAction}
                  onPress={() => updateQuantity(item.branchProductId, item.quantity + 1)}
                  accessibilityLabel={`Aumentar cantidad de ${item.name}`}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.footerSection}>
            {/* Modalidad de pedido */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Modalidad de consumo</Text>
            <View style={styles.orderTypeRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: colors.surface, borderColor: colors.primary },
                  orderType === 'TAKE_AWAY' && [styles.typeButtonActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => setOrderType('TAKE_AWAY')}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={18}
                  color={orderType === 'TAKE_AWAY' ? '#FFF' : colors.primary}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: colors.primary },
                    orderType === 'TAKE_AWAY' && styles.typeButtonTextActive,
                  ]}
                >
                  Para llevar (Take Away)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: colors.surface, borderColor: colors.primary },
                  orderType === 'DINE_IN' && [styles.typeButtonActive, { backgroundColor: colors.primary }],
                ]}
                onPress={() => setOrderType('DINE_IN')}
              >
                <Ionicons
                  name="cafe-outline"
                  size={18}
                  color={orderType === 'DINE_IN' ? '#FFF' : colors.primary}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: colors.primary },
                    orderType === 'DINE_IN' && styles.typeButtonTextActive,
                  ]}
                >
                  Consumir en el local
                </Text>
              </TouchableOpacity>
            </View>

            {/* Aclaraciones generales */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notas para el pedido</Text>
            <TextInput
              style={[styles.generalNotesInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Ej. Paso en 15 minutos, nombre para comanda..."
              placeholderTextColor={colors.placeholder}
              value={generalNotes}
              onChangeText={setGeneralNotes}
            />

            {/* Medio de Pago: Mostrador o Mercado Pago */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Medio de pago</Text>
            <View style={styles.paymentMethodRow}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  paymentMethod === 'CASH' && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(111,78,55,0.2)' : '#FAF6F3' },
                ]}
                onPress={() => setPaymentMethod('CASH')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={paymentMethod === 'CASH' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.paymentMethodBtnText,
                    { color: paymentMethod === 'CASH' ? colors.primary : colors.textSecondary },
                    paymentMethod === 'CASH' && { fontWeight: '800' },
                  ]}
                >
                  Efectivo en mostrador
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  paymentMethod === 'TRANSFER' && { borderColor: '#009EE3', backgroundColor: isDark ? 'rgba(0,158,227,0.15)' : '#EBF7FF' },
                ]}
                onPress={() => setPaymentMethod('TRANSFER')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={20}
                  color={paymentMethod === 'TRANSFER' ? '#009EE3' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.paymentMethodBtnText,
                    { color: paymentMethod === 'TRANSFER' ? '#009EE3' : colors.textSecondary },
                    paymentMethod === 'TRANSFER' && { fontWeight: '800' },
                  ]}
                >
                  Mercado Pago (Alias / QR)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tarjeta interactiva de Mercado Pago con Alias y QR */}
            {paymentMethod === 'TRANSFER' && (
              <Card style={[styles.mpCard, isDark && { backgroundColor: '#132332', borderColor: '#007CB9' }]}>
                <View style={styles.mpHeader}>
                  <View style={styles.mpLogoBadge}>
                    <Ionicons name="card" size={18} color="#009EE3" />
                    <Text style={styles.mpBrandText}>Mercado Pago</Text>
                  </View>
                  <Text style={[styles.mpAmountText, { color: colors.text }]}>
                    Transferir: <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatPrice(finalTotalAmount)}</Text>
                  </Text>
                </View>

                {/* Tarjeta de Alias Ficticio */}
                <View style={[styles.mpAliasBox, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mpFieldLabel, { color: colors.textSecondary }]}>Alias de la sucursal:</Text>
                    <Text style={[styles.mpAliasValue, { color: colors.text }]} selectable>
                      {branchMpAlias}
                    </Text>
                    <Text style={[styles.mpTitularInfo, { color: colors.textSecondary }]}>
                      LateSoft S.R.L. • CUIT 30-71649281-9
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyAliasBtn, { backgroundColor: colors.primary }]}
                    onPress={handleCopyAlias}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.copyAliasBtnText}>Copiar</Text>
                  </TouchableOpacity>
                </View>

                {/* QR Ficticio de la sucursal */}
                <View style={styles.mpQrContainer}>
                  <View style={styles.mpQrBox}>
                    <Ionicons name="qr-code" size={100} color="#009EE3" />
                    <View style={styles.mpQrCenterLogo}>
                      <Ionicons name="cafe" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={[styles.mpQrHint, { color: colors.textSecondary }]}>
                    Escaneá el código QR desde tu app de Mercado Pago o transferí usando el Alias.
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Formulario de validación del comprobante */}
                <Text style={[styles.formInputTitle, { color: colors.text }]}>
                  1. N° de Comprobante / Operación de Mercado Pago *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                    !transferReference.trim() && { borderColor: '#F59E0B' },
                  ]}
                  placeholder="Ej: 89341258 (obligatorio)"
                  placeholderTextColor={colors.placeholder}
                  value={transferReference}
                  onChangeText={setTransferReference}
                  keyboardType="numeric"
                />

                <Text style={[styles.formInputTitle, { color: colors.text, marginTop: 8 }]}>
                  2. Foto o captura del comprobante *
                </Text>

                {transferReceipt ? (
                  <View style={styles.receiptPreviewContainer}>
                    <Image source={{ uri: transferReceipt }} style={styles.receiptThumbnail} />
                    <View style={styles.receiptPreviewInfo}>
                      <View style={styles.receiptCheckRow}>
                        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                        <Text style={styles.receiptAttachedText}>Comprobante adjuntado</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.changeReceiptBtn, { borderColor: colors.border }]}
                        onPress={handlePickReceipt}
                      >
                        <Text style={[styles.changeReceiptText, { color: colors.textSecondary }]}>Cambiar imagen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.receiptActionsRow}>
                    <TouchableOpacity
                      style={[styles.uploadReceiptBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                      onPress={handlePickReceipt}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                      <Text style={[styles.uploadReceiptText, { color: colors.text }]}>Elegir captura de pantalla</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.mockReceiptBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                      onPress={handleSimulateSampleReceipt}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles-outline" size={16} color="#D97706" />
                      <Text style={[styles.mockReceiptText, { color: '#D97706' }]}>Generar comprobante simulado</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.mpWarningRow}>
                  <Ionicons name="information-circle-outline" size={16} color="#009EE3" />
                  <Text style={[styles.mpWarningText, { color: colors.textSecondary }]}>
                    Al enviar el pedido, el cajero verificará la acreditación bancaria y la orden pasará de inmediato a la cocina.
                  </Text>
                </View>
              </Card>
            )}

            {/* Canje de Puntos de Fidelización */}
            {availablePoints > 0 && (
              <Card style={[styles.loyaltyCard, isDark && { backgroundColor: '#2E2211', borderColor: '#4A371B' }]}>
                <View style={styles.loyaltyRow}>
                  <View style={styles.loyaltyIconCircle}>
                    <Ionicons name="sparkles" size={20} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.loyaltyTitle, isDark && { color: '#FCD34D' }]}>LatePoints Disponibles</Text>
                    <Text style={[styles.loyaltySubtitle, isDark && { color: '#FBBF24' }]}>
                      Tenés {availablePoints} pts. Descontá hasta {formatPrice(maxPointsToRedeem * 10)}.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.redeemBtn, applyPoints && styles.redeemBtnActive]}
                    onPress={() => setApplyPoints(!applyPoints)}
                  >
                    <Ionicons
                      name={applyPoints ? 'checkmark-circle' : 'add-circle-outline'}
                      size={16}
                      color={applyPoints ? '#FFFFFF' : '#92400E'}
                    />
                    <Text style={[styles.redeemBtnText, applyPoints && styles.redeemBtnTextActive]}>
                      {applyPoints ? 'Aplicado' : 'Canjear'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}

            {/* Resumen impositivo oficial de Argentina */}
            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Resumen del pedido</Text>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal (Neto gravado)</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(subtotal)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>IVA discriminado (21%)</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(taxAmount)}</Text>
              </View>

              {pointsDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#059669', fontWeight: '700' }]}>
                    Descuento LatePoints ({maxPointsToRedeem} pts)
                  </Text>
                  <Text style={[styles.summaryValue, { color: '#059669', fontWeight: '700' }]}>
                    - {formatPrice(pointsDiscount)}
                  </Text>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total final a pagar</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>{formatPrice(finalTotalAmount)}</Text>
              </View>

              <Text style={[styles.vatNotice, { color: colors.textSecondary }]}>
                * Precios finales con IVA incluido según legislación de la Rep. Argentina.
              </Text>
            </Card>

            <Button
              title="Confirmar pedido para retirar"
              onPress={handleCheckout}
              isLoading={isSubmitting}
              style={styles.checkoutBtn}
            />
          </View>
        }
      />
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1810',
  },
  clearCartText: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  branchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F2EE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  branchBannerText: {
    fontSize: 13,
    color: '#6F4E37',
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1810',
  },
  itemPriceUnit: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  itemNotes: {
    fontSize: 11,
    color: '#8D6E63',
    fontStyle: 'italic',
    marginTop: 4,
  },
  itemLineTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6F4E37',
  },
  itemControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE9',
    paddingTop: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#C62828',
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  counterAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
  },
  footerSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginVertical: 8,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#6F4E37',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: '#6F4E37',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6F4E37',
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  generalNotesInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#333',
    marginBottom: 16,
  },
  loyaltyCard: {
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  loyaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loyaltyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  loyaltySubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  redeemBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  redeemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  redeemBtnTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1810',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  summaryValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEBE9',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1810',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6F4E37',
  },
  vatNotice: {
    fontSize: 11,
    color: '#8D6E63',
    fontStyle: 'italic',
    marginTop: 8,
  },
  checkoutBtn: {
    marginBottom: 20,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
    minHeight: 48,
  },
  paymentMethodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  mpCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1.5,
  },
  mpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mpLogoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 5,
  },
  mpBrandText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#009EE3',
  },
  mpAmountText: {
    fontSize: 13,
  },
  mpAliasBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  mpFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  mpAliasValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  mpTitularInfo: {
    fontSize: 10,
    marginTop: 2,
  },
  copyAliasBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  copyAliasBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mpQrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  mpQrBox: {
    width: 130,
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  mpQrCenterLogo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#009EE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mpQrHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  formInputTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 11,
    fontSize: 14,
    marginBottom: 8,
  },
  receiptActionsRow: {
    gap: 8,
    marginBottom: 10,
  },
  uploadReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadReceiptText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mockReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  mockReceiptText: {
    fontSize: 12,
    fontWeight: '700',
  },
  receiptPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderRadius: 8,
    padding: 10,
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  receiptThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  receiptPreviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  receiptCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  receiptAttachedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  changeReceiptBtn: {
    marginTop: 4,
    paddingVertical: 4,
  },
  changeReceiptText: {
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  mpWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  mpWarningText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
});
