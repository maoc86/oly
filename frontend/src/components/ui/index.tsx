"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "light";
}) {
  const styles = {
    primary: "bg-brand-500 text-ink-900 hover:bg-brand-400",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "text-gray-600 hover:bg-gray-100",
    light: "bg-white text-brand-800 shadow-sm hover:bg-brand-50",
  }[variant];

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
        {...props}
      />
    </div>
  );
}

export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <textarea
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
        {...props}
      />
    </div>
  );
}

export function Select({
  label,
  options,
  placeholder = "Seleccionar...",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: { value: string | number; label: string }[];
  /** Texto de la opción vacía. `null` para no mostrar opción vacía. */
  placeholder?: string | null;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
        {...props}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Pila de modales abiertos: solo el superior responde a Escape (evita cerrar
// varios a la vez cuando hay un modal encima de otro).
const modalStack: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  size = "lg",
  fullScreenOnMobile = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
  /** En móvil ocupa toda la pantalla: útil para mapas de asientos anchos. */
  fullScreenOnMobile?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // `onClose` va en un ref para no re-ejecutar el efecto en cada render: si el
  // efecto dependiera de `onClose` (una función nueva por render), al escribir en
  // un input se volvería a enfocar el diálogo y el campo perdería el foco.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Cierre con Escape + bloqueo del scroll de fondo mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    modalStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === id) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      const index = modalStack.indexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!open) return null;

  // Mantiene el foco dentro del modal al tabular.
  function handleTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const focusables = nodes ? Array.from(nodes).filter((el) => el.offsetParent !== null) : [];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const sizeClass = {
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
  }[size];
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${fullScreenOnMobile ? "p-0 sm:p-4" : "p-4"}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleTab}
        className={`relative bg-white shadow-2xl ring-1 ring-black/5 ${sizeClass} w-full flex flex-col overflow-hidden focus:outline-none ${
          fullScreenOnMobile ? "max-h-[100dvh] rounded-none sm:max-h-[90vh] sm:rounded-2xl" : "max-h-[90vh] rounded-2xl"
        }`}
      >
        <div className={`flex-shrink-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white/95 backdrop-blur border-b border-gray-200 ${fullScreenOnMobile ? "rounded-none sm:rounded-t-2xl" : "rounded-t-2xl"}`}>
          <h3 className="text-lg font-bold text-gray-900 truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-800",
    finished: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    admin: "bg-accent-100 text-accent-800",
    user: "bg-gray-100 text-gray-800",
  };
  const label: Record<string, string> = {
    published: "Publicado",
    draft: "Borrador",
    finished: "Finalizado",
    cancelled: "Cancelado",
    completed: "Completada",
    pending: "Pendiente",
    admin: "Admin",
    user: "Usuario",
  };
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {label[status] || status}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <p>{message}</p>
    </div>
  );
}

export function Spinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }[size];
  return (
    <svg
      className={`animate-spin text-brand-600 ${dim} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
