import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const BASE = "http://api.test";

async function loadClient() {
  vi.resetModules();
  process.env.API_INTERNAL_URL = BASE;
  return import("@/lib/api/client");
}

describe("BFF apiFetch (ADR-013)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_INTERNAL_URL;
  });

  it("mengembalikan JSON domain apa adanya saat 200", async () => {
    const { apiFetch } = await loadClient();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ service: "tfn-api", version: "1.0.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const meta = await apiFetch<{ service: string }>("/api/v1/meta");
    expect(meta.service).toBe("tfn-api");
  });

  it("tidak menambahkan prefix ganda pada base URL berakhiran slash", async () => {
    const { apiFetch } = await loadClient();
    process.env.API_INTERNAL_URL = `${BASE}/`;
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await apiFetch("/api/v1/meta");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(`${BASE}/api/v1/meta`);
  });

  it("melempar ApiClientError dengan code + requestId dari envelope ADR-010", async () => {
    const { apiFetch, ApiClientError } = await loadClient();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "NOT_FOUND", message: "Route tidak ditemukan", details: null, requestId: "req-123" },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    const error = await apiFetch("/tidak-ada").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 404, code: "NOT_FOUND", requestId: "req-123" });
  });

  it("memakai HTTP_<status> bila upstream tidak mengirim envelope", async () => {
    const { apiFetch } = await loadClient();
    vi.mocked(fetch).mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));

    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 502, code: "HTTP_502" });
  });

  it("menerjemahkan kegagalan jaringan jadi 503 UPSTREAM_UNREACHABLE", async () => {
    const { apiFetch } = await loadClient();
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 503, code: "UPSTREAM_UNREACHABLE" });
  });

  it("menerjemahkan timeout jadi 503 UPSTREAM_TIMEOUT", async () => {
    const { apiFetch } = await loadClient();
    vi.mocked(fetch).mockImplementation(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 503, code: "UPSTREAM_TIMEOUT" });
  });

  it("meneruskan x-request-id ke upstream", async () => {
    const { apiFetch } = await loadClient();
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await apiFetch("/api/v1/meta", { requestId: "req-abc" });
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-request-id"]).toBe("req-abc");
  });
});
