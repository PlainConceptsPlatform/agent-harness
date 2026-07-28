'use client'

import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle'
import { Github } from 'lucide-react'
import Link from 'next/link'
import { Wordmark } from './wordmark'

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#commands', label: 'Commands' },
  { href: '/#pipeline', label: 'Pipeline' },
  { href: '/docs', label: 'Docs' },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-4 text-sm sm:gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-muted-foreground transition-colors hover:text-foreground ${
                l.href === '/docs' ? '' : 'hidden sm:inline'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/PlainConceptsPlatform/opencode-onboard"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github size={18} />
          </a>
          <ThemeToggle mode="light-dark" className="border-0 bg-transparent p-1.5" />
        </div>
      </nav>
    </header>
  )
}
