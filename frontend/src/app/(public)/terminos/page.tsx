import type { Metadata } from "next";
import TerminosContent from "./TerminosContent";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Conocé las reglas de uso de la plataforma y las condiciones para la compra de entradas.",
};

export default function TerminosPage() {
  return <TerminosContent />;
}
