"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    } else {
      setPreview(null);
      setFile(null);
      setKeepSuspected(new Set());
      setHistoryVersion((version) => version + 1);
      router.push("/umsaetze");
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Einstellungen · Daten"
        title="Kontoauszug importieren"
        description="Die Originaldatei wird nach dem erfolgreichen Import automatisch gelöscht."
      />
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
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Erkannt", preview.total],
              ["Bereit", preview.ready],
              ["Sichere Dubletten", preview.exactDuplicates],
              ["Zu prüfen", preview.suspected.length],
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
          <button onClick={() => upload("commit")} className="btn-primary mt-5">
            {preview.ready + keepSuspected.size} Umsätze importieren
          </button>
        </section>
      )}
      <ImportHistory refreshKey={historyVersion} />
    </div>
  );
}
