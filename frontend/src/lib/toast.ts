export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): ToastItem[] {
  return toasts;
}

const emptyToasts: ToastItem[] = [];

function getServerSnapshot(): ToastItem[] {
  return emptyToasts;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, type: ToastType = "info") {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  emit();
  setTimeout(() => dismiss(id), 4500);
}

export function toastSuccess(message: string) {
  toast(message, "success");
}

export function toastError(message: string) {
  toast(message, "error");
}

export { subscribe as subscribeToasts, getSnapshot as getToasts, getServerSnapshot as getToastsServer };
