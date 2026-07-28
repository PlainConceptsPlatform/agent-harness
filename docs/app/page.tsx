import { ArrowRight, Github } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { asset } from '@/lib/asset'
import {
  Footer,
  InstallBox,
  Navbar,
  Reveal,
  TerminalDemo,
} from '@/components/landing'

const INSTALL = 'npx opencode-onboard@latest'

const NPM_URL = 'https://www.npmjs.com/package/opencode-onboard'

/* shields.io badges, matching the set in README.md. Rendered as plain <img>
   rather than next/image: they are remote SVGs with no intrinsic size, and
   next/image would need remotePatterns plus a loader that static export
   cannot run. */
const badges = [
  { alt: 'npm version', src: 'https://img.shields.io/npm/v/opencode-onboard?style=flat-square&color=black', href: NPM_URL },
  { alt: 'npm downloads', src: 'https://img.shields.io/npm/dm/opencode-onboard?style=flat-square&color=black', href: NPM_URL },
  { alt: 'license', src: 'https://img.shields.io/npm/l/opencode-onboard?style=flat-square&color=black', href: 'https://github.com/PlainConceptsPlatform/opencode-onboard/blob/main/LICENSE' },
  { alt: 'node version', src: 'https://img.shields.io/node/v/opencode-onboard?style=flat-square&color=black', href: 'https://nodejs.org' },
]

const wires = [
  {
    name: 'OpenCode',
    href: 'https://opencode.ai',
    text: 'The agent runtime. Native parallel subagent waves, no external plugins, no git worktrees.',
  },
  {
    name: 'OpenSpec',
    href: 'https://github.com/fission-ai/openspec',
    text: 'Structured change management: proposals, specs, and tasks for every piece of work.',
  },
  {
    name: 'codegraph',
    href: 'https://github.com/colbymchenry/codegraph',
    text: 'Code intelligence and indexing so agents understand your codebase before touching it.',
  },
  {
    name: 'agentmemory',
    href: 'https://github.com/rohitg00/agentmemory',
    text: 'Shared context across agent sessions, decisions persist beyond a single conversation.',
  },
]

const steps = [
  {
    title: 'Source scope',
    text: 'Choose current repo or sibling source roots for code analysis.',
  },
  {
    title: 'Clean AI files',
    text: 'Detects existing AGENTS.md, .cursorrules and CLAUDE.md and removes them. Your .agents/skills/ are preserved.',
  },
  {
    title: 'Choose platform',
    text: 'Backlog (GitHub / Azure DevOps / Jira / Browser / None) plus repo (GitHub / Azure DevOps / GitLab / None). Mix freely.',
  },
  {
    title: 'Check platform CLI',
    text: 'Verifies gh, az + azure-devops, acli, or glab as needed.',
  },
  {
    title: 'Copy scaffolding',
    text: 'Agents, built-in skills, bootstrap docs, source-roots metadata, then runs npx skills.',
  },
  {
    title: 'Init OpenSpec',
    text: 'Runs npx @fission-ai/openspec init silently for structured change management.',
  },
  {
    title: 'Choose models',
    text: 'Live list from models.dev; pick plan / build / fast models with canonical cost indicators.',
  },
  {
    title: 'Token optimization',
    text: 'Optional checklist: RTK, opencode-quota, caveman, codegraph, agentmemory, humanizer, and token-optimization rule injection into guardrails.',
  },
  {
    title: 'Browser plugin',
    text: 'Installs @different-ai/opencode-browser for agent browser automation.',
  },
  {
    title: 'Write metadata',
    text: 'Saves .opencode/opencode-onboard.json so reruns and teammates reuse your setup.',
  },
]

const commandGroups = [
  {
    group: 'repo',
    items: [
      ['/repo-help', 'Show all commands and when to use each one. Start here if you are unsure.'],
      ['/repo-onboard', 'Guided tour of the project and its agentic infrastructure. Read-only.'],
      ['/repo-audit', 'Read-only audit of every configured source root against abilities and guardrails.'],
      ['/repo-initialize', 'Initialize the project. Asks greenfield versus brownfield, then activates the agent team.'],
      ['/repo-verify', 'Verify and repair current-branch changes, and run installs, builds, and tests for every discovered project.'],
    ],
  },
  {
    group: 'plan',
    items: [
      ['/plan-explore', 'Think through an idea or investigate a problem before committing to a plan.'],
      ['/plan-propose', 'Parse an issue URL or idea into a structured plan: proposal, specs, tasks.'],
      ['/plan-quick', 'Quick plan for focused changes. Creates a task checklist and stops.'],
      ['/plan-apply', 'Implement tasks from the current plan. OpenSpec tasks run as parallel subagent waves.'],
      ['/plan-archive', 'Archive a completed OpenSpec change.'],
      ['/plan-goal', 'Autonomous pipeline: branch, explore, propose, apply, archive. One commit per phase.'],
    ],
  },
  {
    group: 'ops',
    items: [
      ['/ops-ship', 'Create a pull request for the current branch, with screenshots if the UI changed.'],
      ['/ops-review', 'Read and triage pull request review feedback. Reports what needs fixing.'],
      ['/ops-backlog', 'Create an issue in the backlog platform from a description.'],
      ['/ops-evidence', 'Produce evidence a change works, write evidence.json, and publish a verified comment.'],
    ],
  },
  {
    group: 'make',
    items: [
      ['/make-engineer', 'Persona-driven form to add a custom specialist engineer with a recommended skill set.'],
      ['/make-architecture', 'Generate or regenerate ARCHITECTURE.md from the codebase.'],
      ['/make-design', 'Generate or regenerate DESIGN.md from the design system.'],
      ['/make-guardrails', 'Generate an ob-guardrails-project skill from ARCHITECTURE.md and project config.'],
      ['/make-evidence-scaffold', 'One-time scaffold of a project-specific visual-evidence harness.'],
      ['/make-user-model', 'Set the model for a tier (plan, build, or fast) per team or per user.'],
    ],
  },
] as const

const pipeline = [
  {
    title: 'Parse work item',
    text: 'The platform userstory skill turns a GitHub / Azure DevOps / Jira / browser URL into a structured work item.',
  },
  {
    title: 'Propose',
    text: '/plan-propose produces proposal.md, specs, and tasks.md, enriched with agent and model assignments.',
  },
  {
    title: 'Confirm',
    text: 'You review the plan before any implementation starts.',
  },
  {
    title: 'Parallel subagent waves',
    text: 'Engineers spawn in parallel, each carries its own model tier, implements its tasks, and returns. The lead commits each group.',
    highlight: true,
  },
  {
    title: 'Verify',
    text: "/repo-verify runs every discovered project's immutable dependency installs, builds, and tests, plus change-aware guardrails.",
  },
  {
    title: 'Ship',
    text: 'Commit, push, PR, review feedback loop, handled by the lead.',
  },
]

const pillars = [
  {
    title: 'Agents: how to work',
    text: 'Universal personas: a lead orchestrator plus ability-driven engineers. Add project specialists with /make-engineer.',
  },
  {
    title: 'Skills: what to know',
    text: 'Platform knowledge and project rules, auto-detected and auto-loaded. Drop a SKILL.md in .agents/skills/ and agents pick it up.',
  },
  {
    title: 'Models: plan / build / fast',
    text: 'Three tiers picked from 3000+ live models: strong reasoning for the lead, capable for engineers, fast and cheap for helpers.',
  },
]

function SectionHeading({
  children,
  sub,
}: {
  children: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Reveal>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{children}</h2>
      {sub && <p className="mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
    </Reveal>
  )
}

export default function LandingPage() {
  return (
    <>
      <Navbar />

      <main id="top" className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px]"
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
            <Image
              src={asset('/assets/logo.png')}
              alt="opencode-onboard, a friendly toolbox"
              width={120}
              height={120}
              priority
              className="rounded-2xl"
            />
            <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Prepare any codebase <span className="text-primary">for AI</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              One interactive wizard that wires OpenCode, OpenSpec, codegraph and
              agentmemory into a multi-agent development workflow powered by
              native parallel subagents.
            </p>

            <div className="mt-9">
              <InstallBox command={INSTALL} size="lg" />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:translate-y-px"
              >
                Read the docs
                <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/PlainConceptsPlatform/opencode-onboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground active:translate-y-px"
              >
                <Github size={16} />
                Star on GitHub
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {badges.map((b) => (
                <a
                  key={b.alt}
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-80"
                >
                  <img src={b.src} alt={b.alt} height={20} className="h-5" />
                </a>
              ))}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              GitHub &middot; Azure DevOps &middot; Jira &middot; GitLab &middot;
              browser-based backlogs, or any combination.
            </p>
          </div>
        </section>

        {/* ── Terminal ── */}
        <section className="border-b py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal>
              <TerminalDemo />
            </Reveal>
          </div>
        </section>

        {/* ── The problem ── */}
        <section className="border-b py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading>Agents shouldn&apos;t improvise</SectionHeading>
            <Reveal delay={80}>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Most codebases have no <code>AGENTS.md</code>, no architecture docs
                agents can read, and no defined workflow for picking up tasks.
                Agents end up improvising, producing inconsistent results.{' '}
                <strong className="text-foreground">
                  opencode-onboard fixes that in a single interactive wizard.
                </strong>{' '}
                It installs an agent team, platform skills, slash commands, and
                structured change management. Everything agents need to plan,
                implement, and ship.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── What it wires together ── */}
        <section id="wires" className="border-b py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading>What it wires together</SectionHeading>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {wires.map((w, i) => (
                <Reveal key={w.name} delay={i * 60}>
                  <a
                    href={w.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <h3 className="font-mono text-sm font-semibold text-primary">
                      {w.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {w.text}
                    </p>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── The 10-step wizard ── */}
        <section id="how-it-works" className="border-b py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading sub="Run it once. Progress stays visible the whole way through.">
              The 10-step wizard
            </SectionHeading>
            <ol className="mt-10 space-y-1">
              {steps.map((s, i) => (
                <Reveal key={s.title} delay={i * 40}>
                  <li className="flex gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/60">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {s.text}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
            <Reveal delay={120}>
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Then open OpenCode in your project and type{' '}
                <code className="font-mono text-primary">/repo-initialize</code>.
                Brownfield projects get <code>ARCHITECTURE.md</code> and{' '}
                <code>DESIGN.md</code> generated from the actual codebase.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Commands ── */}
        <section id="commands" className="border-b py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading sub="Custom commands land in .opencode/commands/ and are available directly in OpenCode.">
              Slash commands, installed and ready
            </SectionHeading>
            <div className="mt-10 space-y-8">
              {commandGroups.map((g) => (
                <div key={g.group}>
                  <Reveal>
                    <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      /{g.group}-&ast;
                    </h3>
                  </Reveal>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map(([cmd, desc], i) => (
                      <Reveal key={cmd} delay={(i % 3) * 60}>
                        <div className="flex h-full flex-col rounded-lg border bg-card p-4">
                          <code className="font-mono text-sm font-semibold text-primary">
                            {cmd}
                          </code>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {desc}
                          </p>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pipeline ── */}
        <section id="pipeline" className="border-b py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading sub="Give the lead agent a work item URL and execution flows through a defined pipeline.">
              The pipeline
            </SectionHeading>
            <div className="mt-10 space-y-3">
              {pipeline.map((p, i) => (
                <Reveal key={p.title} delay={i * 50}>
                  <div
                    className={`flex gap-4 rounded-xl border p-5 ${
                      p.highlight
                        ? 'border-primary/40 bg-accent/60'
                        : 'bg-card'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {p.text}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agents, skills, models ── */}
        <section id="agents" className="border-b py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading>Agents, skills, and model tiers</SectionHeading>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {pillars.map((p, i) => (
                <Reveal key={p.title} delay={i * 70}>
                  <div className="flex h-full flex-col rounded-xl border bg-card p-6">
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {p.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo ── */}
        <section className="border-b py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading>See it run</SectionHeading>
            <Reveal delay={80}>
              <div className="mt-8 overflow-hidden rounded-xl border">
                <Image
                  src={asset('/assets/demo.gif')}
                  alt="opencode-onboard wizard demo"
                  width={1200}
                  height={700}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="get-started" className="py-24">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get started
              </h2>
              <div className="mt-8 flex justify-center">
                <InstallBox command={INSTALL} size="lg" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Requires Node.js 18+. Joining an already-onboarded project? Run{' '}
                <code>npx opencode-onboard join</code>
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:translate-y-px"
                >
                  Read the docs
                  <ArrowRight size={15} />
                </Link>
                <a
                  href="https://github.com/PlainConceptsPlatform/opencode-onboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground active:translate-y-px"
                >
                  <Github size={16} />
                  Star on GitHub
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
