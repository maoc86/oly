import { api } from "@/lib/api";

const GUEST_TOKEN_KEY = "checkout_guest_token";

function getGuestToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

export async function startCheckoutAttempt(data: {
  event_id?: number | null;
  payment_method_id?: number | null;
  items?: any;
  estimated_total?: number | null;
}) {
  try {
    const guest_token = getGuestToken();
    return await api.post<any>("/checkout-attempts/start", { ...data, guest_token });
  } catch {
    return null;
  }
}

export async function updateCheckoutAttemptStep(
  id: number | null,
  data: {
    step?: string;
    payment_method_id?: number | null;
    items?: any;
    estimated_total?: number | null;
  }
) {
  if (!id) return null;
  try {
    return await api.patch<any>(`/checkout-attempts/${id}/step`, data);
  } catch {
    return null;
  }
}

export async function logCheckoutAttemptError(
  id: number | null,
  error_type: string,
  error_detail?: string
) {
  if (!id) return null;
  try {
    return await api.post<any>(`/checkout-attempts/${id}/error`, { error_type, error_detail });
  } catch {
    return null;
  }
}

export async function completeCheckoutAttempt(id: number | null, order_id: number) {
  if (!id) return null;
  try {
    return await api.post<any>(`/checkout-attempts/${id}/complete`, { order_id });
  } catch {
    return null;
  }
}
