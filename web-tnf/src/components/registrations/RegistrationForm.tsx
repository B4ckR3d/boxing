"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BPJS_OPTIONS,
  CLASSES,
  DIVISIONS,
  FILE_RULES,
  RULES,
  formatIdr,
} from "@/lib/validation/registration";

interface FormValues {
  fullName: string;
  ringName: string;
  address: string;
  age: string;
  divisionLabel: string;
  rules: string;
  competitionClass: string;
  bpjsStatus: string;
  socialUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  xUrl: string;
  consentAccepted: boolean;
  website: string; // honeypot
}

const INITIAL: FormValues = {
  fullName: "",
  ringName: "",
  address: "",
  age: "",
  divisionLabel: "",
  rules: "",
  competitionClass: "",
  bpjsStatus: "",
  socialUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  xUrl: "",
  consentAccepted: false,
  website: "",
};

interface SubmitResult {
  code: string;
  ringName: string;
  divisionLabel: string;
  sheetPending: boolean;
}

const inputClass =
  "w-full bg-canvas border border-border-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-fight-red transition-colors disabled:opacity-60";

function Field({
  label,
  hint,
  error,
  required,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-mono-data text-[11px] uppercase tracking-widest text-ink-muted">
        {label} {required && <span className="text-fight-red">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-ink-subtle leading-relaxed">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-fight-red">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border-subtle bg-surface p-5 sm:p-7 space-y-5">
      <header className="space-y-1.5 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center bg-fight-red text-ink font-display text-sm font-black">
            {step}
          </span>
          <h2 className="font-display text-lg sm:text-xl uppercase font-black tracking-tight text-ink">{title}</h2>
        </div>
        {description && <p className="text-xs text-ink-muted leading-relaxed pl-9">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  columns?: 2 | 3;
}) {
  return (
    <div className="space-y-1.5">
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2.5 border px-3.5 py-2.5 text-sm transition-colors ${
                checked
                  ? "border-fight-red bg-fight-red/10 text-ink"
                  : "border-border-subtle bg-canvas text-ink-muted hover:border-ink-muted"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="h-3.5 w-3.5 accent-[var(--fight-red)]"
              />
              <span className="font-medium">{opt.label}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-fight-red">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function FileDrop({
  id,
  label,
  hint,
  accept,
  maxMb,
  file,
  error,
  onSelect,
  onClear,
}: {
  id: string;
  label: string;
  hint: string;
  accept: string;
  maxMb: number;
  file: File | null;
  error?: string;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <span className="block font-mono-data text-[11px] uppercase tracking-widest text-ink-muted">
        {label} <span className="text-fight-red">*</span>
      </span>

      {file ? (
        <div className="flex items-center justify-between gap-3 border border-fight-red/60 bg-fight-red/5 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <FileText className="h-4 w-4 shrink-0 text-fight-red" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{file.name}</p>
              <p className="font-mono-data text-[10px] text-ink-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-ink-muted hover:text-fight-red"
            aria-label={`Hapus ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 border border-dashed border-border-subtle bg-canvas px-4 py-6 text-center transition-colors hover:border-fight-red hover:bg-fight-red/5"
        >
          <Upload className="h-5 w-5 text-ink-muted" />
          <span className="text-sm text-ink">Klik untuk pilih file</span>
          <span className="text-[11px] text-ink-subtle">{hint}</span>
        </button>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          if (selected && selected.size > maxMb * 1024 * 1024) {
            onSelect(null);
            return;
          }
          onSelect(selected);
        }}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-fight-red">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

export function RegistrationForm({ feeIdr }: { feeIdr: number }) {
  const [values, setValues] = React.useState<FormValues>(INITIAL);
  const [paymentProof, setPaymentProof] = React.useState<File | null>(null);
  const [idDocument, setIdDocument] = React.useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const needsIdDocument = values.bpjsStatus === "TIDAK_AKTIF";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    if (values.fullName.trim().length < 3) errors.fullName = "Nama lengkap minimal 3 karakter";
    if (values.ringName.trim().length < 2) errors.ringName = "Nama fighter minimal 2 karakter";
    if (values.address.trim().length < 10) errors.address = "Alamat terlalu pendek";
    const age = Number(values.age);
    if (!values.age || Number.isNaN(age) || age < 15) errors.age = "Usia minimal 15 tahun";
    if (!values.divisionLabel) errors.divisionLabel = "Pilih divisi";
    if (!values.rules) errors.rules = "Pilih kategori rules";
    if (!values.competitionClass) errors.competitionClass = "Pilih kelas";
    if (!values.bpjsStatus) errors.bpjsStatus = "Pilih status BPJS";
    if (!paymentProof) errors.paymentProof = "Bukti transfer wajib diunggah";
    if (needsIdDocument && !idDocument) errors.idDocument = "KTP/KK wajib diunggah jika BPJS belum aktif";
    if (!values.consentAccepted) errors.consentAccepted = "Anda harus menyetujui pernyataan";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Periksa kembali data yang ditandai merah.");
      const first = document.querySelector<HTMLElement>("[data-error='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const body = new FormData();
      body.append("fullName", values.fullName.trim());
      body.append("ringName", values.ringName.trim());
      body.append("address", values.address.trim());
      body.append("age", values.age);
      body.append("divisionLabel", values.divisionLabel);
      body.append("rules", values.rules);
      body.append("competitionClass", values.competitionClass);
      body.append("bpjsStatus", values.bpjsStatus);
      if (values.socialUrl.trim()) body.append("socialUrl", values.socialUrl.trim());
      if (values.instagramUrl.trim()) body.append("instagramUrl", values.instagramUrl.trim());
      if (values.tiktokUrl.trim()) body.append("tiktokUrl", values.tiktokUrl.trim());
      if (values.facebookUrl.trim()) body.append("facebookUrl", values.facebookUrl.trim());
      if (values.xUrl.trim()) body.append("xUrl", values.xUrl.trim());
      body.append("consentAccepted", String(values.consentAccepted));
      body.append("website", values.website);
      if (paymentProof) body.append("paymentProof", paymentProof);
      if (idDocument) body.append("idDocument", idDocument);

      const response = await fetch("/api/public/registrations", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; fieldErrors?: Record<string, string>; data?: SubmitResult }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        if (payload?.fieldErrors) setFieldErrors(payload.fieldErrors);
        setFormError(payload?.error ?? "Pendaftaran gagal. Silakan coba lagi.");
        setSubmitting(false);
        return;
      }

      setResult(payload.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("Koneksi gagal. Periksa jaringan Anda lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl border border-fight-red/40 bg-surface p-6 sm:p-10 space-y-6 text-center">
        <div className="flex justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-fight-red/15">
            <CheckCircle2 className="h-7 w-7 text-fight-red" />
          </span>
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl sm:text-3xl uppercase font-black tracking-tight text-ink">
            Pendaftaran Terkirim
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Data <span className="text-ink font-semibold">{result.ringName}</span> ({result.divisionLabel}) sudah masuk
            ke sistem. Panitia akan memverifikasi bukti transfer terlebih dahulu.
          </p>
        </div>

        <div className="border border-border-subtle bg-canvas px-4 py-4">
          <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Kode Pendaftaran</p>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-black tracking-wider text-fight-red">{result.code}</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard tidak tersedia */
                }
              }}
              className="text-ink-muted transition-colors hover:text-ink"
              aria-label="Salin kode pendaftaran"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-subtle">
            Simpan kode ini. Tunjukkan ke panitia saat verifikasi di lokasi.
          </p>
        </div>

        <ol className="space-y-2 border border-border-subtle bg-canvas p-4 text-left text-xs text-ink-muted">
          <li className="flex gap-2">
            <span className="font-mono-data text-fight-red">1.</span> Admin memeriksa bukti transfer (status:{" "}
            <span className="text-amber-500">Menunggu Konfirmasi</span>).
          </li>
          <li className="flex gap-2">
            <span className="font-mono-data text-fight-red">2.</span> Setelah dana diterima, status berubah menjadi{" "}
            <span className="text-emerald-500">Terkonfirmasi</span> dan nama Anda masuk daftar peserta.
          </li>
          <li className="flex gap-2">
            <span className="font-mono-data text-fight-red">3.</span> Bawa KTP/KK asli dan konfirmasi ke panitia di
            hari pertandingan.
          </li>
        </ol>

        {result.sheetPending && (
          <p className="text-[11px] text-ink-subtle">
            Catatan: data Anda tersimpan aman. Sinkronisasi ke spreadsheet sedang ditunda dan akan diulang otomatis
            oleh admin.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="dark" size="md">
            <Link href="/">Kembali ke Beranda</Link>
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setResult(null);
              setValues(INITIAL);
              setPaymentProof(null);
              setIdDocument(null);
            }}
          >
            Daftarkan Fighter Lain
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError && (
        <div className="flex items-start gap-2.5 border border-fight-red/60 bg-fight-red/10 px-4 py-3 text-sm text-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-fight-red" />
          <span>{formError}</span>
        </div>
      )}

      <SectionCard step={1} title="Data Diri">
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-error={Boolean(fieldErrors.fullName)}>
            <Field id="fullName" label="Nama Lengkap" required error={fieldErrors.fullName}>
              <input
                id="fullName"
                className={inputClass}
                value={values.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Sesuai KTP"
                autoComplete="name"
              />
            </Field>
          </div>
          <div data-error={Boolean(fieldErrors.ringName)}>
            <Field id="ringName" label="Nama Fighter" required error={fieldErrors.ringName} hint="Nama panggung di kartu pertandingan">
              <input
                id="ringName"
                className={inputClass}
                value={values.ringName}
                onChange={(e) => set("ringName", e.target.value)}
                placeholder="Nama yang tampil di ring"
              />
            </Field>
          </div>
        </div>

        <div data-error={Boolean(fieldErrors.address)}>
          <Field id="address" label="Alamat" required error={fieldErrors.address}>
            <textarea
              id="address"
              rows={3}
              className={inputClass}
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Alamat lengkap (desa/kelurahan, kecamatan, kabupaten)"
            />
          </Field>
        </div>

        <div className="sm:max-w-[200px]" data-error={Boolean(fieldErrors.age)}>
          <Field id="age" label="Usia" required error={fieldErrors.age} hint="Minimal 15 tahun">
            <input
              id="age"
              type="number"
              inputMode="numeric"
              min={15}
              max={70}
              className={inputClass}
              value={values.age}
              onChange={(e) => set("age", e.target.value)}
              placeholder="contoh: 22"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard step={2} title="Kategori Pertandingan" description="Pilih divisi berat, jenis rules, dan kelas Anda.">
        <div data-error={Boolean(fieldErrors.divisionLabel)}>
          <Field id="divisionLabel" label="Divisi" required error={fieldErrors.divisionLabel}>
            <select
              id="divisionLabel"
              className={inputClass}
              value={values.divisionLabel}
              onChange={(e) => set("divisionLabel", e.target.value)}
            >
              <option value="">— Pilih Divisi —</option>
              {DIVISIONS.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div data-error={Boolean(fieldErrors.rules)}>
          <Field id="rules" label="Kategori Rules" required error={fieldErrors.rules}>
            <RadioGroup
              name="rules"
              options={RULES}
              value={values.rules}
              onChange={(value) => set("rules", value)}
              error={fieldErrors.rules}
            />
          </Field>
        </div>

        <div data-error={Boolean(fieldErrors.competitionClass)}>
          <Field id="competitionClass" label="Kelas" required error={fieldErrors.competitionClass}>
            <RadioGroup
              name="competitionClass"
              options={CLASSES}
              value={values.competitionClass}
              onChange={(value) => set("competitionClass", value)}
              error={fieldErrors.competitionClass}
              columns={3}
            />
          </Field>
        </div>

        <div data-error={Boolean(fieldErrors.bpjsStatus)}>
          <Field
            id="bpjsStatus"
            label="BPJS Ketenagakerjaan"
            required
            error={fieldErrors.bpjsStatus}
            hint="Peserta wajib memiliki BPJS Ketenagakerjaan aktif. Jika belum aktif, unggah KTP/Kartu Keluarga di bagian Lampiran."
          >
            <RadioGroup
              name="bpjsStatus"
              options={BPJS_OPTIONS}
              value={values.bpjsStatus}
              onChange={(value) => set("bpjsStatus", value)}
              error={fieldErrors.bpjsStatus}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard step={3} title="Sosial Media" description="Semua opsional, tapi membantu panitia untuk promosi fighter.">
        <Field id="socialUrl" label="Link Sosial Media" error={fieldErrors.socialUrl} hint="Akun utama (mis. link Instagram)">
          <input
            id="socialUrl"
            className={inputClass}
            value={values.socialUrl}
            onChange={(e) => set("socialUrl", e.target.value)}
            placeholder="https://instagram.com/namafighter"
            inputMode="url"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["instagramUrl", "Instagram"],
              ["tiktokUrl", "TikTok"],
              ["facebookUrl", "Facebook"],
              ["xUrl", "X / Twitter"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} id={key} label={label} error={fieldErrors[key]}>
              <input
                id={key}
                className={inputClass}
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={`https://${key.replace("Url", "").replace("facebook", "facebook")}.com/...`}
                inputMode="url"
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        step={4}
        title="Pembayaran & Lampiran"
        description={`Biaya pendaftaran ${formatIdr(feeIdr)} — transfer ke rekening panitia, lalu unggah buktinya.`}
      >
        <div className="border border-border-subtle bg-canvas px-4 py-3 space-y-1">
          <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Rekening Transfer</p>
          <p className="text-sm text-ink">
            <span className="font-semibold">Seabank</span> — a.n. Maulana Irham Rianto
          </p>
          <p className="font-display text-xl font-black tracking-wider text-fight-red">
            901864586820 <span className="text-sm font-normal text-ink-muted">· {formatIdr(feeIdr)}</span>
          </p>
        </div>

        <div data-error={Boolean(fieldErrors.paymentProof)}>
          <FileDrop
            id="paymentProof"
            label={FILE_RULES.paymentProof.label}
            hint={`Screenshot/foto bukti transfer · JPG, PNG, WebP, PDF · maks ${FILE_RULES.paymentProof.maxMb} MB`}
            accept={FILE_RULES.paymentProof.accept}
            maxMb={FILE_RULES.paymentProof.maxMb}
            file={paymentProof}
            error={fieldErrors.paymentProof}
            onSelect={(file) => {
              setPaymentProof(file);
              if (file) setFieldErrors((prev) => ({ ...prev, paymentProof: "" }));
            }}
            onClear={() => setPaymentProof(null)}
          />
        </div>

        {needsIdDocument && (
          <div data-error={Boolean(fieldErrors.idDocument)}>
            <FileDrop
              id="idDocument"
              label="KTP / Kartu Keluarga"
              hint={`Wajib karena BPJS belum aktif · JPG, PNG, WebP · maks ${FILE_RULES.idDocument.maxMb} MB`}
              accept={FILE_RULES.idDocument.accept}
              maxMb={FILE_RULES.idDocument.maxMb}
              file={idDocument}
              error={fieldErrors.idDocument}
              onSelect={(file) => {
                setIdDocument(file);
                if (file) setFieldErrors((prev) => ({ ...prev, idDocument: "" }));
              }}
              onClear={() => setIdDocument(null)}
            />
            <p className="mt-1.5 text-[11px] text-ink-subtle">
              Lampiran ini hanya dapat dilihat panitia (tidak dipublikasikan).
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard step={5} title="Pernyataan Peserta">
        <div data-error={Boolean(fieldErrors.consentAccepted)}>
          <label className="flex cursor-pointer items-start gap-3 border border-border-subtle bg-canvas px-4 py-3.5">
            <input
              type="checkbox"
              checked={values.consentAccepted}
              onChange={(e) => {
                set("consentAccepted", e.target.checked);
                if (e.target.checked) setFieldErrors((prev) => ({ ...prev, consentAccepted: "" }));
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fight-red)]"
            />
            <span className="text-sm text-ink leading-relaxed">
              Saya menyatakan bersedia dan siap mengikuti pertandingan sesuai aturan yang berlaku.
              <span className="text-fight-red"> *</span>
            </span>
          </label>
          {fieldErrors.consentAccepted && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fight-red">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors.consentAccepted}
            </p>
          )}
        </div>

        {/* Honeypot — disembunyikan dari manusia, diisi bot */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>
      </SectionCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-border-subtle bg-surface px-5 py-4">
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Dengan mengirim, data Anda disimpan panitia TFN dan dicatat pada spreadsheet pendaftaran.
        </p>
        <Button type="submit" variant="crimson" size="lg" disabled={submitting} className="sm:min-w-[200px]">
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Mengirim…
            </span>
          ) : (
            "Kirim Pendaftaran"
          )}
        </Button>
      </div>
    </form>
  );
}
