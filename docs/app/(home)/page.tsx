import { Bot, FolderTree, ListChecks, Rocket, Terminal, Workflow } from "lucide-react";
import Link from "next/link";
import { source } from "@/app/source";
import { InstallBox, TerminalDemo } from "@/components/landing";

/**
 * The front door is a lobby, not a pitch, following Foundations' homepage: say
 * what this is, hand over the one command that matters, then route to the docs.
 *
 * Card copy is read from each target page's frontmatter rather than written here,
 * so the homepage cannot drift from the pages it describes. Everything is built
 * from the published tokens: border + bg-card for elevation (the theme ships no
 * shadows), --radius for corners, and 150ms colour-only transitions.
 */

const INSTALL = "npx opencode-onboard@latest";
const NPM_URL = "https://www.npmjs.com/package/opencode-onboard";
const REPO_URL = "https://github.com/PlainConceptsPlatform/opencode-onboard";

type Destination = {
  slug: string[];
  href: string;
  icon: typeof Rocket;
  /** Used only if the page or its description goes missing, so the build never breaks. */
  fallback: { title: string; description: string };
};

const DESTINATIONS: Destination[] = [
  {
    slug: ["getting-started"],
    href: "/docs/getting-started",
    icon: Rocket,
    fallback: {
      title: "Getting started",
      description: "Install it, satisfy the prerequisites, and rerun individual steps.",
    },
  },
  {
    slug: ["the-wizard"],
    href: "/docs/the-wizard",
    icon: ListChecks,
    fallback: { title: "The wizard", description: "What each of the 10 onboarding steps does." },
  },
  {
    slug: ["commands"],
    href: "/docs/commands",
    icon: Terminal,
    fallback: {
      title: "Commands",
      description: "Every slash command installed into .opencode/commands/.",
    },
  },
  {
    slug: ["agents-and-skills"],
    href: "/docs/agents-and-skills",
    icon: Bot,
    fallback: {
      title: "Agents and skills",
      description: "The line between how to work and what to know.",
    },
  },
  {
    slug: ["pipeline"],
    href: "/docs/pipeline",
    icon: Workflow,
    fallback: {
      title: "The pipeline",
      description: "How a work item URL becomes a reviewed pull request.",
    },
  },
  {
    slug: ["whats-installed"],
    href: "/docs/whats-installed",
    icon: FolderTree,
    fallback: {
      title: "What gets installed",
      description: "The files and directories written into your project.",
    },
  },
];

/* shields.io badges, matching the set in README.md. Plain <img> rather than
   next/image: remote SVGs with no intrinsic size, and next/image would need
   remotePatterns plus a loader that static export cannot run. */
const BADGES = [
  { alt: "npm version", src: "https://img.shields.io/npm/v/opencode-onboard?style=flat-square&color=black", href: NPM_URL },
  { alt: "npm downloads", src: "https://img.shields.io/npm/dm/opencode-onboard?style=flat-square&color=black", href: NPM_URL },
  { alt: "license", src: "https://img.shields.io/npm/l/opencode-onboard?style=flat-square&color=black", href: `${REPO_URL}/blob/main/LICENSE` },
  { alt: "node version", src: "https://img.shields.io/node/v/opencode-onboard?style=flat-square&color=black", href: "https://nodejs.org" },
];

function resolve(destination: Destination) {
  const page = source.getPage(destination.slug);
  const data = page?.data as { title?: string; description?: string } | undefined;

  return {
    title: data?.title ?? destination.fallback.title,
    description: data?.description ?? destination.fallback.description,
  };
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-5xl">
        <section className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Prepare any codebase for AI
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            One interactive wizard that wires OpenCode, OpenSpec, codegraph and agentmemory into a
            multi-agent development workflow powered by native parallel subagents.
          </p>

          <div className="mt-8">
            <InstallBox command={INSTALL} size="lg" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/docs/getting-started"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-[var(--oo-coral-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started
            </Link>
            <Link
              href="/docs"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Read the docs
            </Link>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Requires Node.js 18 or higher. GitHub, Azure DevOps, Jira, GitLab and browser-based
            backlogs, in any combination.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {BADGES.map((badge) => (
              <a
                key={badge.alt}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity duration-150 hover:opacity-80"
              >
                <img src={badge.src} alt={badge.alt} height={20} className="h-5" />
              </a>
            ))}
          </div>
        </section>

        <nav aria-label="Documentation sections" className="mt-16">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DESTINATIONS.map((destination) => {
              const { title, description } = resolve(destination);
              const Icon = destination.icon;

              return (
                <li key={destination.href}>
                  <Link
                    href={destination.href}
                    className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon aria-hidden className="size-5 text-primary" />
                    <span className="mt-3 font-semibold text-card-foreground">{title}</span>
                    <span className="mt-1 text-sm text-muted-foreground">{description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="mt-20">
          <h2 className="font-semibold text-xl tracking-tight">The wizard, end to end</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Ten steps, run once. It keeps the current step visible plus the last two completed, so
            progress is always clear. Step by step in{" "}
            <Link href="/docs/the-wizard" className="text-primary hover:underline">
              The wizard
            </Link>
            .
          </p>

          <div className="mt-6">
            <TerminalDemo />
          </div>
        </section>
      </div>
    </main>
  );
}
