"use client";

import Link from "next/link";
import {
  ArrowUp, Mail, Phone, MapPin, MessageCircle,
} from "lucide-react";
import { useSiteConfig, isSet } from "@/lib/siteConfig";
import { useAuth } from "@/lib/auth";
import BrandLogo from "@/components/BrandLogo";

const SOCIAL_PATHS: Record<string, string> = {
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.2.8-.4.3-.6.7-.8 1.2-.2.4-.3 1-.4 2.1C2.7 9.8 2.7 10.2 2.7 12s0 2.2.1 3.4c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.2.3.4.7.6 1.2.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.2-.8.4-.3.6-.7.8-1.2.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.4s0-2.2-.1-3.4c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.2-.3-.4-.7-.6-1.2-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a5 5 0 110 10 5 5 0 010-10zm0 8.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zm6-8.4a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z",
  x: "M17.5 3h3l-6.6 7.5L21.8 21h-5.9l-4.6-6-5.3 6H3l7-8L2.5 3h6l4.2 5.5L17.5 3zm-1 16h1.7L7.6 4.7H5.8L16.5 19z",
  facebook:
    "M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.5V13h2.8v8h3.2z",
  tiktok:
    "M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
};

function SocialLinks({
  config,
  className = "",
  iconClass = "w-4 h-4",
}: {
  config: { social_instagram: string; social_facebook: string; social_tiktok: string; social_x: string };
  className?: string;
  iconClass?: string;
}) {
  const links = [
    { key: "social_instagram", icon: "instagram", label: "Instagram" },
    { key: "social_tiktok", icon: "tiktok", label: "TikTok" },
    { key: "social_facebook", icon: "facebook", label: "Facebook" },
    { key: "social_x", icon: "x", label: "X" },
  ].filter((l) => isSet(config[l.key as keyof typeof config]));

  if (links.length === 0) return null;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {links.map((l) => (
        <a
          key={l.key}
          href={config[l.key as keyof typeof config]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          className="grid place-items-center w-9 h-9 rounded-full bg-white/5 text-gray-400 hover:bg-gradient-to-br hover:from-brand-500 hover:to-accent-500 hover:text-white transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
            <path d={SOCIAL_PATHS[l.icon]} />
          </svg>
        </a>
      ))}
    </div>
  );
}

export function PublicFooter() {
  const { config } = useSiteConfig();
  const { isAdmin, isVendedor } = useAuth();
  const year = new Date().getFullYear();

  const contacto = [
    { id: "email", icon: Mail, value: config.company_email, href: `mailto:${config.company_email}` },
    { id: "phone", icon: Phone, value: config.company_phone, href: `tel:${config.company_phone}` },
    {
      id: "whatsapp",
      icon: MessageCircle,
      value: config.company_whatsapp,
      href: config.company_whatsapp ? `https://wa.me/${config.company_whatsapp.replace(/\D/g, "")}` : "",
    },
    { id: "address", icon: MapPin, value: config.company_address, href: "" },
  ].filter((c) => isSet(c.value));

  const enlaces = [
    { label: "Ver productos", href: "/productos" },
    { label: "Mis pedidos", href: "/pedidos" },
    { label: "Términos y condiciones", href: "/terminos" },
  ];

  const cuenta = [
    ...(isVendedor
      ? [{ label: "Punto de venta", href: "/pos" }]
      : []),
    ...(isAdmin
      ? [{ label: "Panel de administración", href: "/admin" }]
      : []),
    { label: "Iniciar sesión", href: "/login" },
    { label: "Registrarse", href: "/registro" },
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-ink-950 text-gray-400">
      <div className="border-t border-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 lg:pt-16 pb-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center" aria-label={config.company_name || "Oly Official"}>
              <BrandLogo variant="dark" className="h-8" />
            </Link>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-sm">
              {config.footer_text}
            </p>
            <SocialLinks config={config} className="mt-6" />
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Enlaces
            </h3>
            <ul className="mt-5 space-y-3.5 text-sm">
              {enlaces.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="h-px w-4 bg-brand-500 group-hover:w-6 transition-all duration-200" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Cuenta
            </h3>
            <ul className="mt-5 space-y-3.5 text-sm">
              {cuenta.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="h-px w-4 bg-brand-500 group-hover:w-6 transition-all duration-200" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Contacto
            </h3>
            {contacto.length === 0 ? (
              <p className="mt-5 text-sm text-gray-500">Sin datos de contacto configurados.</p>
            ) : (
              <ul className="mt-5 space-y-4 text-sm">
                {contacto.map((c) => (
                  <li key={c.id}>
                    {c.href ? (
                      <a
                        href={c.href}
                        className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
                      >
                        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-white/5 text-gray-400">
                          <c.icon className="w-4 h-4" />
                        </span>
                        <span className="break-all">{c.value}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-3">
                        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-white/5 text-gray-400">
                          <c.icon className="w-4 h-4" />
                        </span>
                        <span className="break-all">{c.value}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>
            © {year} {config.company_name}. Todos los derechos reservados.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Volver arriba"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-brand-400 transition-colors"
          >
            Volver arriba
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
