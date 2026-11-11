import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatPrice, getReportDateBounds, REPORT_DATE_RANGE_OPTIONS, ReportDateRange } from '../../src/utils/format';
import { useTheme } from '../../src/context/ThemeContext';
import {
  isValidEmail,
  sanitizeDecimal,
  sanitizeName,
  sanitizePhone,
  validateFullName,
  validatePhone,
} from '../../src/utils/validation';

export default function ManagerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const branchId = user?.branchId || 1;

  const [activeTab, setActiveTab] = useState<'MENU' | 'STAFF' | 'ORDERS' | 'REPORTS'>('MENU');

  // Menú
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editingPriceItem, setEditingPriceItem] = useState<any | null>(null);
  const [newPrice, setNewPrice] = useState('');

  // Personal
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isStaffModalVisible, setIsStaffModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'CASHIER' | 'BARISTA'>('CASHIER');
  const [staffIsActive, setStaffIsActive] = useState(true);

  // Pedidos para cancelar
  const [orders, setOrders] = useState<any[]>([]);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Reportes
  const [reportRange, setReportRange] = useState<ReportDateRange>('30days');
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await apiClient.post(`/branches/${branchId}/menu`);
      const all: any[] = [];
      res.data.menu.forEach((cat: any) => {
        cat.items.forEach((item: any) => all.push(item));
      });
      setMenuItems(all);
    } catch (err) {
      console.error('[Manager] Error cargando menú:', err);
    }
  }, [branchId]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiClient.post('/users', { isList: true });
      setStaffList(res.data.data);
    } catch (err) {
      console.error('[Manager] Error cargando personal:', err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.post('/orders', { branchId, limit: 30, isList: true });
      setOrders(res.data.data);
    } catch (err) {
      console.error('[Manager] Error cargando pedidos:', err);
    }
  }, [branchId]);

  const fetchReports = useCallback(async () => {
    try {
      const bounds = getReportDateBounds(reportRange);
      const salesRes = await apiClient.post('/reports/sales', { branchId, ...bounds });
      setSalesReport(salesRes.data);

      const topRes = await apiClient.post('/reports/top-products', { branchId, ...bounds });
      setTopProducts(topRes.data.data);
    } catch (err) {
      console.error('[Manager] Error cargando reportes:', err);
    }
  }, [branchId, reportRange]);

  useEffect(() => {
    if (activeTab === 'MENU') fetchMenu();
    if (activeTab === 'STAFF') fetchStaff();
    if (activeTab === 'ORDERS') fetchOrders();
    if (activeTab === 'REPORTS') fetchReports();
  }, [activeTab, fetchMenu, fetchStaff, fetchOrders, fetchReports]);

  // ABML MENÚ: Actualizar precio
  const handleSavePrice = async () => {
    if (!editingPriceItem) return;
    const priceNum = parseFloat(newPrice.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      showPopup({
        title: 'Precio inválido',
        message: 'Ingresá un monto mayor a cero.',
        type: 'warning',
      });
      return;
    }

    showConfirm({
      title: 'Confirmar actualización de precio',
      message: `¿Estás seguro de que deseás cambiar el precio de "${editingPriceItem.product_name}" a $${priceNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}?`,
      confirmText: 'Actualizar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await apiClient.put(`/branches/${branchId}/menu/${editingPriceItem.product_id}`, {
            price: priceNum,
          });
          setEditingPriceItem(null);
          fetchMenu();
          showPopup({
            title: 'Éxito',
            message: 'Precio actualizado en la sucursal.',
            type: 'success',
          });
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.response?.data?.error?.message || err.message || 'No se pudo actualizar el precio',
            type: 'error',
          });
        }
      },
    });
  };

  const openCreateStaffModal = () => {
    setEditingStaff(null);
    setStaffFullName('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffPassword('');
    setStaffRole('CASHIER');
    setStaffIsActive(true);
    setIsStaffModalVisible(true);
  };

  const openEditStaffModal = (emp: any) => {
    setEditingStaff(emp);
    setStaffFullName(emp.full_name || '');
    setStaffEmail(emp.email || '');
    setStaffPhone(emp.phone || '');
    setStaffPassword('');
    setStaffRole(emp.role === 'BARISTA' ? 'BARISTA' : 'CASHIER');
    setStaffIsActive(Boolean(emp.is_active));
    setIsStaffModalVisible(true);
  };

  // ABML PERSONAL: Alta y modificación
  const handleSaveStaff = async () => {
    const nameErr = validateFullName(staffFullName, true);
    if (nameErr) {
      showPopup({ title: 'Nombre inválido', message: nameErr, type: 'warning' });
      return;
    }
    if (!isValidEmail(staffEmail)) {
      showPopup({
        title: 'Correo inválido',
        message: 'Ingresá un correo electrónico válido para el empleado.',
        type: 'warning',
      });
      return;
    }
    const phoneErr = validatePhone(staffPhone, false);
    if (phoneErr) {
      showPopup({ title: 'Teléfono inválido', message: phoneErr, type: 'warning' });
      return;
    }

    const isEditing = Boolean(editingStaff);
    if (!isEditing) {
      if (!staffPassword || staffPassword.length < 8 || /\s/.test(staffPassword)) {
        showPopup({
          title: 'Contraseña inválida',
          message: 'La contraseña debe tener al menos 8 caracteres y no contener espacios.',
          type: 'warning',
        });
        return;
      }
    } else if (staffPassword.length > 0 && (staffPassword.length < 8 || /\s/.test(staffPassword))) {
      showPopup({
        title: 'Contraseña inválida',
        message: 'Si ingresás una nueva contraseña, debe tener al menos 8 caracteres y no contener espacios.',
        type: 'warning',
      });
      return;
    }

    const cleanName = staffFullName.trim().replace(/\s+/g, ' ');
    const roleLabel = staffRole === 'CASHIER' ? 'Cajero' : 'Barista';

    showConfirm({
      title: isEditing ? 'Confirmar cambios de empleado' : 'Confirmar alta de personal',
      message: isEditing
        ? `¿Guardás los cambios de "${cleanName}" (${roleLabel})?`
        : `¿Estás seguro de que deseás crear el usuario para "${cleanName}" con el rol de ${roleLabel}?`,
      confirmText: isEditing ? 'Guardar Cambios' : 'Crear Empleado',
      cancelText: 'Revisar',
      onConfirm: async () => {
        try {
          if (isEditing && editingStaff) {
            const payload: Record<string, any> = {
              fullName: cleanName,
              email: staffEmail.trim().toLowerCase(),
              phone: staffPhone.trim() || null,
              role: staffRole,
              isActive: staffIsActive,
            };
            if (staffPassword) {
              payload.password = staffPassword;
            }
            await apiClient.put(`/users/${editingStaff.id}`, payload);
            showPopup({
              title: 'Empleado actualizado',
              message: `Se guardaron los datos de "${cleanName}".`,
              type: 'success',
            });
          } else {
            await apiClient.post('/users', {
              fullName: cleanName,
              email: staffEmail.trim().toLowerCase(),
              phone: staffPhone.trim() || undefined,
              password: staffPassword,
              role: staffRole,
              branchId,
            });
            showPopup({
              title: 'Éxito',
              message: `${roleLabel} dado de alta exitosamente.`,
              type: 'success',
            });
          }

          setIsStaffModalVisible(false);
          setEditingStaff(null);
          setStaffFullName('');
          setStaffEmail('');
          setStaffPhone('');
          setStaffPassword('');
          fetchStaff();
        } catch (err: any) {
          showPopup({
            title: isEditing ? 'Error al actualizar empleado' : 'Error al crear usuario',
            message: err.response?.data?.error?.message || err.message || 'No se pudieron guardar los datos',
            type: 'error',
          });
        }
      },
    });
  };

  // ABML PERSONAL: Baja lógica
  const handleDeactivateStaff = (staffId: number, name: string) => {
    showConfirm({
      title: 'Confirmar baja de empleado',
      message: `¿Estás seguro de que deseás desactivar al empleado "${name}"?`,
      confirmText: 'Dar de baja',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/users/${staffId}`);
          showPopup({
            title: 'Empleado desactivado',
            message: `El empleado "${name}" fue desactivado.`,
            type: 'info',
          });
          fetchStaff();
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.message || 'No se pudo desactivar el empleado',
            type: 'error',
          });
        }
      },
    });
  };

  // CANCELACIÓN DE PEDIDOS
  const handleConfirmCancelOrder = async () => {
    if (!cancellingOrderId) return;
    if (!cancelReason.trim()) {
      showPopup({
        title: 'Motivo requerido',
        message: 'Debés indicar un motivo de cancelación obligatorio.',
        type: 'warning',
      });
      return;
    }

    try {
      await apiClient.post(`/orders/${cancellingOrderId}/status`, {
        status: 'CANCELLED',
        cancelReason: cancelReason.trim(),
      });

      showPopup({
        title: 'Pedido Cancelado',
        message: `El pedido #${cancellingOrderId} fue cancelado exitosamente.`,
        type: 'info',
      });
      setCancellingOrderId(null);
      setCancelReason('');
      fetchOrders();
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo cancelar el pedido',
        type: 'error',
      });
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Confirmás salir de la cuenta de Encargado?',
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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Gestión de Sucursal #{branchId}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Panel de control exclusivo de Encargado</Text>
          </View>
          <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
            <Text style={styles.headerLogoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector de módulos */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'MENU' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('MENU')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'MENU' && [styles.tabBtnTextActive, { color: colors.primary }]]}>Menú</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'STAFF' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('STAFF')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'STAFF' && [styles.tabBtnTextActive, { color: colors.primary }]]}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ORDERS' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('ORDERS')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'ORDERS' && [styles.tabBtnTextActive, { color: colors.primary }]]}>Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'REPORTS' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('REPORTS')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'REPORTS' && [styles.tabBtnTextActive, { color: colors.primary }]]}>Reportes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* TAB 1: MENÚ */}
        {activeTab === 'MENU' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Precios y Disponibilidad del Local</Text>
            {menuItems.map((item) => (
              <Card key={item.branch_product_id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemPrice, { color: colors.primary }]}>Precio local: {formatPrice(item.price)}</Text>
                  <Text style={[styles.itemStatus, item.is_available ? styles.statusOk : styles.statusPaused]}>
                    {item.is_available ? 'Disponible' : `Pausado: ${item.paused_reason || 'Sin insumos'}`}
                  </Text>
                </View>
                <Button
                  title="Editar Precio"
                  size="small"
                  variant="outline"
                  onPress={() => {
                    setEditingPriceItem(item);
                    setNewPrice(String(item.price));
                  }}
                />
              </Card>
            ))}
          </View>
        )}

        {/* TAB 2: PERSONAL */}
        {activeTab === 'STAFF' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Equipo de la Sucursal</Text>
              <Button
                title="+ Alta Empleado"
                size="small"
                onPress={openCreateStaffModal}
              />
            </View>

            {staffList.map((emp) => (
              <Card key={emp.id} style={styles.staffCard}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.staffName, { color: colors.text }]}>{emp.full_name}</Text>
                  <Text style={[styles.staffRole, { color: colors.textSecondary }]}>
                    {emp.role === 'CASHIER' ? 'Cajero' : emp.role === 'BARISTA' ? 'Barista' : emp.role} • {emp.email}
                  </Text>
                  {!!emp.phone && (
                    <Text style={[styles.staffRole, { color: colors.textMuted }]}>Tel: {emp.phone}</Text>
                  )}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: emp.is_active ? '#2E7D32' : '#C62828' }}>
                    {emp.is_active ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>

                <View style={styles.staffActionsRow}>
                  <TouchableOpacity
                    style={[styles.deactivateBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => openEditStaffModal(emp)}
                    accessibilityLabel={`Editar a ${emp.full_name}`}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>

                  {emp.is_active && (
                    <TouchableOpacity
                      style={[styles.deactivateBtn, { backgroundColor: isDark ? 'rgba(198,40,40,0.16)' : '#FFEBEE' }]}
                      onPress={() => handleDeactivateStaff(emp.id, emp.full_name)}
                      accessibilityLabel={`Desactivar a ${emp.full_name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color="#C62828" />
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 3: PEDIDOS Y CANCELACIÓN */}
        {activeTab === 'ORDERS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cancelación y Gestión de Pedidos</Text>
            {orders.map((o) => (
              <Card key={o.id} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <Text style={[styles.orderNum, { color: colors.primary }]}>Pedido #{o.order_number}</Text>
                  <Text style={styles.orderStatusBadge}>{o.status}</Text>
                </View>

                <Text style={[styles.orderTotal, { color: colors.text }]}>Total: {formatPrice(o.total_amount)}</Text>
                <Text style={[styles.orderType, { color: colors.textSecondary }]}>Tipo: {o.order_type} • Pago: {o.payment_status}</Text>

                {['PENDING', 'PREPARING', 'READY'].includes(o.status) && (
                  <Button
                    title="Cancelar Pedido con Motivo"
                    size="small"
                    variant="danger"
                    onPress={() => setCancellingOrderId(o.id)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            ))}
          </View>
        )}

        {/* TAB 4: REPORTES */}
        {activeTab === 'REPORTS' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reporte de Ventas de la Sucursal</Text>

            <View style={styles.filterRow}>
              {REPORT_DATE_RANGE_OPTIONS.map((option) => {
                const isActive = reportRange === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterPill,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setReportRange(option.key)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: colors.textSecondary },
                        isActive && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {salesReport && (
              <>
                <View style={styles.kpiGrid}>
                  <Card style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Facturación Total</Text>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.totalRevenue)}</Text>
                  </Card>
                  <Card style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pedidos Totales</Text>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>{salesReport.summary.totalOrders}</Text>
                  </Card>
                  <Card style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Ticket Promedio</Text>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.averageTicket)}</Text>
                  </Card>
                  <Card style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>IVA Recaudado (21%)</Text>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.totalTax)}</Text>
                  </Card>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 18, color: colors.text }]}>Productos Más Vendidos</Text>
                {topProducts.length === 0 ? (
                  <Card style={{ padding: 16 }}>
                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>
                      No hay ventas registradas para este período.
                    </Text>
                  </Card>
                ) : (
                  topProducts.map((p, idx) => (
                    <Card key={idx} style={styles.topProductCard}>
                      <Text style={[styles.topRank, { color: colors.primary }]}>#{idx + 1}</Text>
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={[styles.topName, { color: colors.text }]}>{p.product_name}</Text>
                        <Text style={[styles.topQty, { color: colors.textSecondary }]}>{p.total_quantity} unidades vendidas</Text>
                      </View>
                      <Text style={[styles.topRevenue, { color: colors.primary }]}>{formatPrice(p.total_revenue)}</Text>
                    </Card>
                  ))
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Edición de Precio */}
      <Modal visible={!!editingPriceItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Precio Local</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{editingPriceItem?.name}</Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              keyboardType="numeric"
              maxLength={12}
              placeholder="Nuevo precio con IVA"
              placeholderTextColor={colors.placeholder}
              value={newPrice}
              onChangeText={(txt) => setNewPrice(sanitizeDecimal(txt))}
            />

            <Button title="Guardar Precio" onPress={handleSavePrice} />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setEditingPriceItem(null)}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Alta / Edición de Personal */}
      <Modal
        visible={isStaffModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsStaffModalVisible(false);
          setEditingStaff(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingStaff ? 'Editar Empleado' : 'Nuevo Empleado en Sucursal'}
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Nombre y Apellido"
              placeholderTextColor={colors.placeholder}
              maxLength={80}
              value={staffFullName}
              onChangeText={(txt) => setStaffFullName(sanitizeName(txt))}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Email institucional"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={120}
              value={staffEmail}
              onChangeText={(txt) => setStaffEmail(txt.replace(/\s/g, ''))}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Teléfono (opcional)"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
              maxLength={20}
              value={staffPhone}
              onChangeText={(txt) => setStaffPhone(sanitizePhone(txt))}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder={editingStaff ? 'Nueva contraseña (opcional, mín. 8)' : 'Contraseña inicial (mínimo 8)'}
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={staffPassword}
              onChangeText={setStaffPassword}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
              <TouchableOpacity
                style={[
                  styles.roleSelectBtn,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  staffRole === 'CASHIER' && [styles.roleSelectBtnActive, { borderColor: colors.primary }],
                ]}
                onPress={() => setStaffRole('CASHIER')}
              >
                <Text
                  style={[
                    styles.roleSelectText,
                    { color: colors.textSecondary },
                    staffRole === 'CASHIER' && [styles.roleSelectTextActive, { color: colors.primary }],
                  ]}
                >
                  Cajero
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleSelectBtn,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  staffRole === 'BARISTA' && [styles.roleSelectBtnActive, { borderColor: colors.primary }],
                ]}
                onPress={() => setStaffRole('BARISTA')}
              >
                <Text
                  style={[
                    styles.roleSelectText,
                    { color: colors.textSecondary },
                    staffRole === 'BARISTA' && [styles.roleSelectTextActive, { color: colors.primary }],
                  ]}
                >
                  Barista
                </Text>
              </TouchableOpacity>
            </View>

            {editingStaff && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    staffIsActive && { borderColor: '#2E7D32', backgroundColor: isDark ? 'rgba(46,125,50,0.18)' : '#E8F5E9' },
                  ]}
                  onPress={() => setStaffIsActive(true)}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      { color: colors.textSecondary },
                      staffIsActive && { color: isDark ? '#81C784' : '#2E7D32', fontWeight: '800' },
                    ]}
                  >
                    Activo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleSelectBtn,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    !staffIsActive && { borderColor: '#C62828', backgroundColor: isDark ? 'rgba(198,40,40,0.18)' : '#FFEBEE' },
                  ]}
                  onPress={() => setStaffIsActive(false)}
                >
                  <Text
                    style={[
                      styles.roleSelectText,
                      { color: colors.textSecondary },
                      !staffIsActive && { color: isDark ? '#EF9A9A' : '#C62828', fontWeight: '800' },
                    ]}
                  >
                    Inactivo
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Button title={editingStaff ? 'Guardar Cambios' : 'Crear Empleado'} onPress={handleSaveStaff} />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setIsStaffModalVisible(false);
                setEditingStaff(null);
              }}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Cancelación de Pedido */}
      <Modal visible={!!cancellingOrderId} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Cancelar Pedido #{cancellingOrderId}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Como encargado debés registrar el motivo de cancelación obligatorio:
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Ej. Error de carga del cliente, falta de insumo crítico..."
              placeholderTextColor={colors.placeholder}
              value={cancelReason}
              onChangeText={setCancelReason}
            />

            <Button title="Confirmar Cancelación" variant="danger" onPress={handleConfirmCancelOrder} />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setCancellingOrderId(null)}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Volver atrás</Text>
            </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 4,
  },
  headerLogoutText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '700',
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEBE9',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#6F4E37',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#777',
  },
  tabBtnTextActive: {
    color: '#6F4E37',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1810',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1810',
  },
  itemPrice: {
    fontSize: 13,
    color: '#6F4E37',
    fontWeight: '700',
    marginTop: 2,
  },
  itemStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  statusOk: {
    color: '#2E7D32',
  },
  statusPaused: {
    color: '#C62828',
  },
  staffCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1810',
  },
  staffRole: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  deactivateBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  orderCard: {
    padding: 12,
    marginBottom: 10,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6F4E37',
  },
  orderStatusBadge: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  orderType: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    flexBasis: '48%',
    padding: 12,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#777',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6F4E37',
    marginTop: 4,
  },
  topProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  topRank: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6F4E37',
    width: 30,
  },
  topName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222',
  },
  topQty: {
    fontSize: 11,
    color: '#666',
  },
  topRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2A1810',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2A1810',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginVertical: 6,
  },
  modalInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginVertical: 10,
  },
  modalCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: 10,
    marginTop: 6,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  roleSelectBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectBtnActive: {
    borderColor: '#6F4E37',
    backgroundColor: '#F7F2EE',
  },
  roleSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  roleSelectTextActive: {
    color: '#6F4E37',
    fontWeight: '800',
  },
  staffActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
