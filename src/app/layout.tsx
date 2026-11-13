import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "TFN | Temanggung Fight Night",
    template: "%s | TFN - Temanggung Fight Night",
  },
  description:
    "Temanggung Fight Night: kenali petarung, jelajahi kompetisi, dan temukan informasi tiket.",
  keywords: [
    "TFN",
    "Temanggung Fight Night",
    "Tinju Temanggung",
    "Fight Night",
    "Boxing Indonesia",
    "Grand Prix Boxing",
    "Fight Card",
  ],
  authors: [{ name: "Temanggung Fight Night (TFN)" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "TFN - Temanggung Fight Night",
    title: "TFN | Temanggung Fight Night",
    description: "Kenali petarung, jelajahi kompetisi, dan temukan informasi tiket TFN.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TFN | Temanggung Fight Night",
    description: "Kenali petarung, jelajahi kompetisi, dan temukan informasi tiket TFN.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // CSP nonce is minted per-request by src/proxy.ts. It must be forwarded to the
  // theme bootstrap script explicitly — otherwise the server renders nonce=""
  // while the client hydrates with nonce={undefined}, which breaks hydration and
  // leaves every client component on the page inert.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="id" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
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
