"use client";

import { useEffect, useState } from "react";
import { useSiteConfig } from "@/lib/siteConfig";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  const { config } = useSiteConfig();
  const message = (config as any).maintenance_message || "Estamos realizando mejoras. Volvemos pronto.";
  const eta = Number((config as any).maintenance_eta || 0);

  const [remaining, setRemaining] = useState(eta * 60);

  useEffect(() => {
    if (eta <= 0) return;
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [eta]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 text-white px-4">
      <div className="max-w-md text-center">
        <div className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30 mb-6">
          <Wrench className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">En mantenimiento</h1>
        <p className="mt-4 text-white/80 text-base leading-relaxed">{message}</p>
        {eta > 0 && remaining > 0 && (
          <p className="mt-6 text-sm text-white/60">
            Tiempo estimado de regreso:{" "}
            <span className="font-mono font-bold text-brand-300">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
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
