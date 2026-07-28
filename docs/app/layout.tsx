import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider'
import { Geist_Mono, Outfit } from 'next/font/google'
import './global.css'

/* Outfit is the Platform Foundations typeface; it feeds --font-sans, which the
   ui-theme base layer applies to <body>. Mono is used for terminal output. */
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://plainconceptsplatform.github.io/opencode-onboard',
  ),
  title: {
    default: 'opencode-onboard: Prepare any codebase for AI',
    template: '%s | opencode-onboard',
  },
  description:
    'Prepare any codebase for AI. Wires OpenCode, OpenSpec, codegraph, and agentmemory into a multi-agent development workflow powered by native parallel subagents.',
  openGraph: {
    siteName: 'opencode-onboard',
    type: 'website',
    images: ['/assets/logo.png'],
  },
  twitter: {
    card: 'summary',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider theme={{ enabled: true, defaultTheme: 'system' }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
