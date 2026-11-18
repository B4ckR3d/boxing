"use client";

import React, { useRef, useState } from "react";
import { Image as ImageIcon, LoaderCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export interface UploadedImageValue {
  url: string;
  mediaAssetId?: string;
}

interface ImageUploaderProps {
  label: string;
  folder: "hero" | "events" | "fighters" | "belts" | "tournaments" | "sponsors" | "general";
  value: string;
  onChange: (next: UploadedImageValue) => void;
  hint?: string;
  aspectClass?: string;
  disabled?: boolean;
}

export function ImageUploader({
  label,
  folder,
  value,
  onChange,
  hint = "JPG, PNG, WebP, GIF, AVIF · Maks 8 MB",
  aspectClass = "h-36",
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar (JPG, PNG, WebP, GIF, atau AVIF)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 8 MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Gagal mengunggah gambar");
        return;
      }
      onChange({ url: data.url, mediaAssetId: data.id });
      toast.success("Gambar berhasil diunggah");
    } catch {
      toast.error("Koneksi gagal saat mengunggah gambar");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-ink font-bold uppercase text-xs font-mono-data">
        {label}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {value ? (
        <div className="border border-subtle bg-canvas p-2 space-y-2">
          <div className={`relative w-full ${aspectClass} bg-neutral-950 overflow-hidden flex items-center justify-center`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="w-full h-full object-contain"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2 text-ink font-mono-data text-xs">
                <LoaderCircle className="w-4 h-4 animate-spin text-fight-red" />
                <span>Mengunggah...</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-subtle text-[11px] font-mono-data font-bold text-ink hover:border-fight-red hover:text-fight-red transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Ganti Gambar
            </button>
            <button
              type="button"
              disabled={disabled || isUploading}
              onClick={() => onChange({ url: "", mediaAssetId: undefined })}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono-data text-ink-muted hover:text-fight-red transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled && !isUploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !isUploading) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`w-full ${aspectClass} border-2 border-dashed flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-fight-red bg-fight-red/10"
              : "border-subtle bg-canvas hover:border-fight-red"
          } ${disabled || isUploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          {isUploading ? (
            <>
              <LoaderCircle className="w-6 h-6 animate-spin text-fight-red" />
              <span className="font-mono-data text-xs text-ink font-bold">Mengunggah gambar...</span>
            </>
          ) : (
            <>
              <div className="w-9 h-9 border border-subtle bg-charcoal flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-fight-red" />
              </div>
              <div>
                <p className="font-mono-data text-xs font-bold text-ink">
                  Klik atau seret file gambar ke sini
                </p>
                <p className="font-mono-data text-[10px] text-ink-muted mt-0.5">{hint}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
