"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, X, Check } from "lucide-react";
import { toast } from "sonner";
import { confirmTicketOrderAction, rejectTicketOrderAction } from "@/app/admin/(dashboard)/ticketing/actions";

type Props = {
  orderId: string;
  orderNumber: string;
};

/**
 * Server actions return `ActionResult` instead of throwing, so the UI must surface
 * `{ ok: false, error }`. The previous version discarded the result entirely and
 * failures looked like a page that simply never changed.
 */
export default function TicketOrderActions({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");

  function runConfirm() {
    startTransition(async () => {
      const result = await confirmTicketOrderAction(orderId);
      if (result.ok) {
        toast.success(`Pesanan ${orderNumber} dikonfirmasi`);
        router.refresh();
      } else {
        toast.error(result.error || "Gagal mengonfirmasi pesanan");
      }
    });
  }

  function runReject() {
    if (reason.trim().length < 3) {
      toast.error("Alasan penolakan minimal 3 karakter");
      return;
    }
    startTransition(async () => {
      const result = await rejectTicketOrderAction(orderId, reason.trim());
      if (result.ok) {
        toast.success(`Pesanan ${orderNumber} ditolak`);
        setMode("idle");
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Gagal menolak pesanan");
      }
    });
  }

  if (mode === "reject") {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <input
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Alasan penolakan (terlihat oleh admin)"
          maxLength={200}
          required
          className="h-9 min-w-48 flex-1 border border-border-subtle bg-canvas px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
        />
        <button
          type="button"
          onClick={runReject}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 border border-fight-red bg-fight-red px-3 font-display text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-fight-red-hover disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          Tolak
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("idle");
            setReason("");
          }}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1 border border-border-subtle px-2.5 font-mono-data text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-colors hover:border-ink-muted hover:text-ink disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Batal
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runConfirm}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 border border-fight-red bg-fight-red px-3.5 font-display text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-fight-red-hover disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        Konfirmasi
      </button>
      <button
        type="button"
        onClick={() => setMode("reject")}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1 border border-border-subtle px-3 font-mono-data text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-colors hover:border-fight-red hover:text-fight-red disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Tolak
      </button>
    </div>
  );
}
