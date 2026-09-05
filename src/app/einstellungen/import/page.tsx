"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ImportHistory } from "@/components/import-history";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; bankName: string }>
  >([]);
  const [templateId, setTemplateId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [accountId, setAccountId] = useState("");
  const [preview, setPreview] = useState<{
    total: number;
    alreadyImported: boolean;
    ignoredPending: number;
    storedPending: number;
    statementPeriod: { from: string; to: string } | null;
    reconciliationSkippedReason: string | null;
    missingStored: Array<{
      id: string;
      date: string;
      amount: number;
      currency: string;
      counterparty: string;
      purpose: string;
    }>;
    ready: number;
    exactDuplicates: number;
    suspected: Array<{
      incoming: {
        fingerprint: string;
        date: string;
        amount: number;
        currency: string;
        counterparty: string;
      };
      existing: {
        fingerprint: string;
        date: string;
        amount: number;
        currency: string;
        counterparty: string;
      };
    }>;
    warnings: string[];
  } | null>(null);
  const [keepSuspected, setKeepSuspected] = useState<Set<string>>(new Set());
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/import/templates").then((r) => r.json()),
    ]).then(([accountRows, templateRows]) => {
      if (Array.isArray(accountRows)) {
        setAccounts(accountRows);
        setAccountId(accountRows[0]?.id ?? "");
      }
      if (Array.isArray(templateRows)) {
        setTemplates(templateRows);
        setTemplateId(templateRows[0]?.id ?? "");
      }
    });
  }, []);
  async function upload(mode: "preview" | "commit") {
    if (!file || !accountId) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("accountId", accountId);
    form.set("templateId", templateId);
    form.set("mode", mode);
    form.set("keepSuspected", JSON.stringify([...keepSuspected]));
    const response = await fetch("/api/import", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error);
      return;
    }
    if (mode === "preview") {
      setPreview(body);
      setKeepSuspected(new Set());
      setSelectedMissing(new Set());
    } else {
      sessionStorage.setItem("finanzplaner-last-import", JSON.stringify({ imported: body.imported, locallyCategorized: body.locallyCategorized ?? 0, ignoredPending: body.ignoredPending ?? 0 }));
      setPreview(null);
      setFile(null);
      setKeepSuspected(new Set());
      setHistoryVersion((version) => version + 1);
      router.push("/umsaetze");
    }
  }
  async function deleteStoredPending() {
    if (!preview?.storedPending || !accountId) return;
    if (!window.confirm(`${preview.storedPending} bereits gespeicherte vorgemerkte Umsätze wirklich löschen?`)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/import", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setPreview((current) => current ? { ...current, storedPending: 0 } : current);
    setCleanupMessage(`${body.deleted} bereits gespeicherte vorgemerkte Umsätze wurden gelöscht.`);
  }
  async function deleteSelectedMissing() {
    if (!selectedMissing.size || !accountId) return;
    if (!window.confirm(`${selectedMissing.size} ausgewählte, im neuen Kontoauszug fehlende Umsätze wirklich löschen?`)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/import", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, transactionIds: [...selectedMissing] }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setPreview((current) => current ? {
      ...current,
      missingStored: current.missingStored.filter((item) => !selectedMissing.has(item.id)),
    } : current);
    setSelectedMissing(new Set());
    setCleanupMessage(`${body.deleted} ausgewählte fehlende Umsätze wurden gelöscht.`);
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Einstellungen · Daten"
        title="Kontoauszug importieren"
        description="Die Originaldatei wird nach dem erfolgreichen Import automatisch gelöscht."
      />
      <nav aria-label="Importablauf" className="card p-4">
        <ol className="grid gap-2 sm:grid-cols-4">
          {["Datei auswählen", "Änderungen prüfen", "Kategorien bestätigen", "Analyse ansehen"].map((label, index) => (
            <li key={label} className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${index === (preview ? 1 : 0) ? "bg-[var(--surface-soft)] text-[var(--primary)]" : "muted"}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current">{index + 1}</span>
              <span className="flex-1">{label}</span>
              {index < 3 && <ArrowRight size={14} className="hidden sm:block" />}
            </li>
          ))}
        </ol>
      </nav>
      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <article className="card p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]">
              <FileUp />
            </div>
            <div>
              <h2 className="font-bold">CSV-Datei auswählen</h2>
              <p className="mt-1 text-sm muted">
                Aktiviertes Bankformat · maximal 20 MB
              </p>
            </div>
          </div>
          <label className="mt-5 block text-sm font-semibold">
            Zielkonto
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">Konto auswählen</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Bankformat
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">Format auswählen</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.bankName} · {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center hover:border-[var(--primary)]">
            <Upload size={30} className="text-[var(--primary)]" />
            <span className="mt-3 font-bold">
              Datei hier ablegen oder auswählen
            </span>
            <span className="mt-1 text-sm muted">
              Nur CSV-Dateien werden akzeptiert
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-3 text-sm leading-6 muted">
            Vorgemerkte Sparkassen-Umsätze mit dem Empfänger „**Unbekannt“
            werden bewusst nicht importiert. Lade sie erst wieder hoch, sobald
            sie von der Bank endgültig gebucht wurden.
          </p>
          {file && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-[var(--primary)]" />
                <div>
                  <div className="font-semibold">{file.name}</div>
                  <div className="text-xs muted">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <CheckCircle2 className="text-[var(--accent)]" />
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {cleanupMessage && (
            <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              {cleanupMessage}
            </div>
          )}
          <button
            onClick={() => upload("preview")}
            className="btn-primary mt-5 w-full"
            disabled={!file || !accountId || !templateId || busy}
          >
            {busy ? "Prüfung läuft …" : "Datei lokal prüfen"}
          </button>
        </article>
        <div className="space-y-4">
          <article className="card p-5">
            <ShieldCheck className="text-[var(--primary)]" />
            <h2 className="mt-3 font-bold">Privat verarbeitet</h2>
            <p className="mt-2 text-sm leading-6 muted">
              Import, Normalisierung und Dublettenprüfung laufen vollständig auf
              deinem Finanzplaner. Erst eine gesonderte KI-Freigabe überträgt
              ausgewählte Daten.
            </p>
          </article>
          <article className="card p-5">
            <AlertTriangle className="text-[var(--warning)]" />
            <h2 className="mt-3 font-bold">Dubletten sicher behandeln</h2>
            <p className="mt-2 text-sm leading-6 muted">
              Sichere Dubletten werden übersprungen. Ähnliche Buchungen
              entscheidest du in einer Gegenüberstellung selbst.
            </p>
          </article>
        </div>
      </section>
      {preview && (
        <section className="card p-5">
          <h2 className="font-bold">Importvorschau</h2>
          {preview.alreadyImported && (
            <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <strong>Diese Datei wurde bereits importiert.</strong>{" "}
              Die erneute Prüfung ist erlaubt, damit du Dubletten, Vormerkungen und inzwischen fehlende Umsätze kontrollieren kannst. Ein zweiter Import derselben Datei bleibt gesperrt.
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Erkannt", preview.total],
              ["Bereit", preview.ready],
              ["Sichere Dubletten", preview.exactDuplicates],
              ["Zu prüfen", preview.suspected.length],
              ["Vorgemerkt · ignoriert", preview.ignoredPending],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-[var(--surface-soft)] p-4"
              >
                <div className="text-xs font-semibold muted">{label}</div>
                <div className="mt-1 text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
          {preview.ignoredPending > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>{preview.ignoredPending} vorgemerkte Umsätze werden nicht importiert.</strong>{" "}
              Sie erscheinen im nächsten Export erneut, sobald die Sparkasse sie endgültig gebucht hat.
            </div>
          )}
          {preview.storedPending > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              <strong>{preview.storedPending} früher importierte Vormerkungen sind noch gespeichert.</strong>{" "}
              Diese Buchungen haben ebenfalls den Empfänger „**Unbekannt“ und können jetzt sicher aus diesem Konto entfernt werden.
              <button
                type="button"
                className="btn-secondary mt-3 border-red-300 text-red-800"
                onClick={deleteStoredPending}
                disabled={busy}
              >
                {preview.storedPending} alte Vormerkungen löschen
              </button>
            </div>
          )}
          {preview.missingStored.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>{preview.missingStored.length} gespeicherte Umsätze fehlen im neuen Export.</strong>
              <p className="mt-1 leading-6">
                Verglichen wurde nur der Zeitraum {preview.statementPeriod?.from} bis {preview.statementPeriod?.to}. Prüfe die Buchungen einzeln – ein kürzerer oder gefilterter Bankexport kann ebenfalls die Ursache sein.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => setSelectedMissing(new Set(preview.missingStored.map((item) => item.id)))}>
                  Alle markieren
                </button>
                {selectedMissing.size > 0 && (
                  <button type="button" className="btn-secondary" onClick={() => setSelectedMissing(new Set())}>
                    Auswahl aufheben
                  </button>
                )}
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {preview.missingStored.map((item) => (
                  <label key={item.id} className="flex cursor-pointer gap-3 rounded-lg border border-amber-200 bg-white p-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                      checked={selectedMissing.has(item.id)}
                      onChange={(event) => setSelectedMissing((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.id); else next.delete(item.id);
                        return next;
                      })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.counterparty}</span>
                      <span className="block break-words text-xs opacity-75">{item.date} · {item.purpose || "Kein Verwendungszweck"}</span>
                    </span>
                    <strong className="whitespace-nowrap">{item.amount.toLocaleString("de-DE", { style: "currency", currency: item.currency })}</strong>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn-secondary mt-3 border-red-300 text-red-800"
                onClick={deleteSelectedMissing}
                disabled={!selectedMissing.size || busy}
              >
                {selectedMissing.size || "Keine"} ausgewählte Umsätze löschen
              </button>
            </div>
          )}
          {preview.reconciliationSkippedReason && (
            <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <strong>Kein Löschabgleich für diesen Teilauszug.</strong>{" "}
              {preview.reconciliationSkippedReason} Vorhandene Umsätze bleiben unverändert; neue Umsätze und Dubletten werden trotzdem normal geprüft.
            </div>
          )}
          {preview.suspected.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="font-bold">Mögliche Dubletten entscheiden</h3>
              <p className="text-sm muted">
                Standardmäßig wird der neue Umsatz übersprungen. Aktiviere
                „Beide behalten“, wenn es zwei echte Buchungen sind.
              </p>
              {preview.suspected.map((pair) => (
                <article
                  key={pair.incoming.fingerprint}
                  className="rounded-xl border border-[var(--border)] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-bold uppercase muted">
                        Bereits gespeichert
                      </div>
                      <div className="mt-1 font-semibold">
                        {pair.existing.counterparty}
                      </div>
                      <div className="text-sm muted">
                        {pair.existing.date} ·{" "}
                        {pair.existing.amount.toLocaleString("de-DE", {
                          style: "currency",
                          currency: pair.existing.currency,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-[var(--primary)]">
                        Neu aus CSV
                      </div>
                      <div className="mt-1 font-semibold">
                        {pair.incoming.counterparty}
                      </div>
                      <div className="text-sm muted">
                        {pair.incoming.date} ·{" "}
                        {pair.incoming.amount.toLocaleString("de-DE", {
                          style: "currency",
                          currency: pair.incoming.currency,
                        })}
                      </div>
                    </div>
                  </div>
                  <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={keepSuspected.has(pair.incoming.fingerprint)}
                      onChange={(e) =>
                        setKeepSuspected((current) => {
                          const next = new Set(current);
                          if (e.target.checked)
                            next.add(pair.incoming.fingerprint);
                          else next.delete(pair.incoming.fingerprint);
                          return next;
                        })
                      }
                      className="h-5 w-5 accent-[var(--primary)]"
                    />
                    Beide Umsätze behalten
                  </label>
                </article>
              ))}
            </div>
          )}
          {!preview.alreadyImported && (
            <button onClick={() => upload("commit")} className="btn-primary mt-5">
              {preview.ready + keepSuspected.size} Umsätze importieren
            </button>
          )}
        </section>
      )}
      <ImportHistory refreshKey={historyVersion} />
    </div>
  );
}
