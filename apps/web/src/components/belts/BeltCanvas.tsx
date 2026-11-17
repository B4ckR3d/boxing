"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const subscribeNoop = () => () => {};

interface BeltModelProps {
  isRotating?: boolean;
}

function ProceduralChampionshipBelt({ isRotating = true }: BeltModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Slow, smooth studio rotation
  useFrame((_, delta) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  // 1. Championship Crimson & Steel Materials
  const plateMainMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#B3121F"),
        metalness: 0.95,
        roughness: 0.2,
        emissive: new THREE.Color("#3D0509"),
        emissiveIntensity: 0.18,
      }),
    []
  );

  const steelMirrorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#E8E8EA"),
        metalness: 0.98,
        roughness: 0.08,
        emissive: new THREE.Color("#2A2A30"),
        emissiveIntensity: 0.25,
      }),
    []
  );

  const steelFiligreeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#8E8E99"),
        metalness: 0.92,
        roughness: 0.28,
      }),
    []
  );

  // 2. Faceted Gemstones (Ruby & Emerald)
  const rubyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#E50914"),
        metalness: 0.3,
        roughness: 0.05,
        emissive: new THREE.Color("#B30009"),
        emissiveIntensity: 0.85,
      }),
    []
  );

  const accentJewelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#F1F5F9"),
        metalness: 0.3,
        roughness: 0.05,
        emissive: new THREE.Color("#52525B"),
        emissiveIntensity: 0.6,
      }),
    []
  );

  // 3. Handcrafted Black Leather & Studs
  const leatherMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#141416"),
        roughness: 0.75,
        metalness: 0.12,
      }),
    []
  );

  const chromeRivetMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#F1F5F9"),
        metalness: 0.98,
        roughness: 0.1,
      }),
    []
  );

  const velvetPedestalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0A0A0C"),
        roughness: 0.92,
        metalness: 0.04,
      }),
    []
  );

  // Stud coordinate helper along leather strap circumference
  const leatherStuds = useMemo(() => {
    const studs: Array<{ x: number; z: number; angle: number }> = [];
    const count = 18;
    const startAngle = -Math.PI * 0.38;
    const endAngle = Math.PI * 0.38;
    const radius = 2.27;

    for (let i = 0; i <= count; i++) {
      const angle = startAngle + (i / count) * (endAngle - startAngle);
      // Skip center region where main plate sits
      if (Math.abs(angle) > 0.18) {
        studs.push({
          x: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
          angle,
        });
      }
    }
    return studs;
  }, []);

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* --- EXHIBITION VELVET PEDESTAL --- */}
      <group position={[0, -0.92, 0]}>
        <mesh material={velvetPedestalMaterial}>
          <cylinderGeometry args={[2.5, 2.7, 0.45, 48]} />
        </mesh>
        {/* Polished Steel Pedestal Trim Ring */}
        <mesh material={steelMirrorMaterial} position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.52, 0.035, 16, 48]} />
        </mesh>
      </group>

      {/* --- CURVED CONTOURED LEATHER STRAP --- */}
      <group position={[0, 0, 0]}>
        {/* Main Curved Leather Waist Wrap */}
        <mesh material={leatherMaterial}>
          <cylinderGeometry args={[2.25, 2.25, 1.38, 64, 1, true, -Math.PI * 0.42, Math.PI * 0.84]} />
        </mesh>

        {/* Steel Border Rivets (Top Row & Bottom Row) */}
        {leatherStuds.map((s, idx) => (
          <React.Fragment key={idx}>
            <mesh
              material={chromeRivetMaterial}
              position={[s.x, 0.58, s.z]}
              rotation={[0, s.angle, 0]}
            >
              <sphereGeometry args={[0.028, 12, 12]} />
            </mesh>
            <mesh
              material={chromeRivetMaterial}
              position={[s.x, -0.58, s.z]}
              rotation={[0, s.angle, 0]}
            >
              <sphereGeometry args={[0.028, 12, 12]} />
            </mesh>
          </React.Fragment>
        ))}
      </group>

      {/* --- MAIN CENTER MEDALLION PLATE --- */}
      <group position={[0, 0, 2.26]}>
        {/* 1. Base Crimson Plate (Ornate Octagonal Shield) */}
        <mesh material={plateMainMaterial} rotation={[Math.PI / 8, 0, Math.PI / 8]}>
          <cylinderGeometry args={[1.28, 1.28, 0.065, 8]} />
        </mesh>

        {/* 2. Raised Beveled Steel Border */}
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.14, 0.045, 16, 48]} />
        </mesh>

        {/* 3. Intricate Filigree Ring */}
        <mesh material={steelFiligreeMaterial} position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.035, 16, 36]} />
        </mesh>

        {/* 4. Raised Inner Medallion Disc */}
        <mesh material={plateMainMaterial} position={[0, 0, 0.045]}>
          <cylinderGeometry args={[0.88, 0.88, 0.04, 36]} />
        </mesh>

        {/* 5. Laurel Wreath Steel Crest */}
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.038, 16, 32]} />
        </mesh>

        {/* 6. Central TFN Crest Crown */}
        <mesh material={steelMirrorMaterial} position={[0, 0.18, 0.08]}>
          <cylinderGeometry args={[0.26, 0.32, 0.05, 16]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0.35, 0.08]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.12, 0.16, 5]} />
        </mesh>

        {/* 7. Large Center Ruby Gemstone */}
        <mesh material={rubyMaterial} position={[0, -0.05, 0.1]}>
          <octahedronGeometry args={[0.17, 0]} />
        </mesh>

        {/* 8. Four Surrounding Steel Accent Jewels */}
        {[
          [0.42, 0.15] as const,
          [-0.42, 0.15] as const,
          [0.35, -0.32] as const,
          [-0.35, -0.32] as const,
        ].map(([gx, gy], i) => (
          <mesh key={i} material={accentJewelMaterial} position={[gx, gy, 0.085]}>
            <octahedronGeometry args={[0.075, 0]} />
          </mesh>
        ))}

        {/* 9. Perimeter Steel Dome Studs */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <mesh
              key={i}
              material={steelMirrorMaterial}
              position={[Math.cos(rad) * 1.05, Math.sin(rad) * 1.05, 0.05]}
            >
              <sphereGeometry args={[0.05, 16, 16]} />
            </mesh>
          );
        })}
      </group>

      {/* --- LEFT DIVISIONAL SIDE PLATE --- */}
      <group position={[-1.28, 0, 1.86]} rotation={[0, 0.58, 0]}>
        {/* Octagonal Side Plate */}
        <mesh material={plateMainMaterial} rotation={[Math.PI / 8, 0, 0]}>
          <cylinderGeometry args={[0.56, 0.56, 0.05, 8]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.028, 16, 32]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.035]}>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 24]} />
        </mesh>
        <mesh material={rubyMaterial} position={[0, 0, 0.06]}>
          <octahedronGeometry args={[0.09, 0]} />
        </mesh>
      </group>

      {/* --- FAR-LEFT CONTENDER COIN --- */}
      <group position={[-1.88, 0, 1.2]} rotation={[0, 1.02, 0]}>
        <mesh material={plateMainMaterial}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.025]}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 20]} />
        </mesh>
        <mesh material={accentJewelMaterial} position={[0, 0, 0.04]}>
          <octahedronGeometry args={[0.055, 0]} />
        </mesh>
      </group>

      {/* --- RIGHT DIVISIONAL SIDE PLATE --- */}
      <group position={[1.28, 0, 1.86]} rotation={[0, -0.58, 0]}>
        <mesh material={plateMainMaterial} rotation={[Math.PI / 8, 0, 0]}>
          <cylinderGeometry args={[0.56, 0.56, 0.05, 8]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.028, 16, 32]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.035]}>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 24]} />
        </mesh>
        <mesh material={rubyMaterial} position={[0, 0, 0.06]}>
          <octahedronGeometry args={[0.09, 0]} />
        </mesh>
      </group>

      {/* --- FAR-RIGHT CONTENDER COIN --- */}
      <group position={[1.88, 0, 1.2]} rotation={[0, -1.02, 0]}>
        <mesh material={plateMainMaterial}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
        </mesh>
        <mesh material={steelMirrorMaterial} position={[0, 0, 0.025]}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 20]} />
        </mesh>
        <mesh material={accentJewelMaterial} position={[0, 0, 0.04]}>
          <octahedronGeometry args={[0.055, 0]} />
        </mesh>
      </group>
    </group>
  );
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// Crimson Embers & Floating Spark Atmosphere
function StudioDustParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const [coords] = useMemo(() => {
    const rand = seededRandom(20261104);
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 8;
      positions[i * 3 + 1] = (rand() - 0.5) * 5;
      positions[i * 3 + 2] = (rand() - 0.5) * 6;
    }
    return [positions];
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.05;
      pointsRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          args={[coords, 3]}
          attach="attributes-position"
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.038}
        color="#E50914"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

let webglSupportCache: boolean | null = null;

function detectWebGLSupport(): boolean {
  if (webglSupportCache !== null) return webglSupportCache;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    webglSupportCache = Boolean(gl);
  } catch {
    webglSupportCache = false;
  }
  return webglSupportCache;
}

export function BeltCanvas({ isRotating = true }: { isRotating?: boolean }) {
  const hasWebGL = React.useSyncExternalStore(
    subscribeNoop,
    detectWebGLSupport,
    () => true
  );

  if (!hasWebGL) {
    return <Belt2DFallback />;
  }

  return (
    <div className="relative w-full h-full min-h-[420px] select-none">
      <Canvas
        camera={{ position: [0, 0.4, 4.6], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        className="w-full h-full"
      >
        {/* Warm Studio Key Lights */}
        <ambientLight intensity={0.55} />

        {/* Overhead Key Spotlight on Championship Medallion */}
        <spotLight
          position={[0, 6, 4]}
          angle={0.55}
          penumbra={0.8}
          intensity={110}
          color="#F5F5F7"
          castShadow
        />

        {/* Front Neutral Fill Light */}
        <pointLight position={[0, 1, 3.8]} intensity={35} color="#E8E8EA" />

        {/* Rim Light 1: Fight Red Backlight */}
        <pointLight position={[-4, 2, -3]} intensity={40} color="#E50914" />

        {/* Rim Light 2: Radiant Steel Backlight */}
        <pointLight position={[4, 3, -3]} intensity={55} color="#E50914" />

        {/* 3D Belt Model */}
        <ProceduralChampionshipBelt isRotating={isRotating} />

        {/* Floating Crimson Embers */}
        <StudioDustParticles />
      </Canvas>
    </div>
  );
}

export function Belt2DFallback({
  imageUrl = "/images/belts/world-heavyweight-belt.jpg",
  title = "TFN WORLD TITLE BELT",
}: {
  imageUrl?: string;
  title?: string;
}) {
  return (
    <div className="relative w-full h-full min-h-[420px] flex flex-col items-center justify-center p-6 bg-charcoal text-ink border border-subtle shadow-2xl text-center overflow-hidden group">
      <div className="w-full max-w-lg h-72 relative mb-4 flex items-center justify-center bg-canvas border border-subtle overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
          SABUK RESMI TFN
        </div>
      </div>
      <p className="font-display text-2xl font-bold uppercase tracking-wider text-ink">
        {title}
      </p>
      <p className="font-mono-data text-xs text-ink-muted mt-1">
        Mahkota Tertinggi Kejuaraan Tinju Dunia Temanggung Fight Night
      </p>
    </div>
  );
}
