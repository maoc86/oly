"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Ticket, Wallet, LayoutDashboard, LogOut, Menu, X, Home } from "lucide-react";
import { useAuth } from "@/lib/auth";
import BrandLogo from "@/components/BrandLogo";

const LINKS = [
  { href: "/organizador", label: "Mis eventos", icon: Ticket },
  { href: "/organizador/liquidaciones", label: "Liquidaciones", icon: Wallet },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isOrganizer, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isAuthenticated || (!isOrganizer && !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 mb-4">
            <Ticket className="w-6 h-6" />
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso restringido</h1>
          <p className="text-gray-600 mb-6">
            Esta sección es solo para organizadores. Si creás eventos y necesitás ver tus ventas,
            pedile a un administrador que asigne tu cuenta como organizador.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href={isAuthenticated ? "/" : "/login"}
              className="px-4 py-2 bg-brand-500 text-ink-900 rounded-lg font-semibold hover:bg-brand-400 transition-colors"
            >
              {isAuthenticated ? "Ir al inicio" : "Iniciar sesión"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-ink-950 text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/organizador" className="flex items-center gap-3 min-w-0" aria-label="TicketV">
              <BrandLogo variant="dark" className="h-7" />
              <span className="hidden md:inline text-xs text-gray-400 border-l border-white/15 pl-3 whitespace-nowrap">
                Panel del organizador
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
                      active
                        ? "bg-brand-500 text-ink-900 font-semibold"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <l.icon className="w-4 h-4" />
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Ver la web</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <span className="hidden sm:inline text-sm text-gray-400 max-w-[10rem] truncate">{user?.name}</span>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              aria-label="Cerrar sesión"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              className="sm:hidden p-2 -mr-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="sm:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-brand-500 text-ink-900 font-semibold"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <l.icon className="w-4 h-4" />
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              Ver la web
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
