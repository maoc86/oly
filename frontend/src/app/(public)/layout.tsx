import { Suspense } from "react";
import Navbar, { PublicFooter } from "@/components/Navbar";
import { RegistrationSuccessBanner } from "@/components/ui/feedback";
import { CurrencyProvider } from "@/lib/currency";
import { CartProvider } from "@/lib/cart";
import { SiteConfigProvider } from "@/lib/siteConfig";
import MaintenanceGuard from "@/components/MaintenanceGuard";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteConfigProvider>
        <MaintenanceGuard>
          <CurrencyProvider>
            <CartProvider>
              <Suspense fallback={null}>
                <RegistrationSuccessBanner />
              </Suspense>
              <Navbar />
              <main className="flex-1">{children}</main>
              <PublicFooter />
            </CartProvider>
          </CurrencyProvider>
        </MaintenanceGuard>
      </SiteConfigProvider>
    </div>
  );
}