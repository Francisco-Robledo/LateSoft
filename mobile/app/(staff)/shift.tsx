import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatPrice, formatDateTime } from '../../src/utils/format';
import { useTheme } from '../../src/context/ThemeContext';

export default function ShiftScreen() {
  const { colors, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const branchId = user?.branchId || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);

  // Apertura de turno
  const [initialCashInput, setInitialCashInput] = useState('15000');
  const [openNotes, setOpenNotes] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  // Cierre de turno y arqueo
  const [finalCashInput, setFinalCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const fetchShift = useCallback(async () => {
    try {
      const res = await apiClient.post('/shifts/current', { branchId });
      setShiftData(res.data.data);
      if (res.data.data?.summary?.expectedCash !== undefined) {
        setFinalCashInput(String(res.data.data.summary.expectedCash));
      }
    } catch (err: any) {
      console.error('[Shift] Error cargando turno:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  const handleOpenShift = async () => {
    const cash = Number(initialCashInput);
    if (isNaN(cash) || cash < 0) {
      showPopup({
        title: 'Monto inválido',
        message: 'Ingresá un fondo inicial válido en pesos argentinos.',
        type: 'warning',
      });
      return;
    }

    setIsOpening(true);
    try {
      await apiClient.post('/shifts/open', {
        branchId,
        initialCash: cash,
        notes: openNotes.trim() || undefined,
      });

      showPopup({
        title: 'Turno Abierto',
        message: `El turno de caja se abrió con un fondo inicial de ${formatPrice(cash)}.`,
        type: 'success',
      });

      setOpenNotes('');
      fetchShift();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'No se pudo abrir el turno.';
      showPopup({
        title: 'Error al abrir turno',
        message: msg,
        type: 'error',
      });
    } finally {
      setIsOpening(false);
    }
  };

  const handleCloseShift = () => {
    const counted = Number(finalCashInput);
    if (isNaN(counted) || counted < 0) {
      showPopup({
        title: 'Monto inválido',
        message: 'Ingresá el total de efectivo contado en gaveta.',
        type: 'warning',
      });
      return;
    }

    const expected = shiftData?.summary?.expectedCash || 0;
    const diff = counted - expected;
    let diffMsg = 'Caja balanceada con éxito.';
    if (diff > 0) diffMsg = `Sobrante de caja: +${formatPrice(diff)}.`;
    else if (diff < 0) diffMsg = `Faltante de caja: -${formatPrice(Math.abs(diff))}.`;

    showConfirm({
      title: 'Confirmar Arqueo y Cierre',
      message: `¿Estás seguro de cerrar el turno de caja?\n\n• Esperado: ${formatPrice(expected)}\n• Contado: ${formatPrice(counted)}\n• ${diffMsg}`,
      confirmText: 'Cerrar Caja',
      cancelText: 'Revisar',
      isDestructive: diff !== 0,
      onConfirm: async () => {
        setIsClosing(true);
        try {
          const shiftId = shiftData.shift.id;
          await apiClient.post(`/shifts/${shiftId}/close`, {
            finalCashCounted: counted,
            notes: closeNotes.trim() || undefined,
          });

          showPopup({
            title: 'Turno Cerrado',
            message: `El turno #${shiftId} ha sido cerrado correctamente.\n${diffMsg}`,
            type: 'success',
          });

          setCloseNotes('');
          setFinalCashInput('');
          fetchShift();
        } catch (err: any) {
          const msg = err.response?.data?.error?.message || 'No se pudo cerrar el turno.';
          showPopup({
            title: 'Error al cerrar turno',
            message: msg,
            type: 'error',
          });
        } finally {
          setIsClosing(false);
        }
      },
    });
  };

  const hasOpenShift = shiftData?.hasOpenShift;
  const shift = shiftData?.shift;
  const summary = shiftData?.summary;

  const counted = Number(finalCashInput) || 0;
  const expected = summary?.expectedCash || 0;
  const difference = counted - expected;

  return (
    <Screen style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Turnos y Caja</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {hasOpenShift ? '🟢 Turno en Curso' : '🔴 Caja Cerrada'} • Sucursal #{branchId}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.surfaceSecondary }]}
          onPress={() => {
            setIsRefreshing(true);
            fetchShift();
          }}
          accessibilityLabel="Refrescar datos del turno"
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => {
            setIsRefreshing(true);
            fetchShift();
          }} />
        }
      >
        {!hasOpenShift ? (
          /* PANTALLA DE APERTURA */
          <Card style={styles.openCard}>
            <View style={styles.openIconContainer}>
              <Ionicons name="lock-closed" size={32} color="#D97706" />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Abrir Turno de Caja</Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              Iniciá el turno ingresando el fondo inicial en efectivo (cambio chico) que hay en la gaveta.
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Fondo Inicial en Efectivo ($)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={initialCashInput}
                onChangeText={setInitialCashInput}
                keyboardType="numeric"
                placeholder="Ej. 15000"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Observaciones de Apertura</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={openNotes}
                onChangeText={setOpenNotes}
                placeholder="Ej. Cambio inicial provisto por encargado..."
                placeholderTextColor={colors.placeholder}
                multiline
              />
            </View>

            <Button
              title="Abrir Turno de Caja"
              onPress={handleOpenShift}
              isLoading={isOpening}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          /* PANTALLA DE TURNO EN CURSO Y ARQUEO */
          <>
            {/* Resumen del Turno */}
            <Card style={styles.shiftCard}>
              <View style={styles.shiftCardHeader}>
                <View>
                  <Text style={[styles.shiftNumber, { color: colors.text }]}>Turno #{shift.id}</Text>
                  <Text style={[styles.shiftMeta, { color: colors.textSecondary }]}>
                    Abierto por {shift.openedBy} • {formatDateTime(shift.openedAt)}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>ABIERTO</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Grid de Medios de Pago */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Ventas del Turno en Tiempo Real</Text>
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="cash-outline" size={20} color="#10B981" />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Efectivo</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatPrice(summary.cashSales)}</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="card-outline" size={20} color="#3B82F6" />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tarjeta</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatPrice(summary.cardSales)}</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="qr-code-outline" size={20} color="#8B5CF6" />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>QR / MP</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatPrice(summary.qrSales)}</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="swap-horizontal-outline" size={20} color="#F59E0B" />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Transferencia</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatPrice(summary.transferSales)}</Text>
                </View>
              </View>

              {/* Balance Efectivo en Gaveta */}
              <View style={[styles.cashBalanceBox, isDark && { backgroundColor: '#2E2211', borderColor: '#4A371B' }]}>
                <View style={styles.cashBalanceRow}>
                  <Text style={[styles.cashBalanceLabel, isDark && { color: '#FCD34D' }]}>Fondo Inicial:</Text>
                  <Text style={[styles.cashBalanceSubvalue, isDark && { color: '#FCD34D' }]}>{formatPrice(summary.initialCash)}</Text>
                </View>
                <View style={styles.cashBalanceRow}>
                  <Text style={[styles.cashBalanceLabel, isDark && { color: '#FCD34D' }]}>+ Cobros en Efectivo:</Text>
                  <Text style={[styles.cashBalanceSubvalue, isDark && { color: '#FCD34D' }]}>{formatPrice(summary.cashSales)}</Text>
                </View>
                <View style={[styles.cashBalanceRow, styles.cashBalanceTotalRow, isDark && { borderTopColor: '#4A371B' }]}>
                  <Text style={[styles.cashBalanceTotalLabel, isDark && { color: '#FBBF24' }]}>Efectivo Esperado en Gaveta:</Text>
                  <Text style={[styles.cashBalanceTotalValue, isDark && { color: '#FBBF24' }]}>{formatPrice(summary.expectedCash)}</Text>
                </View>
              </View>
            </Card>

            {/* Arqueo y Cierre de Caja */}
            <Card style={styles.closeCard}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Arqueo y Cierre de Turno</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Contá los billetes en la caja y registrá el monto real antes de cerrar.
              </Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Efectivo Contado en Gaveta ($)</Text>
                <TextInput
                  style={[styles.input, styles.cashCountedInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.primary }]}
                  value={finalCashInput}
                  onChangeText={setFinalCashInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              {/* Diferencia en vivo */}
              <View
                style={[
                  styles.diffBox,
                  difference === 0
                    ? styles.diffBalanced
                    : difference > 0
                    ? styles.diffSurplus
                    : styles.diffDeficit,
                  isDark && {
                    backgroundColor:
                      difference === 0
                        ? '#064E3B'
                        : difference > 0
                        ? '#1E3A8A'
                        : '#7F1D1D',
                    borderColor:
                      difference === 0
                        ? '#059669'
                        : difference > 0
                        ? '#2563EB'
                        : '#DC2626',
                  },
                ]}
              >
                <Ionicons
                  name={
                    difference === 0
                      ? 'checkmark-circle'
                      : difference > 0
                      ? 'trending-up'
                      : 'alert-circle'
                  }
                  size={20}
                  color={
                    difference === 0 ? '#10B981' : difference > 0 ? '#60A5FA' : '#F87171'
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.diffTitle,
                      {
                        color:
                          difference === 0
                            ? (isDark ? '#6EE7B7' : '#065F46')
                            : difference > 0
                            ? (isDark ? '#93C5FD' : '#1E40AF')
                            : (isDark ? '#FCA5A5' : '#991B1B'),
                      },
                    ]}
                  >
                    {difference === 0
                      ? 'Caja perfectamente balanceada'
                      : difference > 0
                      ? `Sobrante: +${formatPrice(difference)}`
                      : `Faltante: -${formatPrice(Math.abs(difference))}`}
                  </Text>
                  <Text style={[styles.diffSubtitle, { color: colors.textSecondary }]}>
                    Esperado {formatPrice(expected)} vs. Contado {formatPrice(counted)}
                  </Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Observaciones de Cierre</Text>
                <TextInput
                  style={[styles.input, styles.textarea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={closeNotes}
                  onChangeText={setCloseNotes}
                  placeholder="Explicación en caso de sobrante/faltante o retiros..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                />
              </View>

              <Button
                title="Realizar Arqueo y Cerrar Caja"
                variant="danger"
                onPress={handleCloseShift}
                isLoading={isClosing}
                style={{ marginTop: 8 }}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEBE9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3E2723',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EFEA',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  openCard: {
    padding: 20,
    alignItems: 'center',
  },
  openIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  field: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  textarea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  shiftCard: {
    padding: 16,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  shiftMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  cashBalanceBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cashBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cashBalanceLabel: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  cashBalanceSubvalue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  cashBalanceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
    paddingTop: 8,
    marginTop: 4,
  },
  cashBalanceTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
  },
  cashBalanceTotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#78350F',
  },
  closeCard: {
    padding: 16,
  },
  cashCountedInput: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#6F4E37',
    borderWidth: 1.5,
  },
  diffBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 14,
  },
  diffBalanced: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  diffSurplus: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  diffDeficit: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  diffTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
});
