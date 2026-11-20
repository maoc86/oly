"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { subscribeToasts, getToasts, getToastsServer, type ToastItem } from "@/lib/toast";
import {
  subscribeConfirm, getConfirmSnapshot, getConfirmServerSnapshot, closeConfirm,
} from "@/lib/confirm";

const TOAST_STYLES: Record<ToastItem["type"], { icon: typeof Info; cls: string; bar: string }> = {
  success: { icon: CheckCircle2, cls: "text-emerald-700", bar: "bg-emerald-500" },
  error: { icon: XCircle, cls: "text-red-700", bar: "bg-red-500" },
  info: { icon: Info, cls: "text-gray-700", bar: "bg-brand-500" },
};

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToastsServer);

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const s = TOAST_STYLES[t.type];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            className="relative flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg p-4 overflow-hidden"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.cls}`} />
            <p className="text-sm text-gray-800">{t.message}</p>
          </div>
        );
      })}
    </div>
  );
}

// Mensaje de registro exitoso. Vive en el layout para sobrevivir a la
// redirección (/?registered=1) y se anuncia a lectores de pantalla con role=status.
export function RegistrationSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (searchParams.get("registered") !== "1") return null;

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("registered");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-full max-w-md px-4">
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-lg p-4"
      >
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm font-medium flex-1">Cuenta creada correctamente</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar mensaje"
          className="text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ConfirmHost() {
  const state = useSyncExternalStore(subscribeConfirm, getConfirmSnapshot, getConfirmServerSnapshot);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => closeConfirm(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900">{state.title ?? "Confirmar"}</h3>
        <p className="text-sm text-gray-600 mt-2">{state.message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => closeConfirm(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            {state.cancelLabel ?? "Cancelar"}
          </button>
          <button
            onClick={() => closeConfirm(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              state.danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-brand-500 text-ink-900 hover:bg-brand-400"
            }`}
          >
            {state.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
