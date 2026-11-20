"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from "react";
import { User } from "./types";
import { api } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVendedor: boolean;
  /** Roles del usuario (multi-rol). */
  roles: string[];
  /** Permisos efectivos (roles + concesiones - denegaciones). */
  permissions: string[];
  hasRole: (role: string) => boolean;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Snapshot inicial consistente entre servidor y cliente (sin sesiÃ³n).
// Evita hydration mismatch porque el SSR y el primer render del cliente coinciden.
const emptyAuth = { token: null as string | null, user: null as User | null };

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

function loadFromStorage(): { token: string | null; user: User | null } {
  try {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      return { token: savedToken, user: JSON.parse(savedUser) };
    }
    return emptyAuth;
  } catch {
    return emptyAuth;
  }
}

// getServerSnapshot devuelve vacÃ­o (para SSR), getSnapshot devuelve lo real en cliente.
// Esto permite que el primer render del cliente coincida con el SSR, y luego React
// re-hidrata con el snapshot real sin mismatch.
let clientSnapshot = emptyAuth;

if (typeof window !== "undefined") {
  clientSnapshot = loadFromStorage();
}

function getSnapshot() {
  return clientSnapshot;
}

function getServerSnapshot() {
  return emptyAuth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, user } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = (newToken: string, newUser: User, refreshToken?: string) => {
    localStorage.setItem("token", newToken);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    clientSnapshot = { token: newToken, user: newUser };
    emitChange();
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("refresh_token");
    clientSnapshot = emptyAuth;
    emitChange();
  };

  // Actualiza los datos del usuario (p. ej. tras editarlo en el perfil) sin
  // tocar el token, para que el resto de la app vea el cambio al instante.
  const updateUser = (newUser: User) => {
    if (!clientSnapshot.token) return;
    localStorage.setItem("user", JSON.stringify(newUser));
    clientSnapshot = { token: clientSnapshot.token, user: newUser };
    emitChange();
  };

  // Revalida la sesión al cargar/ingresar: pide los datos frescos al backend para
  // reflejar cambios de roles/permisos hechos por un admin sin re-login. Si la
  // cuenta fue desactivada, `/auth/me` responde 401 y api.ts cierra la sesión.
  useEffect(() => {
    if (!token) return;
    api
      .get<User>("/auth/me")
      .then((u) => {
        localStorage.setItem("user", JSON.stringify(u));
        clientSnapshot = { token, user: u };
        emitChange();
      })
      .catch(() => {
        // Si falla (p. ej. 401), api.ts ya se encarga de limpiar la sesión.
      });
  }, [token]);

  // Cuando api.ts renueva el token de acceso (refresh), sincroniza el snapshot en
  // memoria para que el resto de la app vea el token y los permisos al día.
  useEffect(() => {
    function onRefreshed(e: Event) {
      const detail = (e as CustomEvent<{ token: string; user: User | null }>).detail;
      if (!detail?.token) return;
      clientSnapshot = { token: detail.token, user: detail.user ?? clientSnapshot.user };
      emitChange();
    }
    window.addEventListener("auth:refreshed", onRefreshed);
    return () => window.removeEventListener("auth:refreshed", onRefreshed);
  }, []);

  // Roles y permisos del usuario. Si el usuario guardado es anterior al
  // multi-rol (sin `roles`), se cae al `role` único.
  const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : [];
  const permissions = user?.permissions ?? [];
  const hasRole = (role: string) => roles.includes(role);
  const hasPermission = (code: string) => permissions.includes(code);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        isAdmin: hasPermission("admin.access") || hasRole("admin"),
        isVendedor: hasPermission("pos.sell") || hasPermission("pos.access") || hasRole("vendedor"),
        roles,
        permissions,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
