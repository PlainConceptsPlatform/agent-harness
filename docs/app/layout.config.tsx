import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { asset } from "@/lib/asset";
import { cliVersion, siteName } from "@/lib/site";

/** Shared nav/branding for every layout, as in Foundations' layout.config.tsx. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image
          src={asset("/assets/logo.png")}
          alt=""
          width={24}
          height={24}
          className="shrink-0 rounded"
        />
        <span className="font-semibold">{siteName}</span>
        {/* A trust signal, not decoration, so it stays plain and muted. */}
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          v{cliVersion}
        </span>
      </>
    ),
    url: "/",
  },
  // No `links`: the sidebar is the navigation. The navbar keeps search, the theme
  // toggle and the repo link, matching Foundations.
  githubUrl: "https://github.com/PlainConceptsPlatform/agent-harness",
};
