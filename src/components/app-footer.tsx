import { Github } from "lucide-react";

export function AppFooter() {
  const revision = process.env.APP_VERSION ?? process.env.npm_package_version ?? "dev";
  const releaseTag = revision === "dev" ? null : revision.startsWith("v") ? revision : `v${revision}`;
  const releaseUrl = releaseTag ? `https://github.com/Schello805/Finanzplaner/releases/tag/${releaseTag}` : "https://github.com/Schello805/Finanzplaner";
  return <footer className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-center text-xs muted sm:flex-row sm:text-left">
    <span>Quelloffenes Projekt für nichtkommerzielle Nutzung von Michael Schellenberger</span>
    <span className="flex items-center gap-3">
      <a href="https://github.com/Schello805/Finanzplaner" target="_blank" rel="noreferrer" aria-label="Finanzplaner auf GitHub" className="text-[var(--muted)] hover:text-[var(--primary)]"><Github size={18} /></a>
      <a href={releaseUrl} target="_blank" rel="noreferrer" className="text-[var(--muted)] underline decoration-dotted underline-offset-4">Rev. {releaseTag ?? revision}</a>
    </span>
  </footer>;
}
