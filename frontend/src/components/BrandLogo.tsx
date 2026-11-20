"use client";

import { useSiteConfig, isSet } from "@/lib/siteConfig";

/**
 * Logo de la marca. Si el admin subió un logo en Configuración se usa ese;
 * si no, se muestra un wordmark tipográfico de Oly.
 */
export default function BrandLogo({
  variant = "dark",
  className = "h-8",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const { config } = useSiteConfig();
  const src = isSet(config.company_logo) ? config.company_logo : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={config.company_name || "Oly Official"} className={`w-auto object-contain ${className}`} />
    );
  }

  const textColor = variant === "dark" ? "text-white" : "text-ink-900";
  return (
    <span className={`inline-flex items-baseline font-black tracking-tight leading-none select-none ${className}`}>
      <span className={`text-xl sm:text-2xl uppercase ${textColor}`}>Oly</span>
      <span className="text-brand-500 text-xl sm:text-2xl">.</span>
    </span>
  );
}
