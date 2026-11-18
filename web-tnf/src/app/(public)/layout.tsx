import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { EventPromoModal } from "@/components/landing/EventPromoModal";
import { getSettings } from "@/server/services/settings.service";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let settings;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error("PublicLayout getSettings error:", err);
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="tfn-public-content flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
      <EventPromoModal config={settings?.["popup.event"]} />
    </div>
  );
}
