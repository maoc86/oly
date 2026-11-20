import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Toaster, ConfirmHost } from "@/components/ui/feedback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Oly Official";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://olyofficial.com";
const SITE_TITLE = "Oly Official — Ropa deportiva para mujeres";
const SITE_DESCRIPTION =
  "Ropa deportiva para mujeres que entrenan sin límites. Leggings, tops, conjuntos y más. Compra online con envío a toda Venezuela.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["ropa deportiva", "mujer", "leggings", "fitness", "oly", SITE_NAME],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#120f0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#faf7f2]">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
