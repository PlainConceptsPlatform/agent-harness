import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import {
  CookieConsent,
  consentHeadScript,
  gtmNoScriptSrc,
} from "@plainconceptsplatform/ui-components/cookie-consent";
import type { Metadata } from "next";
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
      <head>
        {/* Consent defaults must be set before GTM loads; a constant built from GTM_ID. */}
        <script dangerouslySetInnerHTML={{ __html: consentHeadScript(GTM_ID) }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <noscript>
          <iframe
            src={gtmNoScriptSrc(GTM_ID)}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        <RootProvider>{children}</RootProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
