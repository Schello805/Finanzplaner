"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileUp, ShieldCheck, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  return <div className="space-y-7">
    <PageHeader eyebrow="Einstellungen · Daten" title="Kontoauszug importieren" description="Die Originaldatei wird nach dem erfolgreichen Import automatisch gelöscht." />
    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <article className="card p-5 sm:p-7">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><FileUp/></div><div><h2 className="font-bold">CSV-Datei auswählen</h2><p className="mt-1 text-sm muted">Sparkasse CSV-CAMT V8 · maximal 20 MB</p></div></div>
        <label className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center hover:border-[var(--primary)]">
          <Upload size={30} className="text-[var(--primary)]"/><span className="mt-3 font-bold">Datei hier ablegen oder auswählen</span><span className="mt-1 text-sm muted">Nur CSV-Dateien werden akzeptiert</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/>
        </label>
        {file && <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-4"><div className="flex items-center gap-3"><FileSpreadsheet className="text-[var(--primary)]"/><div><div className="font-semibold">{file.name}</div><div className="text-xs muted">{(file.size/1024).toFixed(1)} KB</div></div></div><CheckCircle2 className="text-[var(--accent)]"/></div>}
        <button className="btn-primary mt-5 w-full" disabled={!file}>Datei lokal prüfen</button>
      </article>
      <div className="space-y-4">
        <article className="card p-5"><ShieldCheck className="text-[var(--primary)]"/><h2 className="mt-3 font-bold">Privat verarbeitet</h2><p className="mt-2 text-sm leading-6 muted">Import, Normalisierung und Dublettenprüfung laufen vollständig auf deinem Finanzplaner. Erst eine gesonderte KI-Freigabe überträgt ausgewählte Daten.</p></article>
        <article className="card p-5"><AlertTriangle className="text-[var(--warning)]"/><h2 className="mt-3 font-bold">Dubletten sicher behandeln</h2><p className="mt-2 text-sm leading-6 muted">Sichere Dubletten werden übersprungen. Ähnliche Buchungen entscheidest du in einer Gegenüberstellung selbst.</p></article>
      </div>
    </section>
    <section className="card p-5"><h2 className="font-bold">Letzte Importe</h2><div className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm muted">Noch keine Importe in dieser Installation.</div></section>
  </div>;
}
