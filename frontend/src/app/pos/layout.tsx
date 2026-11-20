"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart, Wallet, Receipt, Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import BrandLogo from "@/components/BrandLogo";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { isVendedor, isAdmin, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user && !isVendedor && !isAdmin) router.push("/");
  }, [user, isVendedor, isAdmin, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/login?redirect=/pos" className="px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold">Iniciar sesión</Link>
      </div>
    );
  }

  const nav = [
    { href: "/pos", label: "Vender", icon: ShoppingCart },
    { href: "/pos/caja", label: "Caja", icon: Wallet },
    { href: "/pos/ventas", label: "Ventas", icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-ink-950 text-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
          <BrandLogo variant="dark" className="h-9" />
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    active ? "bg-brand-600 text-white" : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            href="/"
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 border border-white/10 hover:bg-white/5 hover:text-white transition-colors"
            title="Volver a la tienda"
          >
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Volver a la tienda</span>
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
