import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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
  // The theme is resolved on the server from the `tfn_theme` cookie and rendered directly on
  // <html>. This replaces the previous pre-paint script: the saved theme is correct in the very
  // first byte of HTML, so there is no flash of the wrong theme and no inline JS is needed
  // (inline JS is banned by lint and would need a CSP nonce anyway).
  // ThemeProvider mirrors the user's choice back into this cookie on change.
  const themeCookie = (await cookies()).get("tfn_theme")?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";
  const htmlClassName = initialTheme === "light" ? "light scroll-smooth" : "dark scroll-smooth";

  return (
    <html lang="id" className={htmlClassName} suppressHydrationWarning>
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
