"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1 font-mono-data text-xs text-fight-red hover:text-red-400 font-bold cursor-pointer transition-colors"
      title="Revoke session and sign out"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>{loading ? "..." : "SIGN OUT"}</span>
    </button>
  );
}

