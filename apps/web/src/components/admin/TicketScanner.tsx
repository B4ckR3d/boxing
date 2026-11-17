"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, CheckCircle2, ScanLine, ShieldAlert, Ticket, XCircle } from "lucide-react";
import { checkInTicketAction, type CheckInActionResult } from "@/app/admin/(dashboard)/ticketing/scan/actions";

type EventOption = { id: string; name: string; startsAt: string };

type LogEntry = { id: number; ok: boolean; title: string; detail: string; at: string };

/** Minimal shape of the (Chromium-only) BarcodeDetector API — no extra dependency. */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));

export default function TicketScanner({ events }: { events: EventOption[] }) {
  const [code, setCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [outcome, setOutcome] = useState<CheckInActionResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pending, startTransition] = useTransition();
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on" | "unsupported" | "denied">("off");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState("off");
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submit = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value || pending) return;
      startTransition(async () => {
        const result = await checkInTicketAction(value, eventId || null);
        setOutcome(result);
        setCode("");
        setLog((prev) =>
          [
            {
              id: Date.now(),
              ok: result.ok,
              title: result.ok ? result.result.orderNumber : "Ditolak",
              detail: result.ok
                ? `${result.result.customerName} · ${result.result.seats} tiket · ${result.result.method}`
                : result.error,
              at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 8),
        );
        // Keep the field hot: the next person is already at the gate.
        inputRef.current?.focus();
      });
    },
    [eventId, pending],
  );

  const startCamera = useCallback(async () => {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setCameraState("unsupported");
      return;
    }
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Ctor({ formats: ["qr_code"] });
      setCameraState("on");

      const tick = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes[0]?.rawValue?.trim();
          if (hit) {
            stopCamera();
            submit(hit);
            return;
          }
        } catch {
          /* transient decode failure — keep looping */
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setCameraState("denied");
    }
  }, [stopCamera, submit]);

  const success = outcome?.ok ? outcome.result : null;

  return (
    <div className="space-y-6">
      <section className="border border-border-subtle bg-charcoal p-4 sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(code);
          }}
          className="space-y-4"
        >
          <label htmlFor="ticket-code" className="block font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Kode tiket (scan QR atau ketik nomor pesanan)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="ticket-code"
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="TFN1.… atau TFN-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              className="h-12 flex-1 border border-border-subtle bg-canvas px-3 font-mono-data text-sm uppercase tracking-wide text-ink placeholder:normal-case placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || code.trim().length === 0}
              className="inline-flex h-12 items-center justify-center gap-2 bg-fight-red px-5 font-mono-data text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              {pending ? "Memeriksa…" : "Check-in"}
            </button>
            <button
              type="button"
              onClick={() => (cameraState === "on" ? stopCamera() : void startCamera())}
              className="inline-flex h-12 items-center justify-center gap-2 border border-border-subtle px-4 font-mono-data text-[11px] uppercase tracking-[0.15em] text-ink-muted transition-colors hover:border-fight-red hover:text-ink"
            >
              {cameraState === "on" ? <CameraOff className="h-4 w-4" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
              {cameraState === "on" ? "Stop kamera" : "Kamera"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="event-scope" className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
              Batasi ke event
            </label>
            <select
              id="event-scope"
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="h-9 border border-border-subtle bg-canvas px-2 text-xs text-ink focus:border-fight-red focus:outline-none"
            >
              <option value="">Semua event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            {cameraState === "unsupported" && (
              <span className="text-xs text-ink-muted">Browser ini tidak mendukung kamera QR. Gunakan scanner USB atau ketik manual.</span>
            )}
            {cameraState === "denied" && <span className="text-xs text-fight-red">Izin kamera ditolak.</span>}
            {cameraState === "starting" && <span className="text-xs text-ink-muted">Menyalakan kamera…</span>}
          </div>
        </form>

        <video
          ref={videoRef}
          muted
          playsInline
          className={`mt-4 aspect-video w-full max-w-md border border-border-subtle bg-black object-cover ${cameraState === "on" ? "" : "hidden"}`}
        />
      </section>

      {outcome && !outcome.ok && (
        <section role="alert" className="border-l-2 border-fight-red bg-fight-red/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-fight-red" aria-hidden="true" />
            <div>
              <p className="font-display text-lg font-black uppercase tracking-tight text-ink">Jangan izinkan masuk</p>
              <p className="mt-1 text-sm text-ink">{outcome.error}</p>
              {outcome.code && (
                <p className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">kode: {outcome.code}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {success && (
        <section aria-live="polite" className="border-l-2 border-emerald-500 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-black uppercase tracking-tight text-ink">Silakan masuk</p>
              <p className="mt-1 truncate font-mono-data text-sm text-ink">{success.orderNumber}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {success.customerName} · {success.seats} tiket
                {success.method === "MANUAL" ? " · input manual" : " · QR terverifikasi"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {success.categories.map((category) => (
                  <span
                    key={category.name}
                    className="inline-flex items-center gap-1 border border-border-subtle px-2 py-1 font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink-muted"
                  >
                    <Ticket className="h-3 w-3" aria-hidden="true" />
                    {category.name} × {category.quantity}
                  </span>
                ))}
              </div>
              <p className="mt-3 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                {success.eventName} · check-in {timeLabel(success.checkedInAt)} WIB
              </p>
            </div>
          </div>
        </section>
      )}

      {log.length > 0 && (
        <section aria-label="Riwayat scan sesi ini" className="border border-border-subtle">
          <header className="border-b border-border-subtle bg-charcoal px-4 py-2">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Riwayat sesi ini</p>
          </header>
          <ul className="divide-y divide-border-subtle">
            {log.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                {entry.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-fight-red" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono-data text-xs text-ink">{entry.title}</p>
                  <p className="truncate text-xs text-ink-muted">{entry.detail}</p>
                </div>
                <span className="font-mono-data text-[10px] text-ink-subtle">{timeLabel(entry.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
