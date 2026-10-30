import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { useAuth } from '../../src/context/AuthContext';
import { usePopup } from '../../src/context/PopupContext';
import { apiClient } from '../../src/api/client';
import { formatPrice } from '../../src/utils/format';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { logout, status: authStatus } = useAuth();
  const { showPopup, showConfirm } = usePopup();
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('30days');

  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await apiClient.post('/branches', { activeOnly: false });
      setBranches(res.data.data);
    } catch (err) {
      console.error('[AdminDashboard] Error cargando sucursales:', err);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    if (authStatus !== 'AUTHENTICATED') return;
    try {
      const salesPayload: Record<string, any> = {};
      if (selectedBranchId) salesPayload.branchId = selectedBranchId;

      const now = new Date();
      if (dateRange === 'today') {
        const dStr = now.toISOString().split('T')[0];
        salesPayload.from = dStr;
        salesPayload.to = dStr;
      } else if (dateRange === '7days') {
        const fromDate = new Date();
        fromDate.setDate(now.getDate() - 7);
        salesPayload.from = fromDate.toISOString().split('T')[0];
        salesPayload.to = now.toISOString().split('T')[0];
      }

      const res = await apiClient.post('/reports/sales', salesPayload);
      setSalesReport(res.data);

      const topPayload: Record<string, any> = { limit: 8 };
      if (selectedBranchId) topPayload.branchId = selectedBranchId;
      const topRes = await apiClient.post('/reports/top-products', topPayload);
      setTopProducts(topRes.data.data);
    } catch (err) {
      console.error('[AdminDashboard] Error cargando métricas:', err);
    } finally {
      setRefreshing(false);
    }
  }, [authStatus, selectedBranchId, dateRange]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;
    fetchMetrics();
  }, [authStatus, fetchMetrics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Confirmás salir de la cuenta de Administrador?',
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard General</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Métricas y comparativa de la cadena</Text>
          </View>
          <TouchableOpacity style={[styles.headerLogoutBtn, { backgroundColor: colors.errorBg, borderColor: isDark ? '#6B2A24' : '#FFCDD2' }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.headerLogoutText, { color: colors.error }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector de Rango de Fecha */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.surface, borderColor: colors.border },
            dateRange === 'today' && [styles.filterPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
          ]}
          onPress={() => setDateRange('today')}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: colors.textSecondary },
              dateRange === 'today' && [styles.filterPillTextActive, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }],
            ]}
          >
            Hoy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.surface, borderColor: colors.border },
            dateRange === '7days' && [styles.filterPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
          ]}
          onPress={() => setDateRange('7days')}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: colors.textSecondary },
              dateRange === '7days' && [styles.filterPillTextActive, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }],
            ]}
          >
            Últimos 7 días
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.surface, borderColor: colors.border },
            dateRange === '30days' && [styles.filterPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
          ]}
          onPress={() => setDateRange('30days')}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: colors.textSecondary },
              dateRange === '30days' && [styles.filterPillTextActive, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }],
            ]}
          >
            Últimos 30 días
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Sucursal para Inspección (Sin scroll horizontal - flexWrap) */}
      <View style={styles.branchSelectorRow}>
        <View style={styles.branchWrap}>
          <TouchableOpacity
            style={[
              styles.branchPill,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              selectedBranchId === null && [styles.branchPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
            ]}
            onPress={() => setSelectedBranchId(null)}
          >
            <Text
              style={[
                styles.branchPillText,
                { color: colors.textSecondary },
                selectedBranchId === null && [styles.branchPillTextActive, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }],
              ]}
            >
              Toda la Cadena
            </Text>
          </TouchableOpacity>
          {branches.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.branchPill,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                selectedBranchId === b.id && [styles.branchPillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
              ]}
              onPress={() => setSelectedBranchId(b.id)}
            >
              <Text
                style={[
                  styles.branchPillText,
                  { color: colors.textSecondary },
                  selectedBranchId === b.id && [styles.branchPillTextActive, { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' }],
                ]}
              >
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {salesReport && (
          <>
            {/* Grid de KPIs principales */}
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Ventas Totales</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.totalRevenue)}</Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Comandas Cobradas</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{salesReport.summary.totalOrders}</Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Ticket Promedio</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.averageTicket)}</Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>IVA Discriminado (21%)</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatPrice(salesReport.summary.totalTax)}</Text>
              </Card>
            </View>

            {/* Comparativa por Sucursales (si no se seleccionó una individual) */}
            {selectedBranchId === null && salesReport.branchComparison?.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ranking Comparativo por Sucursal</Text>
                {salesReport.branchComparison.map((item: any, idx: number) => (
                  <Card key={item.branch_id} style={styles.branchCompCard}>
                    <Text style={[styles.compRank, { color: colors.primary }]}>#{idx + 1}</Text>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={[styles.compName, { color: colors.text }]}>{item.branch_name}</Text>
                      <Text style={[styles.compOrders, { color: colors.textSecondary }]}>{item.orders_count} comandas emitidas</Text>
                    </View>
                    <Text style={[styles.compRevenue, { color: colors.primary }]}>{formatPrice(item.total_revenue)}</Text>
                  </Card>
                ))}
              </View>
            )}

            {/* Ranking de Productos Más Vendidos */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Productos Más Vendidos</Text>
              {topProducts.map((p, idx) => (
                <Card key={idx} style={styles.topProductCard}>
                  <Text style={[styles.topRank, { color: colors.primary }]}>#{idx + 1}</Text>
                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={[styles.topName, { color: colors.text }]}>{p.product_name}</Text>
                    <Text style={[styles.topQty, { color: colors.textSecondary }]}>{p.total_quantity} unidades</Text>
                  </View>
                  <Text style={[styles.topRevenue, { color: colors.primary }]}>{formatPrice(p.total_revenue)}</Text>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
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
    paddingBottom: 6,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterPill: {
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEBE9',
  },
  filterPillActive: {
    backgroundColor: '#6F4E37',
    borderColor: '#6F4E37',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  branchSelectorRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  branchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  branchPill: {
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F7F2EE',
    borderWidth: 1,
    borderColor: '#E5DCD5',
  },
  branchPillActive: {
    backgroundColor: '#3E2723',
    borderColor: '#3E2723',
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F4E37',
  },
  branchPillTextActive: {
    color: '#FFF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flexBasis: '48%',
    padding: 14,
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A1810',
    marginBottom: 10,
  },
  branchCompCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  compRank: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6F4E37',
    width: 28,
  },
  compName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1810',
  },
  compOrders: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  compRevenue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2A1810',
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
    width: 28,
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
});
