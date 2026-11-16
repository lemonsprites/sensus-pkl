const TOKEN_KEY = "sensus.token";

export const tokenStore = {
  get: (): string | null => {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // localStorage bisa diblokir (private mode) — sesi tetap jalan di memori.
    }
  },
  clear: (): void => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // abaikan
    }
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!response.ok || payload?.success === false) {
    if (response.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new ApiError(
      payload?.error?.message ?? `Permintaan gagal (HTTP ${response.status})`,
      response.status,
      payload?.error?.code,
      payload?.error?.details,
    );
  }

  return payload?.data as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  return readEnvelope<T>(response);
}

/** Upload multipart (import SIMAN). */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  return readEnvelope<T>(response);
}

/** Download biner (export CSV/XLSX) dengan Authorization Bearer. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = tokenStore.get();
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    let message = `Unduhan gagal (HTTP ${response.status})`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // abaikan
    }
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? "unduhan" };
}
