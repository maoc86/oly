"use client";

import { useSiteConfig } from "@/lib/siteConfig";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Wrench } from "lucide-react";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { config } = useSiteConfig();
  const auth = useAuth();
  const router = useRouter();

  const maintenance = Boolean((config as any).maintenance_mode);
  const isAdmin = auth.isAdmin;
  const isMaintenanceRoute = typeof window !== "undefined" && window.location.pathname === "/mantenimiento";

  // Si el admin está logueado, nunca bloquear.
  if (maintenance && !isAdmin && !isMaintenanceRoute) {
    const msg = (config as any).maintenance_message || "Estamos realizando mejoras. Volvemos pronto.";
    const eta = Number((config as any).maintenance_eta || 0);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 text-white px-4">
        <div className="max-w-md text-center">
          <div className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30 mb-6">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">En mantenimiento</h1>
          <p className="mt-4 text-white/80 text-base leading-relaxed">{msg}</p>
          {eta > 0 && (
            <p className="mt-6 text-sm text-white/60">
              Tiempo estimado de regreso: <span className="font-mono font-bold text-brand-300">{eta} min</span>
            </p>
          )}
          <p className="mt-8 text-xs text-white/40">
            Si sos administrador, podés ingresar al{" "}
            <a href="/admin" className="text-brand-300 hover:underline">panel de administración</a>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
