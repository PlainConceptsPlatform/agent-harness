import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { cliVersion, platformSites, siteName } from "@/lib/site";

/** Shared nav/branding for every layout, as in Foundations' layout.config.tsx. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        {/* The Platform mark: agent-harness is one of the Platform Foundations pillars. */}
        <svg viewBox="0 0 24 24" aria-hidden className="size-6 shrink-0">
          <rect width="24" height="24" rx="2" fill="var(--pc-blue-500)" />
          <rect x="6" y="6" width="12" height="12" rx="1" fill="var(--background)" />
        </svg>
        <span className="font-semibold">{siteName}</span>
        {/* A trust signal, not decoration, so it stays plain and muted. */}
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          v{cliVersion}
        </span>
      </>
    ),
    url: "/",
  },
  // Platform Foundations is the main site, so it always leads; the sibling pillars follow.
  // The sidebar stays the navigation for the docs themselves.
  links: [
    { text: platformSites.foundations.name, url: platformSites.foundations.url, external: true },
    { text: platformSites.workflows.name, url: platformSites.workflows.url, external: true },
    { text: platformSites.health.name, url: platformSites.health.url, external: true },
  ],
  githubUrl: "https://github.com/PlainConceptsPlatform/agent-harness",
};
