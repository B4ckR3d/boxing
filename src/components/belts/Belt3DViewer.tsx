"use client";

import React, { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Belt2DFallback } from "./BeltCanvas";
import { Pause, Play } from "lucide-react";

// Dynamically import Three.js Canvas to avoid SSR issues
const BeltCanvas = dynamic(
  () => import("./BeltCanvas").then((mod) => mod.BeltCanvas),
  {
    ssr: false,
    loading: () => <Belt2DFallback />,
  }
);

export interface BeltViewerProps {
  belt: {
    id: string;
    name: string;
    division: string;
    holderName?: string;
    holderRecord?: string;
    holderPortraitUrl?: string;
    wonDate?: string;
    lastDefense?: string;
    nextDefense?: string;
    status: string;
    defensesCount?: number;
    imageUrl?: string;
  };
}

export function Belt3DViewer({ belt }: BeltViewerProps) {
  const [viewMode, _setViewMode] = useState<"photo" | "3d">("photo");
  const [isRotating, setIsRotating] = useState(true);

  // Determine photo url based on division/name
  const photoUrl =
    belt.imageUrl ||
    (belt.name.toLowerCase().includes("welter")
      ? "/images/belts/tfn-world-welterweight-belt.jpg"
      : "/images/belts/tfn-world-heavyweight-belt.jpg");

  const isVacant =
    !belt.holderName ||
    belt.holderName.includes("VACANT") ||
    belt.holderName.includes("KOSONG");

  return (
    <div className="grid lg:grid-cols-12 gap-8 items-center bg-card text-card-foreground border border-border shadow-2xl p-6 lg:p-10 relative overflow-hidden transition-colors">
      {/* Top Banner Accent: Crimson into Gold */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-fight-red via-[#F5C542] to-fight-red" />

      {/* Belt Focal Viewport (7 cols on desktop) */}
      <div className="lg:col-span-7 relative h-[440px] lg:h-[500px] bg-neutral-950 border border-border overflow-hidden flex flex-col justify-between group shadow-xl">
        {/* Viewport Content */}
        {viewMode === "photo" ? (
          /* High-Resolution Studio Photograph View */
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-[#121216] to-[#0A0A0C] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={belt.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
          </div>
        ) : (
          /* 3D Interactive Gold Mesh View */
          <div
            className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-b from-[#141419] to-[#08080A]"
            onMouseEnter={() => setIsRotating(false)}
            onMouseLeave={() => setIsRotating(true)}
          >
            <Suspense fallback={<Belt2DFallback imageUrl={photoUrl} title={belt.name} />}>
              <BeltCanvas isRotating={isRotating} />
            </Suspense>

            {/* 3D Floating Control Pill */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
              <span className="font-mono-data text-[10px] text-neutral-400 bg-black/70 backdrop-blur px-2.5 py-1 border border-neutral-800">
                GESER UNTUK MEMUTAR 360°
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsRotating(!isRotating)}
                className="pointer-events-auto bg-black/80 backdrop-blur border-neutral-700 text-white hover:bg-fight-red hover:text-white text-xs h-8 px-3"
              >
                {isRotating ? (
                  <>
                    <Pause className="w-3.5 h-3.5 mr-1" /> JEDA
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1 text-[#F5C542]" /> PUTAR
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Belt Telemetry & Holder Data (5 cols on desktop) */}
      <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-foreground leading-tight tracking-tight">
            {belt.name.replace(/\bworld\b\s*/gi, "")}
          </h2>

          <p className="font-sans text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
            Disahkan di bawah Regulasi Resmi Kejuaraan TFN (Temanggung Fight Night). Sabuk divisi ini berpindah tangan kepada penantang yang menang secara sah berdasarkan keputusan juri dan komisi pertandingan.
          </p>
        </div>

        {/* Current Champion Card */}
        <div
          className={`p-5 border-2 shadow-lg transition-colors ${
            isVacant
              ? "bg-canvas border-neutral-700"
              : "bg-canvas border-fight-red"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="font-mono-data text-[11px] text-fight-red font-bold tracking-widest uppercase">
              {isVacant ? "STATUS GELAR SAAT INI" : "JUARA BERTAHAN SAAT INI"}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <div>
              <p
                className={`font-display text-2xl sm:text-3xl font-black uppercase ${
                  isVacant ? "text-fight-red" : "text-foreground"
                }`}
              >
                {belt.holderName || "GELAR KOSONG (VACANT)"}
              </p>
              {belt.holderRecord && (
                <p className="font-mono-data text-xs text-muted-foreground mt-1">
                  REKOR BERTANDING:{" "}
                  <span className="text-foreground font-bold">
                    {belt.holderRecord}
                  </span>
                </p>
              )}
            </div>

            <div className="text-right">
              <span className="font-display text-3xl sm:text-4xl font-black text-fight-red">
                {belt.defensesCount ?? 0}
              </span>
              <p className="font-mono-data text-[10px] text-muted-foreground uppercase">
                Kali Bertahan
              </p>
            </div>
          </div>
        </div>

        {/* Lineage & Defense Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono-data text-xs">
          <div className="border border-border p-3.5 bg-canvas">
            <p className="text-muted-foreground text-[10px] uppercase font-semibold">
              TANGGAL REBUT GELAR
            </p>
            <p className="font-bold text-foreground text-sm mt-0.5">
              {belt.wonDate || "BELUM ADA (VACANT)"}
            </p>
          </div>
          <div className="border border-border p-3.5 bg-canvas">
            <p className="text-muted-foreground text-[10px] uppercase font-semibold">
              LAGA WAJIB BERIKUTNYA
            </p>
            <p className="font-bold text-fight-red text-sm mt-0.5 truncate">
              {belt.nextDefense || "Menunggu Jadwal Laga Wajib"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
