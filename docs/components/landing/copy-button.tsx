'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Install-command box with a copy affordance. */
export function InstallBox({
  command,
  size = 'md',
}: {
  command: string
  size?: 'md' | 'lg'
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      /* clipboard unavailable (e.g. non-secure context), ignore */
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-lg border border-border bg-secondary font-mono ${
        size === 'lg' ? 'px-5 py-3.5 text-base' : 'px-4 py-2.5 text-sm'
      }`}
    >
      <span aria-hidden className="select-none text-primary">
        $
      </span>
      <code className="text-foreground">{command}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy install command'}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {copied ? (
          <Check size={16} className="text-success" />
        ) : (
          <Copy size={16} />
        )}
      </button>
    </div>
  )
}
