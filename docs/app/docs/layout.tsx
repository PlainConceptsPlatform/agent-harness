import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import type { ReactNode } from 'react'
import { source } from '@/app/source'
import { Wordmark } from '@/components/landing'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      githubUrl="https://github.com/PlainConceptsPlatform/opencode-onboard"
      nav={{ title: <Wordmark size={22} />, enabled: true }}
    >
      {children}
    </DocsLayout>
  )
}
