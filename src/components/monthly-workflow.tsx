"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Check, ChevronRight, FileUp, ShieldCheck, Sparkles } from "lucide-react";

type Status = {
  accountCount: number;
  transactionCount: number;
  uncategorizedCount: number;
  reviewCount: number;
  deferredCount: number;
  amazonOpenCount: number;
  unresolvedSources: { amazon: number; paypal: number; card: number };
  lastImportAt: string | null;
  aiConfigured: boolean;
  bankConnected: boolean;
};

type Step = { title: string; detail: string; href: string; done: boolean; icon: typeof FileUp };

export function MonthlyWorkflow() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/workflow/status")
      .then((response) => response.json())
      .then((body) => {
        if (typeof body.accountCount === "number") setStatus(body);
      });
  }, []);

  if (!status) return null;

  const sourceTotal = Object.values(status.unresolvedSources ?? {}).reduce((sum, value) => sum + value, 0);
  const decisionsOpen = status.reviewCount + status.deferredCount;
  // Amazon-Bestellungen ohne nachgewiesenen Bankumsatz sind keine Ausgaben und blockieren die Analyse nicht.
  const clarified = status.transactionCount > 0 && status.uncategorizedCount === 0 && decisionsOpen === 0;
  const sourceDetail = [
    status.unresolvedSources.amazon ? `${status.unresolvedSources.amazon} Amazon` : null,
    status.unresolvedSources.paypal ? `${status.unresolvedSources.paypal} PayPal` : null,
    status.unresolvedSources.card ? `${status.unresolvedSources.card} Karte` : null,
  ].filter(Boolean).join(" · ") || null;

  const steps: Step[] = [
    {
      title: status.bankConnected ? "Umsätze aktualisieren" : "Umsätze importieren",
      detail: status.lastImportAt
        ? `Letzter Import: ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(status.lastImportAt))}`
        : status.accountCount ? "Bank, Kreditkarte oder PayPal einlesen" : "Zuerst ein Konto anlegen",
      href: status.accountCount ? (status.bankConnected ? "/einstellungen/sparkasse" : "/einstellungen/import") : "/konten",
      done: status.transactionCount > 0,
      icon: FileUp,
    },
    {
      title: "Offene Umsätze zuordnen",
      detail: status.uncategorizedCount
        ? sourceDetail
          ? `${status.uncategorizedCount} offen · für ${sourceDetail} können Zusatzimporte helfen`
          : `${status.uncategorizedCount} offen${status.aiConfigured ? " · KI kann die Restmenge bearbeiten" : " · KI ist noch nicht eingerichtet"}`
        : "Regeln, Abos und eindeutige Zuordnungen sind erledigt",
      href: sourceTotal ? (status.unresolvedSources.amazon ? "/einstellungen/amazon" : "/einstellungen/import") : "/umsaetze",
      done: status.transactionCount > 0 && status.uncategorizedCount === 0,
      icon: Sparkles,
    },
    {
      title: "Unsichere Vorschläge prüfen",
      detail: decisionsOpen ? `${status.reviewCount} zu prüfen · ${status.deferredCount} für später vorgemerkt` : "Keine Entscheidung offen",
      href: "/umsaetze?confidence=review",
      done: status.transactionCount > 0 && decisionsOpen === 0,
      icon: ShieldCheck,
    },
    {
      title: "Auswertung ansehen",
      detail: clarified
        ? "Alle Bankumsätze sind für die Auswertung geklärt"
        : status.transactionCount ? "Schon sichtbar; nach den offenen Schritten vollständig" : "Nach dem ersten Import verfügbar",
      href: "#analyse",
      done: clarified,
      icon: BarChart3,
    },
  ];

  const nextIndex = clarified ? steps.length - 1 : Math.max(0, steps.findIndex((step) => !step.done));
  const next = steps[nextIndex];
  const NextIcon = next.icon;
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="card border-[var(--primary)] p-5 sm:p-6" aria-label="Monatsabschluss">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary)]">Monatsabschluss · nächster Schritt</p>
          <h2 className="mt-1 text-xl font-bold">{next.title}</h2>
          <p className="mt-2 text-sm leading-6 muted">{next.detail}</p>
        </div>
        <div className="shrink-0">
          <div className="mb-2 text-right text-xs font-semibold muted">{completed}/{steps.length} erledigt</div>
          <Link href={next.href} className="btn-primary w-full sm:w-auto"><NextIcon size={17} />Weiter<ChevronRight size={17} /></Link>
        </div>
      </div>

      {status.amazonOpenCount > 0 && status.unresolvedSources.amazon === 0 && (
        <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-xs muted">
          {status.amazonOpenCount} Amazon-Zahlungsgruppen sind noch nicht mit einer Bankbuchung verknüpft. Sie werden nicht als zusätzliche Ausgaben gezählt und blockieren den Monatsabschluss nicht.
        </p>
      )}

      <details className="mt-5 border-t border-[var(--border)] pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Alle vier Schritte anzeigen</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {steps.map(({ title, detail, href, done, icon: Icon }, index) => (
            <Link key={title} href={href} className={`flex items-start gap-3 rounded-xl border p-4 text-[var(--text)] no-underline hover:bg-[var(--surface-soft)] ${index === nextIndex ? "border-[var(--primary)]" : "border-[var(--border)]"}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-800" : "bg-[var(--surface-soft)] text-[var(--primary)]"}`}>{done ? <Check size={17} /> : index + 1}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold"><Icon size={16} />{title}</span><span className="mt-1 block text-sm muted">{detail}</span></span>
              <ChevronRight size={18} className="mt-2 shrink-0 muted" />
            </Link>
          ))}
        </div>
      </details>
    </section>
  );
}
