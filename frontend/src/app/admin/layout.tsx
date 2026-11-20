"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, MapPin, Users, CreditCard, Receipt, LogOut, Tags,
  Ticket as TicketIcon, Banknote, Settings, Briefcase, Wallet, Mail, Menu, X, Activity,
  Store, AlertCircle, Percent, Calculator, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import BrandLogo from "@/components/BrandLogo";
import { SiteConfigProvider } from "@/lib/siteConfig";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  perm: string | null;
  badgeKey?: "pending" | "abandoned";
  group: string;
}

const GROUPS = [
  { key: "general", label: "General" },
  { key: "eventos", label: "Eventos" },
  { key: "ventas", label: "Ventas" },
  { key: "finanzas", label: "Finanzas" },
  { key: "usuarios", label: "Usuarios" },
  { key: "sistema", label: "Sistema" },
];

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: null, group: "general" },
  { href: "/admin/trafico", label: "Tráfico", icon: Activity, perm: "traffic.view", group: "general" },
  { href: "/admin/eventos", label: "Eventos", icon: CalendarDays, perm: "events.manage_all", group: "eventos" },
  { href: "/admin/venues", label: "Venues y Estadios", icon: MapPin, perm: "venues.manage", group: "eventos" },
  { href: "/admin/categorias", label: "Categorías", icon: Tags, perm: "categories.manage", group: "eventos" },
  { href: "/admin/boletos", label: "Boletos", icon: TicketIcon, perm: "tickets.templates", group: "eventos" },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, perm: "users.manage", group: "usuarios" },
  { href: "/admin/organizadores", label: "Organizadores", icon: Briefcase, perm: "users.manage", group: "usuarios" },
  { href: "/admin/taquillas", label: "Taquillas", icon: Store, perm: "users.manage", group: "usuarios" },
  { href: "/admin/pagos", label: "Métodos de Pago", icon: CreditCard, perm: "payments.manage", group: "sistema" },
  { href: "/admin/tasas", label: "Tasas de cambio", icon: Banknote, perm: "settings.manage", group: "finanzas" },
  { href: "/admin/facturacion", label: "Facturación", icon: Receipt, perm: "finance.view_all", group: "ventas", badgeKey: "pending" },
  { href: "/admin/compras-abandonadas", label: "Compras abandonadas", icon: AlertCircle, perm: "orders.view_all", group: "ventas", badgeKey: "abandoned" },
  { href: "/admin/cupones", label: "Cupones", icon: Percent, perm: "coupons.manage", group: "ventas" },
  { href: "/admin/presupuestos", label: "Presupuestos", icon: Calculator, perm: "quotes.manage", group: "ventas" },
  { href: "/admin/finanzas", label: "Finanzas", icon: Wallet, perm: "finance.view_all", group: "finanzas" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, perm: "settings.manage", group: "sistema" },
  { href: "/admin/plantillas-correo", label: "Plantillas de Correo", icon: Mail, perm: "templates.manage", group: "sistema" },
];

const BREADCRUMBS: Record<string, string[]> = {
  "/admin": ["Dashboard"],
  "/admin/trafico": ["Tráfico"],
  "/admin/eventos": ["Eventos"],
  "/admin/venues": ["Venues y Estadios"],
  "/admin/categorias": ["Categorías"],
  "/admin/boletos": ["Boletos"],
  "/admin/usuarios": ["Usuarios"],
  "/admin/organizadores": ["Organizadores"],
  "/admin/taquillas": ["Taquillas"],
  "/admin/pagos": ["Métodos de Pago"],
  "/admin/tasas": ["Tasas de cambio"],
  "/admin/facturacion": ["Facturación"],
  "/admin/compras-abandonadas": ["Compras abandonadas"],
  "/admin/cupones": ["Cupones"],
  "/admin/presupuestos": ["Presupuestos"],
  "/admin/finanzas": ["Finanzas"],
  "/admin/configuracion": ["Configuración"],
  "/admin/plantillas-correo": ["Plantillas de Correo"],
};

function getInitials(name?: string | null) {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [badges, setBadges] = useState<{ pending: number; abandoned: number }>({ pending: 0, abandoned: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem("admin_sidebar_collapsed");
      if (c === "1") setCollapsed(true);
      const g = localStorage.getItem("admin_sidebar_groups");
      if (g) setCollapsedGroups(JSON.parse(g));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("admin_sidebar_collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem("admin_sidebar_groups", JSON.stringify(collapsedGroups)); } catch { /* ignore */ }
  }, [collapsedGroups]);

  useEffect(() => {
    let gPressed = false;
    let gTimer: any = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }
      if (isInput) return;
      if (e.key.toLowerCase() === "g") {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }
      if (gPressed) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        if (e.key.toLowerCase() === "d") router.push("/admin");
        else if (e.key.toLowerCase() === "e") router.push("/admin/eventos");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const d = await api.get<any>("/admin/dashboard");
        if (!cancelled) setBadges((b) => ({ ...b, pending: d?.pending_orders ?? 0 }));
      } catch { /* ignore */ }
      try {
        const c = await api.get<any>("/admin/checkout-attempts/count");
        if (!cancelled) setBadges((b) => ({ ...b, abandoned: c?.abandoned ?? 0 }));
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (auth.user && !auth.isAdmin) router.push("/");
  }, [auth.user, auth.isAdmin, router]);

  const hasPermissions = auth.permissions.length > 0;
  const visibleItems = navItems.filter(
    (i) => !i.perm || !hasPermissions || auth.hasPermission(i.perm)
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return visibleItems;
    const q = searchQuery.toLowerCase();
    return visibleItems.filter((i) => i.label.toLowerCase().includes(q));
  }, [visibleItems, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, NavItem[]> = {};
    for (const g of GROUPS) map[g.key] = [];
    for (const item of filteredItems) {
      if (map[item.group]) map[item.group].push(item);
    }
    return GROUPS.map((g) => ({ ...g, items: map[g.key] || [] })).filter((g) => g.items.length > 0);
  }, [filteredItems]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const initials = getInitials(auth.user?.name);
  const currentLabel = navItems.find((i) => i.href === pathname)?.label || "Admin";

  const breadcrumbs = useMemo(() => {
    if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
    const match = Object.keys(BREADCRUMBS)
      .filter((k) => pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0];
    if (match) return BREADCRUMBS[match];
    return [currentLabel];
  }, [pathname, currentLabel]);

  return (
    <div className="min-h-screen flex bg-gray-100">
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} aria-hidden="true" className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-ink-950 text-white flex flex-col transform transition-all duration-200 ease-out lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className={`p-4 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
          <Link href="/admin" className="min-w-0" aria-label="TicketV">
            <BrandLogo variant="dark" className={collapsed ? "h-6" : "h-8"} />
            {!collapsed && <p className="text-xs text-gray-400 mt-1.5">Panel Admin</p>}
          </Link>
          {!collapsed && (
            <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="lg:hidden text-gray-400 hover:text-white p-1 -mr-1 -mt-1">
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 mb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar... (Ctrl+K)"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 space-y-3 overflow-y-auto">
          {grouped.map((group) => (
            <div key={group.key}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <span>{group.label}</span>
                  <span className="text-[10px]">{collapsedGroups[group.key] ? "▸" : "▾"}</span>
                </button>
              )}
              {(!collapsedGroups[group.key] || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-brand-500/10 text-brand-400 font-semibold border-l-2 border-brand-500"
                            : "text-gray-300 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                        } ${collapsed ? "justify-center px-2" : ""}`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {badge && badge > 0 ? (
                              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                                {badge > 99 ? "99+" : badge}
                              </span>
                            ) : null}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-brand-500 text-ink-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{auth.user?.name || "Admin"}</p>
                <p className="text-xs text-gray-400 truncate">{auth.user?.role || "admin"}</p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Link
              href="/"
              title={collapsed ? "Ver sitio web" : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? "justify-center px-2" : ""}`}
            >
              <TicketIcon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Ver sitio web</span>}
            </Link>
            <button
              onClick={() => { auth.logout(); router.push("/"); }}
              title={collapsed ? "Cerrar sesión" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? "justify-center px-2" : ""}`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 transition-all duration-200 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <header className="bg-white shadow-sm sticky top-0 z-20 h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="lg:hidden text-gray-700 hover:text-gray-900 p-1.5 -ml-1.5">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
            <span className="font-semibold text-gray-900">Admin</span>
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                <span className={`truncate ${i === breadcrumbs.length - 1 ? "text-gray-900 font-medium" : ""}`}>{b}</span>
              </span>
            ))}
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <SiteConfigProvider>{children}</SiteConfigProvider>
        </div>
      </main>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar sección..."
                className="flex-1 text-sm outline-none"
              />
              <button onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-gray-700 text-xs">Esc</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Sin resultados</div>
              ) : (
                filteredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { setSearchOpen(false); setSearchQuery(""); setMenuOpen(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-gray-400" />
                      {item.label}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
