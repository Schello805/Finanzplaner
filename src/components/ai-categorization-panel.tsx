"use client";
/* Der Initiallauf liest die beim Einhängen gültige Einwilligung genau einmal. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
type Mode = "minimal" | "full_text";
type Preview = {
  count: number;
  batchSize: number;
  provider: "openai" | "gemini";
  model: string;
  privacyMode: Mode;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    currency: string;
    merchant?: string;
    purpose?: string;
  }>;
  cost: { approximateInputTokens: number; lowEur: number; highEur: number };
};
type Suggestion = {
  id: string;
  category: string;
  categoryId: string;
  confidence: number;
  reason: string;
};
type CategoryProposal = {
  name: string;
  isIncome: boolean;
  transactionIds: string[];
  confidence: number;
  reason: string;
};
export function AiCategorizationPanel({
  onApplied,
}: {
  onApplied: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categoryProposals, setCategoryProposals] = useState<CategoryProposal[]>([]);
  const [mode, setMode] = useState<Mode>("minimal");
  async function requestPreview(nextMode: Mode, preserveMessage = false) {
    const response = await fetch(`/api/ai/categorize?privacyMode=${nextMode}`);
    const body = await response.json();
    if (response.ok && body.available === false) {
      setPreview(null);
      setMessage(body.error ?? "KI-Anbieter ist noch nicht eingerichtet.");
      return null;
    }
    if (response.ok) {
      setPreview(body);
      if (!preserveMessage) setMessage("");
      return body as Preview;
    }
    setMessage(body.error ?? "KI-Vorschau konnte nicht geladen werden.");
    return null;
  }
  async function analyze(
    current: Preview,
    currentMode: Mode,
    automatic = false,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: current.transactions.map((t) => t.id),
          privacyMode: currentMode,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "KI-Kategorisierung fehlgeschlagen.");
        return;
      }
      setMessage(
        `${automatic ? "Automatische Analyse abgeschlossen: " : ""}${body.applied} sichere Zuordnungen übernommen. ${body.suggestions.length} Zuordnungen und ${body.categoryProposals.length} neue Kategorien müssen geprüft werden. Kosten: ${Number(body.estimatedCostEur).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 4 })}.`,
      );
      setSuggestions(body.suggestions);
      setCategoryProposals(body.categoryProposals);
      await requestPreview(currentMode, true);
      onApplied();
    } catch {
      setMessage("Die Verbindung zur KI-Analyse wurde unterbrochen. Bitte warte kurz und lade die Seite neu, um den aktuellen Stand zu prüfen, bevor du den Stapel erneut startest.");
    } finally {
      setBusy(false);
    }
  }
  async function acceptSuggestion(suggestion: Suggestion) {
    setBusy(true);
    const response = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: suggestion.id, categoryId: suggestion.categoryId }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error ?? "Vorschlag konnte nicht übernommen werden.");
      return;
    }
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    await requestPreview(mode);
    onApplied();
  }
  async function createCategory(proposal: CategoryProposal) {
    setBusy(true);
    setMessage("");
    try {
      const categoryResponse = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: proposal.name,
          color: proposal.isIncome ? "#2f855a" : "#7c898c",
          icon: "Tag",
          isIncome: proposal.isIncome,
          parentId: null,
        }),
      });
      const category = await categoryResponse.json();
      if (!categoryResponse.ok) throw new Error(category.error);
      for (const id of proposal.transactionIds) {
        const response = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, categoryId: category.id }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
      }
      setCategoryProposals((current) => current.filter((item) => item !== proposal));
      setMessage(`Kategorie „${proposal.name}“ wurde angelegt und ${proposal.transactionIds.length} ${proposal.transactionIds.length === 1 ? "Umsatz" : "Umsätzen"} zugeordnet.`);
      await requestPreview(mode, true);
      onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kategorie konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }
  async function acceptAll() {
    setBusy(true);
    setMessage("");
    try {
      for (const suggestion of suggestions) {
        const response = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: suggestion.id, categoryId: suggestion.categoryId }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
      }
      for (const proposal of categoryProposals) {
        const categoryResponse = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: proposal.name, color: proposal.isIncome ? "#2f855a" : "#7c898c", icon: "Tag", isIncome: proposal.isIncome, parentId: null }),
        });
        const category = await categoryResponse.json();
        if (!categoryResponse.ok) throw new Error(category.error);
        for (const id of proposal.transactionIds) {
          const response = await fetch("/api/transactions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, categoryId: category.id }),
          });
          if (!response.ok) throw new Error((await response.json()).error);
        }
      }
      const count = suggestions.length + categoryProposals.reduce((sum, proposal) => sum + proposal.transactionIds.length, 0);
      setSuggestions([]);
      setCategoryProposals([]);
      setMessage(`${count} KI-Vorschläge wurden gesammelt bestätigt.`);
      await requestPreview(mode, true);
      onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Vorschläge konnten nicht vollständig übernommen werden.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    Promise.all([
      fetch("/api/user/preferences").then((r) => r.json()),
      fetch("/api/ai/categorize?privacyMode=minimal").then((r) => r.json()),
    ]).then(async ([preferences, initial]) => {
      const selectedMode: Mode =
        preferences.aiPrivacyMode === "full_text" ? "full_text" : "minimal";
      setMode(selectedMode);
      const current =
        selectedMode === "minimal"
          ? initial.available === false
            ? null
            : initial
          : await requestPreview(selectedMode);
      if (selectedMode === "minimal" && initial.available !== false && initial.count) setPreview(initial);
      if (selectedMode === "minimal" && initial.available === false) setPreview(null);
      if (selectedMode === "minimal" && initial.error) setMessage(initial.error);
      if (preferences.automaticCategorization && current?.count) {
        const key = `finanzplaner-auto-ai:${current.transactions.map((item: { id: string }) => item.id).join(",")}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "started");
          await analyze(current, selectedMode, true);
        }
      }
    });
  }, []);
  async function changeMode(next: Mode) {
    setMode(next);
    await requestPreview(next);
  }
  if (!preview?.count && !message) return null;
  return (
    <section className="card border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] p-5">
      {preview?.count ? (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-bold">
                  {preview.count} nicht zugeordnete Umsätze
                </h2>
                <p className="mt-1 text-sm muted">
                  Mit {preview.provider === "openai" ? "OpenAI" : "Gemini"} ·{" "}
                  {preview.model} analysieren · nächster Stapel: {preview.batchSize}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || suggestions.length > 0 || categoryProposals.length > 0}
                onClick={() => analyze(preview, mode)}
                className="btn-primary"
              >
                <Sparkles size={16} />
                {busy
                  ? "KI analysiert …"
                  : suggestions.length > 0 || categoryProposals.length > 0
                    ? "Vorschläge zuerst prüfen"
                    : `${preview.batchSize} jetzt mit KI zuordnen`}
              </button>
              <button
                onClick={() => setOpen((v) => !v)}
                className="btn-secondary"
                aria-expanded={open}
              >
                Details & Kosten <ChevronDown size={16} />
              </button>
            </div>
          </div>
          {open && (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                  <input
                    type="radio"
                    checked={mode === "minimal"}
                    onChange={() => changeMode("minimal")}
                    className="mr-2 accent-[var(--primary)]"
                  />
                  <strong>Datensparsam</strong>
                  <span className="mt-1 block muted">
                    Namen und Identifikatoren werden bereinigt.
                  </span>
                </label>
                <label className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                  <input
                    type="radio"
                    checked={mode === "full_text"}
                    onChange={() => changeMode("full_text")}
                    className="mr-2 accent-[var(--primary)]"
                  />
                  <strong>Beste Erkennung</strong>
                  <span className="mt-1 block muted">
                    Vollständiger Buchungstext, weiterhin ohne IBAN.
                  </span>
                </label>
              </div>
              <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <ShieldCheck size={17} /> Diese Daten werden übertragen
                </div>
                <div className="mt-3 max-h-52 space-y-2 overflow-auto text-xs">
                  {preview.transactions.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg bg-[var(--surface-soft)] p-3"
                    >
                      {t.date} ·{" "}
                      {t.amount.toLocaleString("de-DE", {
                        style: "currency",
                        currency: t.currency,
                      })}{" "}
                      · {t.merchant ?? "Unbekannt"}
                      <div className="mt-1 muted">{t.purpose}</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm">
                <strong>Kostenschätzung:</strong>{" "}
                {preview.cost.lowEur.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 4,
                })}
                –
                {preview.cost.highEur.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 4,
                })}{" "}
                · ca.{" "}
                {preview.cost.approximateInputTokens.toLocaleString("de-DE")}{" "}
                Eingabe-Tokens
              </p>
            </div>
          )}
        </>
      ) : null}
      {message && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm"
        >
          {message}
          {(message.includes("eingerichtet") || message.includes("Adminbereich")) && (
            <span className="mt-3 block">
              Ein Administrator kann den Anbieter unter{" "}
              <Link href="/admin/ki" className="font-semibold text-[var(--primary)]">
                Admin · KI-Anbieter
              </Link>{" "}
              einrichten.
            </span>
          )}
        </div>
      )}
      {suggestions.length + categoryProposals.length > 1 && (
        <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-4">
          <button type="button" disabled={busy} onClick={acceptAll} className="btn-primary">
            Alle Vorschläge bestätigen
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div>
            <h3 className="font-bold">KI-Vorschläge prüfen</h3>
            <p className="mt-1 text-sm muted">
              Unsichere Treffer werden erst nach deiner Bestätigung gespeichert.
            </p>
          </div>
          {suggestions.map((suggestion) => {
            const transaction = preview?.transactions.find(
              (item) => item.id === suggestion.id,
            );
            return (
              <article
                key={suggestion.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="font-semibold">
                    {transaction?.merchant ?? "Unbekannter Empfänger"}
                  </div>
                  <div className="mt-1 text-sm">
                    Vorschlag: <strong>{suggestion.category}</strong> ·{" "}
                    {(suggestion.confidence * 100).toFixed(0)} % Sicherheit
                  </div>
                  <div className="mt-1 text-xs muted">{suggestion.reason}</div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => acceptSuggestion(suggestion)}
                  className="btn-secondary shrink-0"
                >
                  Übernehmen
                </button>
              </article>
            );
          })}
        </div>
      )}
      {categoryProposals.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div>
            <h3 className="font-bold">Neue Kategorien vorgeschlagen</h3>
            <p className="mt-1 text-sm muted">Diese Kategorien werden erst nach deiner Bestätigung angelegt.</p>
          </div>
          {categoryProposals.map((proposal) => (
            <article key={`${proposal.isIncome}-${proposal.name}`} className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center">
              <div>
                <div className="font-semibold">{proposal.name}</div>
                <div className="mt-1 text-sm">{proposal.isIncome ? "Einnahme" : "Ausgabe"} · für {proposal.transactionIds.length} {proposal.transactionIds.length === 1 ? "Umsatz" : "Umsätze"} · {(proposal.confidence * 100).toFixed(0)} % Sicherheit</div>
                <div className="mt-1 text-xs muted">{proposal.reason}</div>
              </div>
              <button type="button" disabled={busy} onClick={() => createCategory(proposal)} className="btn-secondary shrink-0">
                Kategorie anlegen & zuordnen
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
