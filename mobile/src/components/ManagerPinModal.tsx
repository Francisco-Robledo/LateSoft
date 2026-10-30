import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { usePopup } from '../context/PopupContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';

interface ManagerPinModalProps {
  visible: boolean;
  orderId: number | null;
  orderNumber?: number;
  onClose: () => void;
  onSuccess: (order: any, authorizedBy: string) => void;
}

export function ManagerPinModal({
  visible,
  orderId,
  orderNumber,
  onClose,
  onSuccess,
}: ManagerPinModalProps) {
  const { colors, isDark } = useTheme();
  const { showPopup } = usePopup();
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPin('');
    setReason('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!orderId) return;

    if (!pin || pin.length < 4) {
      showPopup({
        title: 'PIN Requerido',
        message: 'Ingresá el PIN de 4 dígitos del encargado para autorizar.',
        type: 'warning',
      });
      return;
    }

    if (!reason.trim()) {
      showPopup({
        title: 'Motivo Requerido',
        message: 'Ingresá o seleccioná un motivo para justificar la anulación.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/orders/${orderId}/override-cancel`, {
        managerPin: pin,
        reason: reason.trim(),
      });

      const { order, authorizedBy } = res.data;
      resetForm();
      onClose();

      showPopup({
        title: 'Comanda Anulada',
        message: `La orden #${orderNumber || orderId} fue cancelada con éxito. Autorizado por: ${authorizedBy}`,
        type: 'success',
      });

      onSuccess(order, authorizedBy);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        'No se pudo autorizar la anulación. Verificá que el PIN sea correcto.';
      showPopup({
        title: 'Error de Autorización',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPresetReason = (text: string) => {
    setReason(text);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? '#3D2A14' : '#FEF3C7' }]}>
                    <Ionicons name="shield-checkmark" size={24} color="#D97706" />
                  </View>
                  <Text style={[styles.title, { color: colors.text }]}>Autorización de Encargado</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Anular Pedido #{orderNumber || orderId} (Manager Override)
                  </Text>
                </View>

                {/* PIN Input */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>PIN del Encargado (4 dígitos)</Text>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="••••"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry
                    autoFocus={visible}
                  />
                </View>

                {/* Quick Reasons */}
                <Text style={[styles.label, { color: colors.textSecondary }]}>Motivo de cancelación</Text>
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      reason === 'Error de carga en mostrador' && { backgroundColor: isDark ? '#4A371B' : '#FEF3C7', borderColor: '#F59E0B' },
                    ]}
                    onPress={() => setPresetReason('Error de carga en mostrador')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                        reason === 'Error de carga en mostrador' && { color: isDark ? '#FCD34D' : '#92400E', fontWeight: '700' },
                      ]}
                    >
                      Error mostrador
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      reason === 'Cliente canceló el pedido' && { backgroundColor: isDark ? '#4A371B' : '#FEF3C7', borderColor: '#F59E0B' },
                    ]}
                    onPress={() => setPresetReason('Cliente canceló el pedido')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                        reason === 'Cliente canceló el pedido' && { color: isDark ? '#FCD34D' : '#92400E', fontWeight: '700' },
                      ]}
                    >
                      Cliente desistió
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      reason === 'Falta de stock de insumo' && { backgroundColor: isDark ? '#4A371B' : '#FEF3C7', borderColor: '#F59E0B' },
                    ]}
                    onPress={() => setPresetReason('Falta de stock de insumo')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                        reason === 'Falta de stock de insumo' && { color: isDark ? '#FCD34D' : '#92400E', fontWeight: '700' },
                      ]}
                    >
                      Falta de insumo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Reason Input */}
                <TextInput
                  style={[styles.reasonInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="O describí el motivo específico..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={2}
                />

                {/* Actions */}
                <View style={styles.buttonsRow}>
                  <Button
                    title="Volver"
                    variant="outline"
                    onPress={handleClose}
                    style={styles.cancelBtn}
                    disabled={isSubmitting}
                  />
                  <Button
                    title={isSubmitting ? 'Validando...' : 'Anular Comanda'}
                    variant="danger"
                    onPress={handleSubmit}
                    isLoading={isSubmitting}
                    style={styles.confirmBtn}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 420,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pinInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 54,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#92400E',
    fontWeight: '700',
  },
  reasonInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 1.3,
  },
});
