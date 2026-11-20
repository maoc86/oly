const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Captura y persiste los parámetros UTM de la URL para atribución de campañas.
function getUtmHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("utm_source");
    const med = params.get("utm_medium");
    const camp = params.get("utm_campaign");
    const content = params.get("utm_content");
    const term = params.get("utm_term");
    // Persistir en sessionStorage si vienen en la URL.
    if (src) sessionStorage.setItem("utm_source", src);
    if (med) sessionStorage.setItem("utm_medium", med);
    if (camp) sessionStorage.setItem("utm_campaign", camp);
    if (content) sessionStorage.setItem("utm_content", content);
    if (term) sessionStorage.setItem("utm_term", term);
    const headers: Record<string, string> = {};
    const s = src || sessionStorage.getItem("utm_source");
    const m = med || sessionStorage.getItem("utm_medium");
    const c = camp || sessionStorage.getItem("utm_campaign");
    const ct = content || sessionStorage.getItem("utm_content");
    const t = term || sessionStorage.getItem("utm_term");
    if (s) headers["X-UTM-Source"] = s;
    if (m) headers["X-UTM-Medium"] = m;
    if (c) headers["X-UTM-Campaign"] = c;
    if (ct) headers["X-UTM-Content"] = ct;
    if (t) headers["X-UTM-Term"] = t;
    return headers;
  } catch {
    return {};
  }
}

/**
 * Convierte el cuerpo de error de FastAPI en un mensaje legible.
 * detail puede ser un string (errores de negocio) o un array (validación 422).
 */
export function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const item = entry as { loc?: unknown[]; msg?: string };
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((x) => x !== "body" && x !== "query" && x !== "path").join(" → ")
          : "";
        return [loc, item.msg].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}

// Endpoints de autenticación que no deben intentar renovar el token (un 401 ahí
// significa credenciales/refresh inválidos, no un access token vencido).
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// Evita disparar varios refresh en paralelo: se comparte la misma promesa.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Pide un par nuevo (access + refresh) usando el refresh token guardado.
 * Devuelve el access token nuevo, o null si no se pudo renovar.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { access_token?: string; refresh_token?: string; user?: unknown }
      | null;
    if (!data?.access_token) return null;
    localStorage.setItem("token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
    // Avisa al AuthProvider para que actualice el snapshot en memoria (token y
    // roles/permisos) sin recargar la página.
    window.dispatchEvent(
      new CustomEvent("auth:refreshed", {
        detail: { token: data.access_token, user: data.user ?? null },
      })
    );
    return data.access_token;
  } catch {
    return null;
  }
}

/** Evita refrescos simultáneos: comparte la misma promesa en vuelo. */
function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Limpia la sesión y manda al login (salvo que ya estemos ahí). */
function clearSessionAndRedirect() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("refresh_token");
  if (window.location.pathname !== "/login") {
    const target = window.location.pathname + window.location.search;
    // Recarga completa para que el AuthProvider relea el storage (sesión limpia).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?redirect=${encodeURIComponent(target)}`;
  }
}

// Rutas donde no tiene sentido intentar renovar el token con el refresh token.
async function fetchAPI<T>(
  path: string,
  options: RequestInit = {},
  canRetry = true
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    ...getUtmHeaders(),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Intenta de nuevo.");
  }

  // Token de acceso vencido: intentamos renovarlo con el refresh token y reintentar
  // una vez. Solo cerramos la sesión si el refresh tampoco sirve.
  if (
    res.status === 401 &&
    canRetry &&
    !NO_REFRESH_PATHS.some((p) => path.startsWith(p))
  ) {
    const newToken = await refreshOnce();
    if (newToken) {
      return fetchAPI<T>(path, options, false);
    }
    clearSessionAndRedirect();
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error del servidor" }));
    throw new Error(errorMessage(error, `Error ${res.status}`));
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => fetchAPI<T>(path),
  post: <T>(path: string, body?: unknown) =>
    fetchAPI<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    fetchAPI<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    fetchAPI<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => fetchAPI<T>(path, { method: "DELETE" }),
  download: async (path: string, filename: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}${path}`, { headers }).catch(() => {
      throw new Error("No se pudo conectar con el servidor. Intenta de nuevo.");
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Error al descargar" }));
      throw new Error(errorMessage(error, `Error ${res.status}`));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  upload: async <T = { url: string }>(path: string, file: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form })
      .catch(() => {
        throw new Error("No se pudo conectar con el servidor. Intenta de nuevo.");
      });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Error al subir la imagen" }));
      throw new Error(errorMessage(error, `Error ${res.status}`));
    }
    return res.json() as Promise<T>;
  },
};

