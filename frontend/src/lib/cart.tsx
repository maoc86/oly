"use client";

import {
  createContext, useContext, useSyncExternalStore, ReactNode, useCallback,
} from "react";
import { Event } from "./types";

const CART_KEY = "ticketing:cart";

export interface CartItem {
  quantity: number;
  seat_ids: number[];
  // Áreas por box: "box" (se compra el box completo, precio por box) o "seat"
  // (se compran sillas individuales, precio por silla). En el resto de áreas
  // se omite y se cobra por entrada.
  mode?: "box" | "seat";
}

export interface CartState {
  event: Event | null;
  items: Record<number, CartItem>;
}

const EMPTY: CartState = { event: null, items: {} };

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
    const raw = sessionStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartState) : EMPTY;
  } catch {
    return EMPTY;
  }
}

// Snapshot inicial igual en servidor y cliente: el carrito vive en sessionStorage,
// así que el SSR siempre arranca vacío y el cliente carga el suyo tras el hydration.
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
  setCart: (cart: CartState) => void;
  clearCart: () => void;
  itemsCount: number;
  total: number;
}

const Ctx = createContext<CartContextType>({
  cart: EMPTY,
  setCart: () => {},
  clearCart: () => {},
  itemsCount: 0,
  total: 0,
});

function persist(cart: CartState) {
  if (typeof window !== "undefined") sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  clientSnapshot = cart;
  emitChange();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCart = useCallback((c: CartState) => persist(c), []);
  const clearCart = useCallback(() => persist(EMPTY), []);

  const itemsCount = Object.values(cart.items).reduce((a, i) => a + i.quantity, 0);

  const total = (cart.event?.ticket_types || []).reduce((sum, tt) => {
    const item = cart.items[tt.id];
    if (!item || item.quantity <= 0) return sum;
    if (item.mode === "seat") {
      return sum + item.quantity * Number(tt.individual_price ?? tt.price);
    }
    const groupSize = Math.max(1, tt.group_size || 1);
    return sum + (item.quantity / groupSize) * Number(tt.price);
  }, 0);

  return (
    <Ctx.Provider value={{ cart, setCart, clearCart, itemsCount, total }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  return useContext(Ctx);
}