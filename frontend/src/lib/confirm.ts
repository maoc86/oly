export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let current: ConfirmState | null = null;
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

function getSnapshot(): ConfirmState | null {
  return current;
}

function getServerSnapshot(): ConfirmState | null {
  return null;
}

/** Abre un diálogo de confirmación propio y devuelve la decisión del usuario. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    current = { ...opts, resolve };
    emit();
  });
}

export function closeConfirm(result: boolean) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(result);
}

export { subscribe as subscribeConfirm, getSnapshot as getConfirmSnapshot, getServerSnapshot as getConfirmServerSnapshot };
