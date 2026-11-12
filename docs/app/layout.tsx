import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

/* Outfit is the Platform Foundations typeface; it feeds --font-sans, which the
   ui-theme base layer applies to <body>. Mono stays Geist for terminal output. */
/** Google Tag Manager container for the public Platform sites. */
const GTM_ID = "GTM-T2QXWRBW";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-geist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName}: Prepare any codebase for AI`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    images: ["/assets/logo.png"],
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
        <Script src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} strategy="afterInteractive" />
        <Script id="gtm-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`}
        </Script>
      </body>
    </html>
  );
}
