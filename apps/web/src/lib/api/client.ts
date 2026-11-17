import "server-only";
import { env } from "@/lib/env";

/**
 * Klien BFF untuk `apps/api` (ADR-013).
 *
 * Kenapa lewat server, bukan browser:
 * - Browser hanya bicara ke domain web (cookie sesi, CSRF, rate limit tetap satu pintu).
 * - Kredensial internal & alamat `apps/api` tidak pernah terekspos ke klien.
 * - Bentuk error mengikuti envelope kanonik ADR-010, jadi komponen UI punya satu cara baca error.
 *
 * Pemakaian (hanya dari route handler / server component):
 *   const meta = await apiFetch<Meta>("/api/v1/meta");
 */

export type ApiEnvelope = {
  error?: { code?: string; message?: string; details?: unknown; requestId?: string };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(message: string, opts: { status: number; code: string; requestId?: string; details?: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.details = opts.details;
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Diteruskan ke apps/api agar satu requestId muncul di log kedua layanan. */
  requestId?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export type ApiRawResponse<T> = {
  status: number;
  /** Header `set-cookie` dari apps/api, siap diteruskan ke browser apa adanya. */
  setCookies: string[];
  data: T;
};

/**
 * Sama seperti `apiFetch`, tetapi mengembalikan header respons juga.
 *
 * Dibutuhkan oleh route yang menerbitkan cookie (login/logout): cookie harus datang dari
 * `apps/api` supaya hanya ada satu sumber kebenaran sesi, bukan dirakit ulang di Next.
 */
export async function apiFetchRaw<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiRawResponse<T>> {
  const { method = "GET", body, requestId, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = options;
  const base = env().API_INTERNAL_URL.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(requestId ? { "x-request-id": requestId } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      // Server-to-server: jangan pernah cache di Next.
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiClientError(
      aborted ? `apps/api tidak merespons dalam ${timeoutMs}ms` : "apps/api tidak dapat dihubungi",
      { status: 503, code: aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE" },
    );
  } finally {
    clearTimeout(timer);
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

  const raw = await response.text();
  let payload: unknown = undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as ApiEnvelope;
    const upstream = envelope.error;
    throw new ApiClientError(upstream?.message || `apps/api gagal (HTTP ${response.status})`, {
      status: response.status,
      code: upstream?.code || `HTTP_${response.status}`,
      requestId: upstream?.requestId || response.headers.get("x-request-id") || requestId,
      details: upstream?.details,
    });
  }

  return { status: response.status, setCookies, data: payload as T };
}

/**
 * Unduh biner dari `apps/api` (PDF tiket) tanpa melewati parser JSON.
 *
 * `apiFetchRaw` sengaja hanya menangani JSON: memaksa biner lewat sana akan mengubah byte PDF
 * menjadi string dan merusak berkas. Header yang dibutuhkan untuk streaming (filename, panjang)
 * ikut dikembalikan supaya route proxy tidak perlu menebak.
 */
export async function apiFetchBinary(
  path: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<{ bytes: Uint8Array; contentType: string; filename: string | null }> {
  const { timeoutMs = 15_000, headers = {} } = options;
  const base = env().API_INTERNAL_URL.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/pdf", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiClientError(
      aborted ? `apps/api tidak merespons dalam ${timeoutMs}ms` : "apps/api tidak dapat dihubungi",
      { status: 503, code: aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE" },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Error dari API tetap envelope JSON walau endpoint sukses mengembalikan PDF.
    const raw = await response.text();
    let message = `apps/api gagal (HTTP ${response.status})`;
    let code = `HTTP_${response.status}`;
    try {
      const envelope = JSON.parse(raw) as ApiEnvelope;
      message = envelope.error?.message || message;
      code = envelope.error?.code || code;
    } catch {
      // bukan JSON (mis. 502 dari proxy) — pertahankan pesan generik
    }
    throw new ApiClientError(message, {
      status: response.status,
      code,
      requestId: response.headers.get("x-request-id") ?? undefined,
    });
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/pdf",
    filename: match?.[1] ?? null,
  };
}

/** Pembungkus tipis: hanya butuh body, bukan header. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { data } = await apiFetchRaw<T>(path, options);
  return data;
}
