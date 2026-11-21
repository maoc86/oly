import Link from "next/link";
import { PackageSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf7f2] text-center px-4">
      <span className="inline-grid place-items-center w-20 h-20 rounded-2xl bg-gray-100 text-gray-400">
        <PackageSearch className="w-10 h-10" />
      </span>
      <h1 className="mt-6 text-5xl font-black text-gray-900">404</h1>
      <p className="mt-2 text-lg text-gray-500">Página no encontrada</p>
      <p className="mt-1 text-sm text-gray-400">La página que buscas no existe o fue movida.</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
