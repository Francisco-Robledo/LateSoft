import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { calculateTaxFromGross } from '../utils/tax';

export interface CartItem {
  branchProductId: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  branchId: number | null;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  totalItemsCount: number;
  addItem: (branchId: number, item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (branchProductId: number) => void;
  updateQuantity: (branchProductId: number, quantity: number) => void;
  updateItemNotes: (branchProductId: number, notes: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);

  const addItem = (targetBranchId: number, item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    // Si la sucursal cambio, reiniciar carrito para evitar mezclar pedidos de distintos locales
    if (branchId !== null && branchId !== targetBranchId) {
      setItems([{ ...item, quantity }]);
      setBranchId(targetBranchId);
      return;
    }

    setBranchId(targetBranchId);

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((i) => i.branchProductId === item.branchProductId);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prevItems, { ...item, quantity }];
    });
  };

  const removeItem = (branchProductId: number) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.branchProductId !== branchProductId);
      if (updated.length === 0) {
        setBranchId(null);
      }
      return updated;
    });
  };

  const updateQuantity = (branchProductId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(branchProductId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.branchProductId === branchProductId ? { ...i, quantity } : i))
    );
  };

  const updateItemNotes = (branchProductId: number, notes: string) => {
    setItems((prev) =>
      prev.map((i) => (i.branchProductId === branchProductId ? { ...i, notes } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setBranchId(null);
  };

  const { totalAmount, subtotal, taxAmount, totalItemsCount } = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const roundedTotal = Math.round(total * 100) / 100;
    const tax = calculateTaxFromGross(roundedTotal, 21.00);

    return {
      totalAmount: roundedTotal,
      subtotal: tax.net,
      taxAmount: tax.tax,
      totalItemsCount: count,
    };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        branchId,
        totalAmount,
        subtotal,
        taxAmount,
        totalItemsCount,
        addItem,
        removeItem,
        updateQuantity,
        updateItemNotes,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un CartProvider');
  }
  return context;
}
