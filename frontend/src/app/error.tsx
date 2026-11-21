"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen flex items-center justify-center bg-[#faf7f2] font-sans">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-bold text-gray-900">Algo salió mal</h2>
          <p className="mt-2 text-gray-500">
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          {error?.digest && (
            <p className="mt-1 text-xs text-gray-400">Referencia: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
