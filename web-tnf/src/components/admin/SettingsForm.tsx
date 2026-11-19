"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateSettingsAction } from "@/app/admin/(dashboard)/settings/actions";
import {
  SETTING_KEYS,
  SETTING_LABELS,
  type SettingKey,
  type SettingValues,
} from "@/lib/settings/schemas";

interface FieldSpec {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "boolean";
  placeholder?: string;
}

/** Field layout per settings group (rendered as CMS form sections) */
const FIELD_SPECS: Record<SettingKey, FieldSpec[]> = {
  "branding.general": [
    { name: "siteName", label: "Site Name", type: "text" },
    { name: "abbreviation", label: "Abbreviation (e.g. WBC)", type: "text" },
    { name: "suffix", label: "Suffix (e.g. -X)", type: "text" },
    { name: "tagline", label: "Tagline", type: "textarea" },
  ],
  "landing.featured": [
    { name: "heading", label: "Section Heading", type: "text" },
    { name: "subheading", label: "Subheading", type: "textarea" },
    { name: "ctaLabel", label: "CTA Label", type: "text" },
    { name: "ctaHref", label: "CTA Link", type: "text", placeholder: "/fighters" },
  ],
  "footer.general": [
    { name: "copyright", label: "Copyright Line", type: "text" },
    { name: "contactEmail", label: "Contact Email", type: "email" },
    { name: "certifications", label: "Certification Note", type: "text" },
  ],
  "system.flags": [
    {
      name: "maintenanceMode",
      label: "Maintenance Mode (hide public content)",
      type: "boolean",
    },
    {
      name: "showDemoContent",
      label: "Show Demo Content",
      type: "boolean",
    },
  ],
  "popup.event": [
    {
      name: "isEnabled",
      label: "Aktifkan Pop-up Saat Pengunjung Masuk",
      type: "boolean",
    },
    { name: "badge", label: "Label / Badge", type: "text", placeholder: "LAGA MENDATANG · TIKET RESMI" },
    { name: "title", label: "Judul Event", type: "text", placeholder: "TEMANGGUNG FIGHT NIGHT VOL. 1" },
    { name: "subtitle", label: "Jadwal & Lokasi", type: "text", placeholder: "SABTU, 24 DESEMBER 2026 · GOR BAMBU RUNCING" },
    { name: "description", label: "Deskripsi Promosi", type: "textarea" },
    { name: "imageUrl", label: "URL Gambar Flyer / Poster", type: "text", placeholder: "/images/hero/boxing-ring-arena.jpg" },
    { name: "buttonLabel", label: "Label Tombol Beli Tiket", type: "text", placeholder: "BELI TIKET SEKARANG" },
    { name: "buttonUrl", label: "Tautan Pembelian Tiket", type: "text", placeholder: "https://tiket.pimpom.id" },
  ],
  "exhibition.vol6": [
    {
      name: "isEnabled",
      label: "Tampilkan Section Exhibition & Partai di Beranda",
      type: "boolean",
    },
    { name: "badge", label: "Label Badge", type: "text", placeholder: "VOL. 6 EXHIBITION" },
    { name: "title", label: "Judul Utama", type: "text", placeholder: "SETIAP RONDE PUNYA CERITA." },
    {
      name: "rulesText",
      label: "Keterangan Regulasi & Rules",
      type: "text",
      placeholder: "Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan",
    },
    {
      name: "whatsappNumber",
      label: "Nomor WhatsApp Pendaftaran (Format: 628xxx)",
      type: "text",
      placeholder: "6281390823332",
    },
    {
      name: "ctaLabel",
      label: "Label Tombol WhatsApp Header",
      type: "text",
      placeholder: "DAFTAR PARTAI VIA WA",
    },
    {
      name: "closedDivisions",
      label: "Nomor Divisi yang Sudah Penuh (pisahkan koma, cth: 2, 5)",
      type: "text",
      placeholder: "cth: 2, 5 (kosongkan jika semua masih dibuka)",
    },
  ],
};

const GROUP_DESCRIPTIONS: Record<SettingKey, string> = {
  "branding.general":
    "Site identity used across the public site and CMS sidebar.",
  "landing.featured":
    "Heading and call-to-action for the featured fighters section on the landing page.",
  "footer.general": "Footer text and contact details on the public site.",
  "system.flags": "Operational switches. Changes apply immediately.",
  "popup.event": "Pop-up flyer promosi event yang muncul saat pengunjung pertama kali membuka website, dengan tombol langsung ke pemesanan tiket.",
  "exhibition.vol6": "Konfigurasi partai tanding Vol. 6 Exhibition (nomor WA, regulasi, dan kontrol slot divisi penuh/tersedia).",
};

export function SettingsForm({ settings }: { settings: SettingValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<SettingValues>(settings);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  const markDirty = (key: SettingKey) => {
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const setValue = <K extends SettingKey>(
    key: K,
    field: string,
    value: string | boolean
  ) => {
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    markDirty(key);
  };

  const save = (key: SettingKey) => {
    startTransition(async () => {
      const res = await updateSettingsAction({ [key]: values[key] });
      if (res.ok) {
        toast.success(`"${SETTING_LABELS[key]}" saved`);
        setDirtyKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to save settings");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="pb-4 border-b border-subtle">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            CONFIGURATION
          </span>
          <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            ZOD-VALIDATED
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
          ORGANIZATION SETTINGS
        </h1>
        <p className="font-mono-data text-xs text-ink-muted mt-1">
          CMS-configurable values stored in the{" "}
          <code>OrganizationSetting</code> table. Every change is validated and
          audited.
        </p>
      </div>

      <div className="space-y-4">
        {SETTING_KEYS.map((key) => {
          const dirty = dirtyKeys.has(key);
          return (
            <section
              key={key}
              className="bg-charcoal border border-subtle p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3">
                <div>
                  <h2 className="font-display text-lg uppercase font-black">
                    {SETTING_LABELS[key]}
                  </h2>
                  <p className="font-mono-data text-[10px] text-ink-muted mt-0.5">
                    {GROUP_DESCRIPTIONS[key]}
                  </p>
                </div>
                <button
                  onClick={() => save(key)}
                  disabled={pending || !dirty}
                  className={`inline-flex items-center gap-1.5 font-mono-data text-[10px] font-bold px-3 py-1.5 uppercase transition-colors cursor-pointer shrink-0 ${
                    dirty
                      ? "bg-charcoal text-ink hover:bg-surface-elevated"
                      : "bg-surface-elevated text-ink-subtle cursor-not-allowed"
                  }`}
                >
                  <Save className="w-3 h-3" /> SAVE
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FIELD_SPECS[key].map((spec) => {
                  const fieldValue = (values[key] as Record<string, unknown>)[
                    spec.name
                  ];
                  return (
                    <label
                      key={spec.name}
                      className={`font-mono-data text-[10px] uppercase text-ink-muted space-y-1 ${
                        spec.type === "textarea" ? "md:col-span-2" : ""
                      }`}
                    >
                      {spec.label}
                      {spec.type === "boolean" ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setValue(key, spec.name, !fieldValue)
                            }
                            className={`relative w-10 h-5 transition-colors cursor-pointer ${
                              fieldValue ? "bg-fight-red" : "bg-surface-elevated"
                            }`}
                            aria-pressed={Boolean(fieldValue)}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 bg-charcoal transition-all ${
                                fieldValue ? "left-[22px]" : "left-0.5"
                              }`}
                            />
                          </button>
                          <span className="text-xs text-ink font-bold">
                            {fieldValue ? "ON" : "OFF"}
                          </span>
                        </div>
                      ) : spec.type === "textarea" ? (
                        <textarea
                          rows={2}
                          value={String(fieldValue ?? "")}
                          onChange={(e) =>
                            setValue(key, spec.name, e.target.value)
                          }
                          className="w-full bg-canvas border border-subtle px-3 py-2 text-sm text-ink outline-none focus:border-white font-sans normal-case resize-y"
                        />
                      ) : (
                        <input
                          type={spec.type}
                          value={String(fieldValue ?? "")}
                          placeholder={spec.placeholder}
                          onChange={(e) =>
                            setValue(key, spec.name, e.target.value)
                          }
                          className="w-full bg-canvas border border-subtle px-3 py-2 text-sm text-ink outline-none focus:border-white font-sans normal-case"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
