import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { usePopup } from '../../src/context/PopupContext';
import { useTheme } from '../../src/context/ThemeContext';
import { apiClient } from '../../src/api/client';
import { formatPrice } from '../../src/utils/format';
import { ScrollToTopButton, useScrollToTop } from '../../src/components/ScrollToTopButton';

export default function AdminCatalogScreen() {
  const { colors, isDark } = useTheme();
  const { showPopup, showConfirm } = usePopup();
  const { scrollRef: listRef, showScrollTop, handleScroll, scrollToTop } = useScrollToTop(150);
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES'>('PRODUCTS');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Modal Producto (Creación y Edición)
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productImg, setProductImg] = useState('https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500');
  const [productCatId, setProductCatId] = useState<number | null>(null);

  // Modal Categoría (Creación y Edición)
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('1');
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showPopup({
          title: 'Permiso requerido',
          message: 'Necesitamos acceso a tu galería para poder seleccionar fotos de los productos.',
          type: 'warning',
        });
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        if (asset.base64) {
          setIsUploadingImg(true);
          try {
            const uploadRes = await apiClient.post('/upload', {
              base64: asset.base64,
              filename: asset.fileName || 'producto.jpg',
              mimeType: asset.mimeType || 'image/jpeg',
            });
            setProductImg(uploadRes.data.url);
            showPopup({
              title: 'Foto cargada',
              message: 'La imagen fue subida y vinculada al producto correctamente.',
              type: 'success',
            });
          } catch (uploadErr: any) {
            showPopup({
              title: 'Error al subir imagen',
              message: uploadErr.response?.data?.error?.message || 'No se pudo subir la foto al servidor.',
              type: 'error',
            });
          } finally {
            setIsUploadingImg(false);
          }
        }
      }
    } catch (err: any) {
      showPopup({
        title: 'Error al abrir galería',
        message: err.message || 'Ocurrió un problema al abrir la galería.',
        type: 'error',
      });
    }
  };

  const fetchCatalog = useCallback(async () => {
    try {
      const catRes = await apiClient.post('/categories', { isList: true });
      setCategories(catRes.data.data);
      if (catRes.data.data.length > 0 && !productCatId) {
        setProductCatId(catRes.data.data[0].id);
      }

      const prodRes = await apiClient.post('/products', { limit: 50, isList: true });
      setProducts(prodRes.data.data);
    } catch (err) {
      console.error('[AdminCatalog] Error:', err);
    }
  }, [productCatId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductName('');
    setProductDesc('');
    setProductPrice('');
    setProductImg('https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500');
    if (categories.length > 0) setProductCatId(categories[0].id);
    setIsProductModalVisible(true);
  };

  const openEditProductModal = (prod: any) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductDesc(prod.description);
    setProductPrice(String(prod.base_price));
    setProductImg(prod.image_url);
    setProductCatId(prod.category_id);
    setIsProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!productName || !productDesc || !productPrice || !productCatId) {
      showPopup({
        title: 'Campos requeridos',
        message: 'Completá todos los campos.',
        type: 'warning',
      });
      return;
    }

    const price = parseFloat(productPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      showPopup({
        title: 'Precio inválido',
        message: 'Ingresá un monto mayor a cero.',
        type: 'warning',
      });
      return;
    }

    const payload = {
      name: productName.trim(),
      description: productDesc.trim(),
      basePrice: price,
      imageUrl: productImg,
      categoryId: productCatId,
    };

    if (editingProduct) {
      showConfirm({
        title: 'Confirmar modificación',
        message: `¿Estás seguro de que deseás guardar los cambios en "${productName.trim()}"?`,
        confirmText: 'Guardar Cambios',
        cancelText: 'Revisar',
        onConfirm: async () => {
          try {
            await apiClient.put(`/products/${editingProduct.id}`, payload);
            setIsProductModalVisible(false);
            setEditingProduct(null);
            setProductName('');
            setProductDesc('');
            setProductPrice('');
            fetchCatalog();
            showPopup({
              title: 'Producto Actualizado',
              message: `"${payload.name}" fue actualizado exitosamente en el catálogo.`,
              type: 'success',
            });
          } catch (err: any) {
            showPopup({
              title: 'Error',
              message: err.response?.data?.error?.message || err.message || 'No se pudo guardar el producto',
              type: 'error',
            });
          }
        },
      });
      return;
    }

    try {
      await apiClient.post('/products', payload);
      setIsProductModalVisible(false);
      setEditingProduct(null);
      setProductName('');
      setProductDesc('');
      setProductPrice('');
      fetchCatalog();
      showPopup({
        title: 'Producto Creado',
        message: `"${payload.name}" fue incorporado al catálogo de la marca.`,
        type: 'success',
      });
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.response?.data?.error?.message || err.message || 'No se pudo guardar el producto',
        type: 'error',
      });
    }
  };

  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategorySortOrder(String(categories.length + 1));
    setIsCategoryModalVisible(true);
  };

  const openEditCategoryModal = (cat: any) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategorySortOrder(String(cat.sort_order));
    setIsCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      showPopup({
        title: 'Campo requerido',
        message: 'Ingresá el nombre de la categoría.',
        type: 'warning',
      });
      return;
    }

    const payload = {
      name: categoryName.trim(),
      icon: 'coffee',
      sortOrder: parseInt(categorySortOrder, 10) || categories.length + 1,
    };

    if (editingCategory) {
      showConfirm({
        title: 'Confirmar modificación',
        message: `¿Estás seguro de que deseás guardar los cambios en la categoría "${categoryName.trim()}"?`,
        confirmText: 'Guardar Cambios',
        cancelText: 'Revisar',
        onConfirm: async () => {
          try {
            await apiClient.put(`/categories/${editingCategory.id}`, payload);
            setIsCategoryModalVisible(false);
            setEditingCategory(null);
            setCategoryName('');
            fetchCatalog();
            showPopup({
              title: 'Categoría Actualizada',
              message: `"${payload.name}" fue actualizada exitosamente.`,
              type: 'success',
            });
          } catch (err: any) {
            showPopup({
              title: 'Error',
              message: err.response?.data?.error?.message || err.message || 'No se pudo guardar la categoría',
              type: 'error',
            });
          }
        },
      });
      return;
    }

    try {
      await apiClient.post('/categories', payload);
      setIsCategoryModalVisible(false);
      setEditingCategory(null);
      setCategoryName('');
      fetchCatalog();
      showPopup({
        title: 'Categoría Creada',
        message: 'Categoría creada exitosamente.',
        type: 'success',
      });
    } catch (err: any) {
      showPopup({
        title: 'Error',
        message: err.response?.data?.error?.message || err.message || 'No se pudo guardar la categoría',
        type: 'error',
      });
    }
  };

  const handleDeleteProduct = (productId: number, name: string) => {
    showConfirm({
      title: 'Desactivar producto',
      message: `¿Confirmás la baja de "${name}"?`,
      confirmText: 'Desactivar',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/products/${productId}`);
          showPopup({
            title: 'Producto desactivado',
            message: `El producto "${name}" fue dado de baja.`,
            type: 'info',
          });
          fetchCatalog();
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.message || 'No se pudo desactivar el producto',
            type: 'error',
          });
        }
      },
    });
  };

  const handleDeleteCategory = (categoryId: number, name: string) => {
    showConfirm({
      title: 'Eliminar categoría',
      message: `¿Confirmás eliminar la categoría "${name}"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/categories/${categoryId}`);
          showPopup({
            title: 'Categoría eliminada',
            message: `La categoría "${name}" fue eliminada.`,
            type: 'info',
          });
          fetchCatalog();
        } catch (err: any) {
          showPopup({
            title: 'Error',
            message: err.response?.data?.error?.message || err.message || 'No se pudo eliminar la categoría',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Catálogo Maestro</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Productos y categorías de la marca</Text>
        </View>
        <Button
          title={activeTab === 'PRODUCTS' ? '+ Producto' : '+ Categoría'}
          size="small"
          onPress={() =>
            activeTab === 'PRODUCTS'
              ? openCreateProductModal()
              : openCreateCategoryModal()
          }
        />
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PRODUCTS' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('PRODUCTS')}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'PRODUCTS' ? colors.primary : colors.textSecondary },
              activeTab === 'PRODUCTS' && styles.tabBtnTextActive,
            ]}
          >
            Productos ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CATEGORIES' && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('CATEGORIES')}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === 'CATEGORIES' ? colors.primary : colors.textSecondary },
              activeTab === 'CATEGORIES' && styles.tabBtnTextActive,
            ]}
          >
            Categorías ({categories.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'PRODUCTS' ? (
        <FlatList
          ref={listRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemCat, { color: colors.primary }]}>{item.category_name} • Base: {formatPrice(item.base_price)}</Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
              </View>
              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => openEditProductModal(item)}
                >
                  <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionDelBtn]}
                  onPress={() => handleDeleteProduct(item.id, item.name)}
                >
                  <Ionicons name="trash-outline" size={17} color="#C62828" />
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          data={categories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Card style={styles.cardItem}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemCat, { color: colors.textSecondary }]}>Orden de visualización: #{item.sort_order}</Text>
              </View>
              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => openEditCategoryModal(item)}
                >
                  <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionDelBtn]}
                  onPress={() => handleDeleteCategory(item.id, item.name)}
                >
                  <Ionicons name="trash-outline" size={17} color="#C62828" />
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      )}

      <ScrollToTopButton visible={showScrollTop} onPress={scrollToTop} />

      {/* Modal Producto (Crear / Editar) */}
      <Modal visible={isProductModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingProduct ? 'Editar Producto del Catálogo' : 'Nuevo Producto de la Marca'}
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Nombre del producto"
              placeholderTextColor={colors.placeholder}
              value={productName}
              onChangeText={setProductName}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Descripción breve"
              placeholderTextColor={colors.placeholder}
              value={productDesc}
              onChangeText={setProductDesc}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Precio base con IVA ($)"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={productPrice}
              onChangeText={setProductPrice}
            />
            <Text style={[styles.inputLabel, { color: colors.text }]}>Foto del Producto:</Text>
            <View style={[styles.imagePickerRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {productImg ? (
                <Image source={{ uri: productImg }} style={[styles.imageThumb, { backgroundColor: colors.inputBg }]} />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <TouchableOpacity
                  style={[styles.galleryBtn, { borderColor: colors.primary, backgroundColor: isDark ? colors.surface : '#EFEBE9' }]}
                  onPress={handlePickImage}
                  disabled={isUploadingImg}
                >
                  <Ionicons name="images" size={17} color={colors.primary} />
                  <Text style={[styles.galleryBtnText, { color: colors.primary }]}>
                    {isUploadingImg ? 'Subiendo imagen...' : 'Elegir de Galería'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginBottom: 0, fontSize: 11, paddingVertical: 6 }]}
                  placeholder="O ingresá URL externa..."
                  placeholderTextColor={colors.placeholder}
                  value={productImg}
                  onChangeText={setProductImg}
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Categoría:</Text>
            <View style={styles.catWrap}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.catPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                    productCatId === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setProductCatId(c.id)}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      { color: colors.textSecondary },
                      productCatId === c.id && { color: isDark ? '#111827' : '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title={editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
              onPress={handleSaveProduct}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setIsProductModalVisible(false);
                setEditingProduct(null);
              }}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Categoría (Crear / Editar) */}
      <Modal visible={isCategoryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Nombre de la categoría"
              placeholderTextColor={colors.placeholder}
              value={categoryName}
              onChangeText={setCategoryName}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder="Orden de visualización (ej: 1, 2, 3)"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              value={categorySortOrder}
              onChangeText={setCategorySortOrder}
            />
            <Button
              title={editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
              onPress={handleSaveCategory}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setIsCategoryModalVisible(false);
                setEditingCategory(null);
              }}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
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
    fontWeight: '800',
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1810',
  },
  itemCat: {
    fontSize: 12,
    color: '#6F4E37',
    fontWeight: '600',
    marginTop: 2,
  },
  itemDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  actionBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#F5F2F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDelBtn: {
    backgroundColor: '#FFEBEE',
  },
  delBtn: {
    padding: 8,
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
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
  },
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    backgroundColor: '#FAF8F5',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEBE9',
  },
  imageThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#EFEBE9',
  },
  imagePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFEBE9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7CCC8',
  },
  galleryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5D4037',
  },
  catWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  catPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  catPillActive: {
    backgroundColor: '#6F4E37',
    borderColor: '#6F4E37',
  },
  catPillText: {
    fontSize: 12,
    color: '#444',
  },
  catPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 10,
    padding: 8,
  },
  modalCancelText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 13,
  },
});
