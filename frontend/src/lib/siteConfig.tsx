"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export interface SiteConfig {
  company_name: string;
  company_logo: string;
  company_email: string;
  company_phone: string;
  company_whatsapp: string;
  company_address: string;
  footer_text: string;
  social_instagram: string;
  social_facebook: string;
  social_tiktok: string;
  social_x: string;
  announcement_text: string;
  announcement_link: string;
  announcement_active: boolean;
  hero_autoplay: boolean;
  hero_transition_seconds: number;
  hero_height: number;
  hero_overlay: number;
  tax_percent: number;
  show_breakdown: boolean;
  terms_url: string;
  free_shipping_threshold: number;
  max_items_per_order: number;
  min_order_total: number;
  max_order_total: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_eta: number;
}

export const DEFAULT_CONFIG: SiteConfig = {
  company_name: "Oly Official",
  company_logo: "",
  company_email: "hola@olyofficial.com",
  company_phone: "",
  company_whatsapp: "",
  company_address: "",
  footer_text: "Ropa deportiva para mujeres que entrenan sin límites.",
  social_instagram: "",
  social_facebook: "",
  social_tiktok: "",
  social_x: "",
  announcement_text: "",
  announcement_link: "",
  announcement_active: false,
  hero_autoplay: true,
  hero_transition_seconds: 6,
  hero_height: 560,
  hero_overlay: 35,
  tax_percent: 16,
  show_breakdown: true,
  terms_url: "/terminos",
  free_shipping_threshold: 0,
  max_items_per_order: 0,
  min_order_total: 0,
  max_order_total: 0,
  maintenance_mode: false,
  maintenance_message: "Estamos realizando mejoras. Volvemos pronto.",
  maintenance_eta: 0,
};

interface SiteConfigContextType {
  config: SiteConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
  refresh: async () => {},
});

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ values: Partial<SiteConfig> }>("/site-settings");
      setConfig({ ...DEFAULT_CONFIG, ...data.values });
    } catch {
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<{ values: Partial<SiteConfig> }>("/site-settings")
      .then((data) => setConfig({ ...DEFAULT_CONFIG, ...data.values }))
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, loading, refresh }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

/** Ahorra comprobaciones de vacío en la UI (logo, redes, teléfonos...). */
export function isSet(value: string | undefined | null) {
  return !!value && value.trim().length > 0;
}

/** Redondeo monetario a 2 decimales, igual que hace el backend. */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
