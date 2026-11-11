import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "TFN | Temanggung Fight Night - Kejuaraan Tinju Profesional",
    template: "%s | TFN - Temanggung Fight Night",
  },
  description:
    "Platform resmi Temanggung Fight Night (TFN). Peringkat tinju divisi dan pound-for-pound, sabuk kejuaraan dunia, riwayat pertarungan terverifikasi, dan turnamen Grand Prix.",
  keywords: [
    "TFN",
    "Temanggung Fight Night",
    "Tinju Temanggung",
    "Kejuaraan Tinju",
    "Boxing Indonesia",
    "Heavyweight Champion",
    "Grand Prix Boxing",
    "Fight Card",
  ],
  authors: [{ name: "Komisi Pertandingan Temanggung Fight Night (TFN)" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "TFN - Temanggung Fight Night",
    title: "TFN | Temanggung Fight Night - Kejuaraan Tinju Profesional",
    description: "Peringkat resmi, sabuk kejuaraan, rekor pertarungan tersertifikasi, dan turnamen tinju profesional di Temanggung.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TFN | Temanggung Fight Night - Kejuaraan Tinju Profesional",
    description: "Peringkat resmi, sabuk kejuaraan, rekor pertarungan tersertifikasi, dan turnamen tinju profesional di Temanggung.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased selection:bg-fight-red selection:text-ink">
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#141417",
                  color: "#ffffff",
                  border: "2px solid #e50914",
                  borderRadius: "0px",
                },
              }}
            />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
