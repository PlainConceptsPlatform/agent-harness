'use client'

import { useEffect, useRef, useState } from 'react'

/** [tone, text, msPerChar]. 0 = print instantly, 'br' = bare newline. */
type Line = [tone: Tone, text: string, delay: number]
type Tone = 'prompt' | 'accent' | 'dim' | 'ok' | 'plain' | 'br'

const LINES: Line[] = [
  ['prompt', '$ ', 0],
  ['plain', 'npx opencode-onboard@latest', 34],
  ['br', '', 0],
  ['br', '', 0],
  ['accent', '🧰 opencode-onboard', 8],
  ['br', '', 0],
  ['dim', '   Prepare any codebase for AI\n\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Source scope: current repo\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Clean AI files: 3 stale files removed\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Platform: GitHub backlog + GitHub repo\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Platform CLI: gh authenticated\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Scaffolding: agents, skills & commands copied\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'OpenSpec: initialized\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Models: plan / build / fast selected\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Token optimization: AGENTS.md rules injected\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Browser plugin: installed\n', 4],
  ['ok', '  ✔ ', 0],
  ['plain', 'Metadata: .opencode/opencode-onboard.json written\n\n', 4],
  ['accent', '  ✨ Your codebase is ready for AI.\n', 12],
  ['dim', '  Open OpenCode and type ', 8],
  ['accent', '/repo-initialize', 40],
  ['dim', ' to activate the agent team.\n', 8],
]

const TONE_CLASS: Record<Exclude<Tone, 'br'>, string> = {
  prompt: 'text-primary',
  accent: 'text-primary font-medium',
  dim: 'text-muted-foreground',
  ok: 'text-success',
  plain: '',
}

/** How many characters of LINES are revealed, as a flat index. */
function useTypewriter(active: boolean) {
  const [revealed, setRevealed] = useState<string[]>(() => LINES.map(() => ''))
  const doneRef = useRef(false)

  useEffect(() => {
    if (!active || doneRef.current) return
    doneRef.current = true

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches

    if (reduceMotion) {
      setRevealed(LINES.map(([, text]) => text))
      return
    }

    let cancelled = false
    let lineIdx = 0
    let timer: ReturnType<typeof setInterval> | undefined

    function nextLine() {
      if (cancelled || lineIdx >= LINES.length) return

      const idx = lineIdx++
      const [, text, delay] = LINES[idx]

      if (delay === 0 || text.length === 0) {
        setRevealed((prev) => {
          const next = [...prev]
          next[idx] = text
          return next
        })
        nextLine()
        return
      }

      let charIdx = 0
      timer = setInterval(() => {
        charIdx += 1
        setRevealed((prev) => {
          const next = [...prev]
          next[idx] = text.slice(0, charIdx)
          return next
        })
        if (charIdx >= text.length) {
          clearInterval(timer)
          nextLine()
        }
      }, delay)
    }

    nextLine()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [active])

  return revealed
}

export function TerminalDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const revealed = useTypewriter(active)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      setActive(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect()
          setActive(true)
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="overflow-hidden rounded-lg border border-border"
      aria-label="Terminal demo of the onboarding wizard"
    >
      <div className="flex items-center gap-2 border-b bg-secondary px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-destructive/70" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-warning/70" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-success/70" aria-hidden />
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          your-project: opencode-onboard
        </span>
      </div>
      <div
        ref={ref}
        className="overflow-x-auto whitespace-pre bg-terminal p-5 font-mono text-[13px] leading-relaxed text-terminal-foreground"
      >
        {LINES.map(([tone], i) =>
          tone === 'br' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed script, index is the identity
            <span key={i}>{'\n'}</span>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed script, index is the identity
            <span key={i} className={TONE_CLASS[tone]}>
              {revealed[i]}
            </span>
          ),
        )}
        <span className="terminal-caret" aria-hidden />
      </div>
    </div>
  )
}
