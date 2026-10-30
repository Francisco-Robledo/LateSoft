import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { usePopup } from '../../src/context/PopupContext';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { apiClient } from '../../src/api/client';

const ROLES = [
  { value: '', label: 'Todos' },
  { value: 'MANAGER', label: 'Encargados' },
  { value: 'CASHIER', label: 'Cajeros' },
  { value: 'BARISTA', label: 'Baristas' },
  { value: 'CUSTOMER', label: 'Clientes' },
  { value: 'ADMIN', label: 'Admins' },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#7B1FA2',
  MANAGER: '#1565C0',
  CASHIER: '#00897B',
  BARISTA: '#EF6C00',
  CUSTOMER: '#6F4E37',
};

const STAFF_ROLES = ['MANAGER', 'CASHIER', 'BARISTA'];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Encargado',
  CASHIER: 'Cajero',
  BARISTA: 'Barista',
  CUSTOMER: 'Cliente',
};

export default function AdminManagersScreen() {
  const { colors, isDark } = useTheme();
  const { showPopup, showConfirm } = usePopup();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal Alta (Create)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [newRole, setNewRole] = useState('MANAGER');
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal Edición (Update)
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('MANAGER');
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadUsers = useCallback(async (requestedPage = 1, append = false) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/users', {
        page: requestedPage,
        limit: 50,
        isList: true,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(branchFilter ? { branchId: branchFilter } : {}),
      });
      setUsers((current) => (append ? [...current, ...res.data.data] : res.data.data));
      setPage(res.data.meta.page);
      setTotalPages(res.data.meta.totalPages);
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo cargar el directorio de usuarios.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, branchFilter, showPopup]);

  useEffect(() => {
    apiClient
      .post('/branches', { activeOnly: false })
      .then((res) => setBranches(res.data.data))
      .catch((err) =>
        showPopup({
          title: 'Error',
          message: err.message || 'No se pudieron cargar las sucursales.',
          type: 'error',
        })
      );
  }, [showPopup]);

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(1), 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const branchName = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  );

  const needsBranch = STAFF_ROLES.includes(newRole);
  const editNeedsBranch = STAFF_ROLES.includes(editRole);

  // 1. CREATE
  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 8 || (needsBranch && !selectedBranchId)) {
      showPopup({
        title: 'Revisá los datos',
        message: 'Completá nombre, correo, contraseña (mínimo 8 caracteres) y sucursal para el personal.',
        type: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/users', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: newRole,
        ...(needsBranch ? { branchId: selectedBranchId } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setIsCreateModalVisible(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setNewRole('MANAGER');
      showPopup({
        title: 'Usuario creado',
        message: 'La cuenta se creó correctamente.',
        type: 'success',
      });
      loadUsers(1);
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.message || 'No se pudo crear el usuario.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // 2. UPDATE (Abrir modal con datos precargados)
  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditFullName(user.full_name || '');
    setEditPhone(user.phone || '');
    setEditRole(user.role || 'CUSTOMER');
    setEditBranchId(user.branch_id || null);
    setEditIsActive(Boolean(user.is_active));
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    if (!editFullName.trim()) {
      showPopup({
        title: 'Nombre requerido',
        message: 'El nombre completo no puede estar vacío.',
        type: 'warning',
      });
      return;
    }
    if (editNeedsBranch && !editBranchId) {
      showPopup({
        title: 'Sucursal requerida',
        message: 'El personal de sucursal debe tener asignada una sucursal válida.',
        type: 'warning',
      });
      return;
    }

    setUpdating(true);
    try {
      await apiClient.post(`/users/${editingUser.id}/update`, {
        fullName: editFullName.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
        branchId: editNeedsBranch ? editBranchId : null,
        isActive: editIsActive,
      });

      showPopup({
        title: 'Usuario actualizado',
        message: `Los datos de "${editFullName}" fueron guardados correctamente.`,
        type: 'success',
      });
      setEditingUser(null);
      loadUsers(page);
    } catch (err: any) {
      showPopup({
        title: 'Error al actualizar',
        message: err.message || 'No se pudieron guardar los cambios del usuario.',
        type: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  // 3. DELETE (Dar de baja o borrar permanentemente)
  const handleDeleteUser = (item: any) => {
    if (item.id === currentUser?.id) {
      showPopup({
        title: 'Operación no permitida',
        message: 'No podés eliminar tu propia cuenta de usuario en sesión.',
        type: 'warning',
      });
      return;
    }

    showConfirm({
      title: 'Eliminar usuario',
      message: `¿Confirmás eliminar la cuenta de "${item.full_name}" (${item.email})?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiClient.post(`/users/${item.id}/delete`);
          showPopup({
            title: 'Usuario eliminado',
            message: `La cuenta de ${item.full_name} fue dada de baja correctamente.`,
            type: 'success',
          });
          loadUsers(page);
        } catch (err: any) {
          showPopup({
            title: 'Error al eliminar',
            message: err.message || 'No se pudo eliminar el usuario.',
            type: 'error',
          });
        }
      },
    });
  };

  // 4. TOGGLE ACTIVE (Acceso directo a activar/desactivar)
  const toggleUserStatus = (item: any) => {
    const activate = !item.is_active;
    showConfirm({
      title: activate ? 'Activar cuenta' : 'Desactivar cuenta',
      message: `¿${activate ? 'Activar' : 'Desactivar'} la cuenta de ${item.full_name}?`,
      confirmText: activate ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      isDestructive: !activate,
      onConfirm: async () => {
        try {
          await apiClient.post(`/users/${item.id}/update`, { isActive: activate });
          showPopup({
            title: activate ? 'Cuenta activada' : 'Cuenta desactivada',
            message: `${item.full_name} fue ${activate ? 'activado' : 'desactivado'}.`,
            type: 'success',
          });
          loadUsers(page);
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.message || 'No se pudo actualizar el estado de la cuenta.',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen style={styles.screen}>
      {/* Cabecera */}
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Directorio de usuarios</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Buscar y administrar todas las cuentas (CRUD)
          </Text>
        </View>
        <Button title="+ Alta" size="small" onPress={() => setIsCreateModalVisible(true)} />
      </View>

      {/* Buscador */}
      <TextInput
        style={[styles.search, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
        placeholder="Buscar por nombre o correo"
        placeholderTextColor={colors.placeholder}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {/* FILTROS POR ROL (SIN SCROLL HORIZONTAL - FLEX WRAP) */}
      <View style={styles.filterWrap}>
        {ROLES.map((role) => {
          const isSelected = roleFilter === role.value;
          return (
            <TouchableOpacity
              key={role.value || 'all'}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setRoleFilter(role.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  isSelected && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {role.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FILTROS POR SUCURSAL (SIN SCROLL HORIZONTAL - FLEX WRAP) */}
      <View style={[styles.filterWrap, { marginTop: 2 }]}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.surface, borderColor: colors.border },
            branchFilter === null && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => setBranchFilter(null)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              branchFilter === null && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
            ]}
          >
            Todas las sucursales
          </Text>
        </TouchableOpacity>
        {branches.map((branch) => {
          const isSelected = branchFilter === branch.id;
          return (
            <TouchableOpacity
              key={branch.id}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setBranchFilter(branch.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  isSelected && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {branch.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Listado de Usuarios */}
      {loading && users.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No se encontraron cuentas con los filtros seleccionados.
            </Text>
          }
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
                  <View style={[styles.badge, { backgroundColor: ROLE_COLORS[item.role] || '#6F4E37' }]}>
                    <Text style={styles.badgeText}>{ROLE_LABELS[item.role] || item.role}</Text>
                  </View>
                </View>
                <Text style={[styles.details, { color: colors.textSecondary }]}>{item.email}</Text>
                <Text style={[styles.details, { color: colors.textSecondary }]}>
                  {item.phone ? `${item.phone} • ` : ''}
                  {item.branch_id ? branchName.get(item.branch_id) || `Sucursal #${item.branch_id}` : 'Sin sucursal'}
                </Text>
                {item.role === 'CUSTOMER' && item.loyalty_points !== undefined && (
                  <Text style={[styles.points, { color: colors.primary }]}>
                    {item.loyalty_points} puntos acumulados
                  </Text>
                )}
                <Text style={[styles.status, item.is_active ? styles.active : styles.inactive]}>
                  {item.is_active ? 'Activo' : 'Desactivado'}
                </Text>
              </View>

              {/* Botonera de acciones CRUD en cada tarjeta */}
              <View style={styles.actionsColumn}>
                {/* 1. Botón Editar (Update) */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={() => openEditModal(item)}
                  accessibilityLabel="Editar usuario"
                >
                  <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                </TouchableOpacity>

                {/* 2. Botón Activar/Desactivar */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={() => toggleUserStatus(item)}
                  accessibilityLabel={item.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                >
                  <Ionicons
                    name={item.is_active ? 'person-remove-outline' : 'person-add-outline'}
                    size={17}
                    color={item.is_active ? '#EF4444' : '#16A34A'}
                  />
                </TouchableOpacity>

                {/* 3. Botón Eliminar (Delete) */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA' }]}
                  onPress={() => handleDeleteUser(item)}
                  accessibilityLabel="Eliminar usuario"
                >
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      )}

      {/* MODAL 1: ALTA DE USUARIO (CREATE) */}
      <Modal visible={isCreateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo Usuario</Text>

              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Nombre completo"
                placeholderTextColor={colors.placeholder}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Correo electrónico"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Contraseña (mínimo 8 caracteres)"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Teléfono (opcional)"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={[styles.sectionLabel, { color: colors.text }]}>Rol asignado</Text>
              <View style={styles.roleGrid}>
                {ROLES.filter((role) => role.value).map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      newRole === role.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setNewRole(role.value)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        { color: colors.text },
                        newRole === role.value && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {needsBranch && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Sucursal asignada</Text>
                  {branches.map((branch) => (
                    <TouchableOpacity
                      key={branch.id}
                      style={[
                        styles.branchOption,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                        selectedBranchId === branch.id && {
                          borderColor: colors.primary,
                          backgroundColor: isDark ? 'rgba(212, 163, 115, 0.15)' : '#F7F2EE',
                        },
                      ]}
                      onPress={() => setSelectedBranchId(branch.id)}
                    >
                      <Text style={[styles.filterText, { color: colors.text }]}>{branch.name}</Text>
                      {selectedBranchId === branch.id && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <Button title={saving ? 'Creando…' : 'Crear usuario'} onPress={handleCreate} disabled={saving} />
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIsCreateModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL 2: EDICIÓN DE USUARIO (UPDATE) */}
      <Modal visible={!!editingUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Editar Usuario #{editingUser?.id}
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Correo (no modificable):</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.textSecondary }]}
                value={editingUser?.email}
                editable={false}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nombre Completo:</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Nombre completo"
                placeholderTextColor={colors.placeholder}
                value={editFullName}
                onChangeText={setEditFullName}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Teléfono:</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Teléfono"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
              />

              <Text style={[styles.sectionLabel, { color: colors.text }]}>Rol:</Text>
              <View style={styles.roleGrid}>
                {ROLES.filter((role) => role.value).map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      editRole === role.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setEditRole(role.value)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        { color: colors.text },
                        editRole === role.value && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editNeedsBranch && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Sucursal:</Text>
                  {branches.map((branch) => (
                    <TouchableOpacity
                      key={branch.id}
                      style={[
                        styles.branchOption,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                        editBranchId === branch.id && {
                          borderColor: colors.primary,
                          backgroundColor: isDark ? 'rgba(212, 163, 115, 0.15)' : '#F7F2EE',
                        },
                      ]}
                      onPress={() => setEditBranchId(branch.id)}
                    >
                      <Text style={[styles.filterText, { color: colors.text }]}>{branch.name}</Text>
                      {editBranchId === branch.id && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <View style={styles.statusToggleRow}>
                <Text style={[styles.statusToggleLabel, { color: colors.text }]}>Estado de la cuenta:</Text>
                <TouchableOpacity
                  style={[styles.statusToggleBtn, editIsActive ? styles.btnActive : styles.btnInactive]}
                  onPress={() => setEditIsActive(!editIsActive)}
                >
                  <Text style={styles.statusToggleBtnText}>{editIsActive ? 'Activo' : 'Desactivado'}</Text>
                </TouchableOpacity>
              </View>

              <Button title={updating ? 'Guardando…' : 'Guardar Cambios'} onPress={handleUpdate} disabled={updating} />
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingUser(null)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: { flex: 1, paddingRight: 8 },
  headerTitle: { fontSize: 21, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 3 },
  search: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 34,
    minHeight: 34,
    maxHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8, paddingBottom: 80, flexGrow: 1 },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 9,
  },
  userInfo: { flex: 1, paddingRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  userName: { fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  details: { fontSize: 12, marginTop: 2 },
  points: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  active: { color: '#2E7D32' },
  inactive: { color: '#C62828' },
  actionsColumn: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  loader: { marginTop: 32 },
  empty: { textAlign: 'center', marginTop: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalContent: { borderRadius: 16, padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  modalTitle: { fontSize: 19, fontWeight: '800', marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 11, fontSize: 14, marginBottom: 9 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginTop: 5, marginBottom: 7 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  roleOption: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  branchOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  statusToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  statusToggleLabel: { fontSize: 13, fontWeight: '700' },
  statusToggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  btnActive: { backgroundColor: '#16A34A' },
  btnInactive: { backgroundColor: '#DC2626' },
  statusToggleBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  modalCancel: { alignItems: 'center', marginTop: 12, padding: 8 },
  modalCancelText: { fontWeight: '600' },
});
