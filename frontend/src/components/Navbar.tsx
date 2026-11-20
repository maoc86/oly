"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LogOut, LayoutDashboard, Search,
  Megaphone, Menu, X, ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useSiteConfig, isSet } from "@/lib/siteConfig";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import BrandLogo from "@/components/BrandLogo";

/** Avatar con iniciales, para no repetir el nombre completo en la barra. */
function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin, isOrganizer, isTaquilla } = useAuth();
  const { config } = useSiteConfig();
  const { itemsCount } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // El menu movil se cierra desde los enlaces (onClick) y al buscar.
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/eventos?search=${encodeURIComponent(q)}` : "/eventos");
    setQuery("");
    setMenuOpen(false);
  }

  const showAnnouncement = config.announcement_active && isSet(config.announcement_text);

  const navLink = (active: boolean) =>
    `px-3 py-2 rounded-full text-sm transition-colors ${
      active
        ? "bg-brand-500 text-ink-900 font-semibold"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`;

  const navLinks = [
    { href: "/", label: "Eventos", active: pathname === "/" },
    { href: "/eventos", label: "Explorar", active: pathname.startsWith("/eventos") },
    ...(isAuthenticated
      ? [{ href: "/boletos", label: "Mis boletos", active: pathname.startsWith("/boletos") }]
      : []),
    ...(isTaquilla
      ? [{ href: "/taquilla", label: "Taquilla", active: pathname.startsWith("/taquilla") }]
      : []),
    ...(isOrganizer && !isAdmin
      ? [{ href: "/organizador", label: "Mi panel", active: pathname.startsWith("/organizador") }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50">
      {showAnnouncement && (
        <div className="bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500 text-ink-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-2 text-center">
            <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
            {config.announcement_link && isSet(config.announcement_link) ? (
              <a
                href={config.announcement_link}
                target={config.announcement_link.startsWith("http") ? "_blank" : undefined}
                rel={config.announcement_link.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-xs sm:text-sm font-semibold min-w-0 break-words hover:underline"
              >
                {config.announcement_text}
              </a>
            ) : (
              <p className="text-xs sm:text-sm font-semibold min-w-0 break-words">{config.announcement_text}</p>
            )}
          </div>
        </div>
      )}

      <div
        className={`border-b bg-ink-950/90 backdrop-blur-md transition-shadow ${
          scrolled ? "border-white/10 shadow-lg shadow-black/20" : "border-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 lg:gap-4">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 min-w-0 group"
            aria-label={config.company_name || "TicketV"}
          >
            <BrandLogo variant="dark" className="h-7 sm:h-8" />
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-2">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className={navLink(l.active)}>
                {l.label}
              </Link>
            ))}
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-xs ml-auto hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar eventos..."
                aria-label="Buscar eventos"
                className="w-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 bg-white/5 hover:bg-white/10 focus:bg-white/10 rounded-full border border-transparent focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20 transition-colors"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <Link
              href="/checkout"
              aria-label={`Carrito, ${itemsCount} entradas`}
              className="relative inline-flex items-center justify-center p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-500 text-ink-900 text-[10px] font-bold shadow-sm shadow-brand-500/30">
                  {itemsCount}
                </span>
              )}
            </Link>

            <CurrencySwitcher variant="dark" />

            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Admin
              </Link>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/perfil"
                  aria-label="Mi perfil"
                  title="Mi perfil"
                  className="inline-flex items-center gap-2 px-1.5 sm:px-2 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                >
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-500 text-ink-900 text-xs font-semibold">
                    {initials(user?.name)}
                  </span>
                  <span className="hidden lg:inline text-sm font-medium text-gray-300 max-w-28 truncate">
                    {user?.name}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  aria-label="Cerrar sesión"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 hover:text-white hover:border-white/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="px-4 py-2 text-sm font-semibold text-ink-900 bg-brand-500 rounded-lg shadow-lg shadow-brand-500/25 hover:bg-brand-400 hover:shadow-brand-500/40 transition-all"
                >
                  Registrarse
                </Link>
              </div>
            )}

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              className="md:hidden inline-flex items-center justify-center p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </div>

      {menuOpen && (
        <div className="md:hidden border-b border-white/10 bg-gray-950/95 backdrop-blur-md shadow-xl shadow-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar eventos..."
                  aria-label="Buscar eventos"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 bg-white/5 focus:bg-white/10 rounded-full border border-transparent focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20 transition-colors"
                />
              </div>
            </form>

            <div className="grid gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    l.active
                      ? "bg-brand-500 text-ink-900 font-semibold"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
                >
                  Panel de administracion
                </Link>
              )}
              {!isAuthenticated && (
                <div className="grid gap-1 pt-2 border-t border-white/10">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold text-ink-900 bg-brand-500 text-center hover:bg-brand-400 transition-colors"
                  >
                    Registrarse
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export { PublicFooter } from "./PublicFooter";