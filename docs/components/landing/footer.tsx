import Link from 'next/link'
import { Wordmark } from './wordmark'

const LINKS = [
  {
    href: 'https://github.com/PlainConceptsPlatform/opencode-onboard',
    label: 'GitHub',
  },
  { href: 'https://www.npmjs.com/package/opencode-onboard', label: 'npm' },
  { href: 'https://opencode.ai', label: 'OpenCode' },
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <Wordmark size={24} />

        <p className="text-xs text-muted-foreground">
          MIT &copy;{' '}
          <a
            href="https://github.com/PlainConceptsPlatform"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Plain Concepts
          </a>
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
