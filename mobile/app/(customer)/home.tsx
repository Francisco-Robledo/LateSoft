import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LoadingView } from '../../src/components/LoadingView';
import { EmptyState } from '../../src/components/EmptyState';
import { useBranch } from '../../src/context/BranchContext';
import { useCart } from '../../src/context/CartContext';
import { apiClient } from '../../src/api/client';
import { formatPrice } from '../../src/utils/format';
import { formatDistance } from '../../src/utils/haversine';
import { ScrollToTopButton, useScrollToTop } from '../../src/components/ScrollToTopButton';
import { useTheme } from '../../src/context/ThemeContext';

interface MenuItem {
  branch_product_id: number;
  product_id: number;
  category_id: number;
  name: string;
  description: string;
  image_url: string;
  price: number;
  base_price: number;
  is_available: boolean;
  paused_reason: string | null;
}

interface MenuCategory {
  id: number;
  name: string;
  icon: string;
  items: MenuItem[];
}

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { selectedBranch, isLoading: isBranchLoading, refreshBranches } = useBranch();
  const { addItem } = useCart();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal para agregar ítem con notas
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  const { scrollRef: mainScrollRef, showScrollTop, handleScroll, scrollToTop } = useScrollToTop(150);

  const fetchMenu = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      const res = await apiClient.post(`/branches/${selectedBranch.id}/menu`);
      const menuData: MenuCategory[] = res.data.menu;
      setCategories(menuData);
    } catch (err: any) {
      console.error('[CustomerHome] Error al cargar menú:', err);
      // Auto-recuperación si la sucursal guardada ya no existe en la base de datos
      if (err?.code === 'NOT_FOUND' || err?.message?.includes('Sucursal no encontrada')) {
        await refreshBranches();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranch, refreshBranches]);

  useEffect(() => {
    if (selectedBranch) {
      setLoading(true);
      fetchMenu();
    }
  }, [selectedBranch, fetchMenu]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMenu();
  };

  const handleOpenAddModal = (item: MenuItem) => {
    setActiveItem(item);
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleAddToCart = () => {
    if (!activeItem || !selectedBranch) return;
    addItem(
      selectedBranch.id,
      {
        branchProductId: activeItem.branch_product_id,
        productId: activeItem.product_id,
        name: activeItem.name,
        price: activeItem.price,
        imageUrl: activeItem.image_url,
      },
      itemQuantity
    );
    setActiveItem(null);
  };

  // Filtrado reactivo en tiempo real para el buscador
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const list: MenuItem[] = [];
    const seen = new Set<number>();
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (!seen.has(item.branch_product_id)) {
          if (
            item.name.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
          ) {
            seen.add(item.branch_product_id);
            list.push(item);
          }
        }
      });
    });
    return list;
  }, [categories, searchQuery]);

  if (isBranchLoading || (loading && !refreshing)) {
    return <LoadingView message="Cargando la carta de la sucursal..." />;
  }

  if (!selectedBranch) {
    return (
      <Screen contentContainerStyle={styles.centerContainer}>
        <EmptyState
          icon="location-outline"
          title="Elegí una sucursal"
          description="Para ver la carta y los precios locales, seleccioná una sucursal de LateSoft."
          actionTitle="Ver sucursales cercanas"
          onAction={() => router.push('/(customer)/branches')}
        />
      </Screen>
    );
  }

  // Renderizador de una tarjeta de producto en carrusel horizontal
  const renderCarouselProductCard = (item: MenuItem) => (
    <TouchableOpacity
      key={item.branch_product_id}
      activeOpacity={0.88}
      onPress={() => handleOpenAddModal(item)}
      style={[
        styles.carouselCard,
        {
          backgroundColor: isDark ? colors.surfaceSecondary : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.cardImageContainer}>
        <Image source={{ uri: item.image_url }} style={styles.carouselCardImage} />
        {!item.is_available && (
          <View style={styles.cardUnavailableOverlay}>
            <Text style={styles.cardUnavailableText}>Agotado</Text>
          </View>
        )}
      </View>

      <View style={styles.carouselCardBody}>
        <Text style={[styles.carouselCardName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.carouselCardPrice, { color: colors.primary }]}>
          {formatPrice(item.price)}
        </Text>

        <View style={styles.carouselCardFooter}>
          {item.is_available ? (
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleOpenAddModal(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={isDark ? '#111827' : '#FFFFFF'} />
              <Text
                style={[
                  styles.quickAddBtnText,
                  { color: isDark ? '#111827' : '#FFFFFF' },
                ]}
              >
                Agregar
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedBadgeText}>No disponible</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen style={styles.screen}>
      {/* Barra fija superior con datos de la sucursal activa */}
      <View style={[styles.branchHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.branchInfo}>
          <View style={styles.branchNameRow}>
            <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            <Text style={[styles.branchName, { color: colors.text }]} numberOfLines={1}>
              {selectedBranch.name}
            </Text>
          </View>
          <View style={styles.branchDetailsRow}>
            <View style={[styles.statusBadge, selectedBranch.is_open ? styles.openBadge : styles.closedBadge]}>
              <Text style={[styles.statusBadgeText, selectedBranch.is_open ? styles.openText : styles.closedText]}>
                {selectedBranch.is_open ? 'Abierto' : 'Cerrado'}
              </Text>
            </View>
            {selectedBranch.distanceKm !== undefined && (
              <Text style={[styles.distanceText, { color: colors.textSecondary }]}>• a {formatDistance(selectedBranch.distanceKm)}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.changeBranchButton, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
          onPress={() => router.push('/(customer)/branches')}
          accessibilityRole="button"
          accessibilityLabel="Cambiar sucursal activa"
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
          <Text style={[styles.changeBranchText, { color: colors.primary }]}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de búsqueda interactiva */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar café, comida, bebidas..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Borrar búsqueda"
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* VISTA 1: RESULTADOS DE BÚSQUEDA */}
      {searchQuery.trim().length > 0 ? (
        <FlatList
          ref={mainScrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          data={filteredProducts}
          keyExtractor={(item) => String(item.branch_product_id)}
          contentContainerStyle={styles.searchListContent}
          ListHeaderComponent={
            <View style={styles.searchHeaderRow}>
              <Text style={[styles.searchResultCount, { color: colors.textSecondary }]}>
                {filteredProducts.length === 1
                  ? '1 producto encontrado'
                  : `${filteredProducts.length} productos encontrados`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Sin resultados"
              description={`No encontramos productos con el término "${searchQuery}". Probá buscando con otro nombre.`}
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.productCard}>
              <Image source={{ uri: item.image_url }} style={styles.productImage} />
              <View style={styles.productContent}>
                <View style={styles.productHeader}>
                  <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(item.price)}</Text>
                </View>

                <Text style={[styles.productDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.productFooter}>
                  {!item.is_available ? (
                    <View style={styles.unavailableBadge}>
                      <Ionicons name="alert-circle-outline" size={14} color="#C62828" />
                      <Text style={styles.unavailableText}>
                        {item.paused_reason || 'Agotado en este local'}
                      </Text>
                    </View>
                  ) : (
                    <Button
                      title="Agregar"
                      size="small"
                      onPress={() => handleOpenAddModal(item)}
                      icon={<Ionicons name="add" size={16} color="#FFF" />}
                    />
                  )}
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        /* VISTA 2: MENÚ EN CARRUSELES POR CATEGORÍA (SEGÚN BOSQUEJO) */
        <FlatList
          ref={mainScrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          data={categories.filter((cat) => cat.items && cat.items.length > 0)}
          keyExtractor={(cat) => String(cat.id)}
          contentContainerStyle={styles.carouselsContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon="cafe-outline"
              title="Carta vacía"
              description="No hay productos disponibles en esta sucursal por el momento."
            />
          }
          renderItem={({ item: category }) => (
            <View style={styles.categorySection}>
              {/* TITULO DE CATEGORIA */}
              <View style={styles.categoryTitleRow}>
                <View style={styles.categoryTitleWithIcon}>
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>
                    {category.name}
                  </Text>
                  <View style={[styles.categoryCountBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.categoryCountText, { color: colors.textSecondary }]}>
                      {category.items.length}
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARRUSEL HORIZONTAL DE PRODUCTOS */}
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={category.items}
                keyExtractor={(item) => String(item.branch_product_id)}
                contentContainerStyle={styles.horizontalCarouselContent}
                renderItem={({ item }) => renderCarouselProductCard(item)}
              />
            </View>
          )}
        />
      )}

      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />

      {/* Modal para configurar ítem y notas antes de agregar al carrito */}
      <Modal
        visible={!!activeItem}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {activeItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{activeItem.name}</Text>
                  <TouchableOpacity
                    onPress={() => setActiveItem(null)}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                    accessibilityLabel="Cerrar modal"
                  >
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalPrice, { color: colors.primary }]}>{formatPrice(activeItem.price)}</Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>{activeItem.description}</Text>

                <View style={[styles.quantitySection, { borderColor: colors.border }]}>
                  <Text style={[styles.quantityLabel, { color: colors.text }]}>Cantidad:</Text>
                  <View style={[styles.quantityCounter, { backgroundColor: colors.surfaceSecondary }]}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                      accessibilityLabel="Disminuir cantidad"
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.counterText, { color: colors.text }]}>{itemQuantity}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setItemQuantity(itemQuantity + 1)}
                      accessibilityLabel="Aumentar cantidad"
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.notesSection}>
                  <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Aclaraciones especiales (opcional):</Text>
                  <TextInput
                    style={[styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    placeholder="Ej. Leche de almendras, sin azúcar, bien caliente..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={2}
                    value={itemNotes}
                    onChangeText={setItemNotes}
                  />
                </View>

                <Button
                  title={`Agregar al pedido • ${formatPrice(activeItem.price * itemQuantity)}`}
                  onPress={handleAddToCart}
                  style={styles.modalAddBtn}
                />
              </>
            )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  branchInfo: {
    flex: 1,
    marginRight: 10,
  },
  branchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  branchDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  openBadge: {
    backgroundColor: '#E8F5E9',
  },
  closedBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openText: {
    color: '#2E7D32',
  },
  closedText: {
    color: '#C62828',
  },
  distanceText: {
    fontSize: 12,
  },
  changeBranchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  changeBranchText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchListContent: {
    padding: 16,
    paddingBottom: 90,
  },
  searchHeaderRow: {
    marginBottom: 12,
  },
  searchResultCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  carouselsContainer: {
    paddingVertical: 12,
    paddingBottom: 90,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  categoryCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalCarouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  carouselCard: {
    width: 175,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 115,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  carouselCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardUnavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardUnavailableText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  carouselCardBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  carouselCardName: {
    fontSize: 14,
    fontWeight: '700',
    minHeight: 36,
    lineHeight: 18,
    marginBottom: 4,
  },
  carouselCardPrice: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  carouselCardFooter: {
    marginTop: 'auto',
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pausedBadge: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  pausedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C62828',
  },
  productCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#EEE',
  },
  productContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  productDesc: {
    fontSize: 12,
    marginVertical: 4,
    lineHeight: 16,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C62828',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalPrice: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  modalDesc: {
    fontSize: 13,
    marginVertical: 8,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  quantityLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  quantityCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 2,
  },
  counterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalAddBtn: {
    marginTop: 6,
  },
});
