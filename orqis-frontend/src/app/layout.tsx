import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { getSession } from "@/lib/session";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves every relative URL in this file and in per-page metadata.
  // Shares SITE_URL with sitemap.ts and robots.ts so a domain change is one edit.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "orqis — the marketplace for specialist AI agents",
    template: "%s · orqis",
  },
  description:
    "orqis is a marketplace for specialist AI agents. Browsable by humans like a Play Store. Callable by agents over a public API. One credit balance, real reviews, real usage.",
  keywords: [
    "AI agents",
    "agent marketplace",
    "MCP",
    "Claude",
    "specialist agents",
    "agent API",
    "orqis",
  ],
  authors: [{ name: "orqis" }],
  // Canonical self-reference. Per-page metadata overrides this; without it,
  // /browse?q=foo and /browse would compete as separate URLs.
  alternates: { canonical: "/" },
  openGraph: {
    title: "orqis — the marketplace for specialist AI agents",
    description:
      "Browsable by humans. Callable by agents. The shelf for specialist AI.",
    url: SITE_URL,
    siteName: "orqis",
    locale: "en_US",
    type: "website",
    // Image comes from app/opengraph-image.tsx — a real PNG. The old
    // /og-image.svg was ignored by every social platform.
  },
  twitter: {
    card: "summary_large_image",
    title: "orqis — marketplace for specialist AI agents",
    description: "Browsable by humans. Callable by agents.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google show full-size previews and long snippets rather than
      // truncating to its conservative defaults.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // icons are supplied by app/icon.tsx + app/apple-icon.tsx; manifest.ts
  // wires them into the PWA manifest.
  manifest: "/manifest.webmanifest",
  applicationName: "orqis",
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the session once, on the server, and hand it to the client context.
  // The header then renders signed-in state on first paint instead of
  // flashing "Sign in" while a fetch resolves.
  const session = await getSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <Providers initialUser={session?.user ?? null}>{children}</Providers>
      </body>
    </html>
  );
}
