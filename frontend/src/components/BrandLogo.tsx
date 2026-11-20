"use client";

import { useSiteConfig, isSet } from "@/lib/siteConfig";

const FALLBACK = {
  // Variante con letras blancas: para superficies oscuras (navbar, footer).
  dark: "/brand/logo-ticketv-on-dark.png",
  // Variante con letras negras: para superficies claras.
  light: "/brand/logo-ticketv-on-light.png",
};

/**
 * Logo de la marca. Si el admin subió un logo en Configuración se usa ese;
 * si no, cae al asset por defecto de TicketV según la superficie donde va.
 */
export default function BrandLogo({
  variant = "dark",
  className = "h-8",
}: {
  /** Fondo sobre el que se apoya el logo. */
  variant?: "dark" | "light";
  /** Alto del logo (clases de Tailwind). */
  className?: string;
}) {
  const { config } = useSiteConfig();
  const src = isSet(config.company_logo) ? config.company_logo : FALLBACK[variant];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={config.company_name || "TicketV"}
      className={`w-auto object-contain ${className}`}
    />
  );
}
