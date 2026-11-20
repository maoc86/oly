"use client";

import {
  createContext, useContext, useSyncExternalStore, ReactNode, useCallback,
} from "react";

const CART_KEY = "oly:cart";

export interface CartLine {
  variant_id: number;
  product_id: number;
  name: string;
  image?: string;
  size?: string;
  color?: string;
  price: number; // precio unitario en USD
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
}

const EMPTY: CartState = { lines: [] };

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function emitChange() {
  listeners.forEach((l) => l());
}

function readCart(): CartState {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CART_KEY) : null;
    return raw ? (JSON.parse(raw) as CartState) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let clientSnapshot: CartState = EMPTY;
if (typeof window !== "undefined") {
  clientSnapshot = readCart();
}

function getSnapshot() {
  return clientSnapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

interface CartContextType {
  cart: CartState;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQty: (variantId: number, quantity: number) => void;
  removeLine: (variantId: number) => void;
  clearCart: () => void;
  itemsCount: number;
  total: number;
}

const Ctx = createContext<CartContextType>({
  cart: EMPTY,
  addLine: () => {},
  setQty: () => {},
  removeLine: () => {},
  clearCart: () => {},
  itemsCount: 0,
  total: 0,
});

function persist(cart: CartState) {
  if (typeof window !== "undefined") localStorage.setItem(CART_KEY, JSON.stringify(cart));
  clientSnapshot = cart;
  emitChange();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addLine = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    const current = clientSnapshot;
    const existing = current.lines.find((l) => l.variant_id === line.variant_id);
    let lines: CartLine[];
    if (existing) {
      lines = current.lines.map((l) =>
        l.variant_id === line.variant_id ? { ...l, quantity: l.quantity + quantity } : l
      );
    } else {
      lines = [...current.lines, { ...line, quantity }];
    }
    persist({ lines });
  }, []);

  const setQty = useCallback((variantId: number, quantity: number) => {
    const current = clientSnapshot;
    if (quantity <= 0) {
      persist({ lines: current.lines.filter((l) => l.variant_id !== variantId) });
      return;
    }
    persist({
      lines: current.lines.map((l) => (l.variant_id === variantId ? { ...l, quantity } : l)),
    });
  }, []);

  const removeLine = useCallback((variantId: number) => {
    persist({ lines: clientSnapshot.lines.filter((l) => l.variant_id !== variantId) });
  }, []);

  const clearCart = useCallback(() => persist(EMPTY), []);

  const itemsCount = cart.lines.reduce((a, l) => a + l.quantity, 0);
  const total = cart.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return (
    <Ctx.Provider value={{ cart, addLine, setQty, removeLine, clearCart, itemsCount, total }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  return useContext(Ctx);
}
