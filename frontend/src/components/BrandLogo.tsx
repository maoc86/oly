"use client";

import { useState } from "react";
import { useSiteConfig, isSet } from "@/lib/siteConfig";

/**
 * Logo de la marca. Prioridad:
 * 1. Logo subido desde el panel (Configuración → `company_logo`).
 * 2. El archivo `/public/brand/logo.png` del proyecto.
 * 3. Wordmark tipográfico "Oly." si no hay ningún logo disponible.
 */
export default function BrandLogo({
  variant = "dark",
  className = "h-8",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const { config } = useSiteConfig();
  const [error, setError] = useState(false);

  const src = isSet(config.company_logo) ? config.company_logo : "/brand/logo.png";

  if (error) {
    const textColor = variant === "dark" ? "text-white" : "text-ink-900";
    return (
      <span className={`inline-flex items-baseline font-black tracking-tight leading-none select-none ${className}`}>
        <span className={`text-xl sm:text-2xl uppercase ${textColor}`}>Oly</span>
        <span className="text-brand-500 text-xl sm:text-2xl">.</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={config.company_name || "Oly Official"}
      className={`w-auto object-contain ${className}`}
      onError={() => setError(true)}
    />
  );
}
