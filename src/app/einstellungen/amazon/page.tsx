"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PackageSearch, ShieldCheck, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AmazonReconciliation } from "@/components/amazon-reconciliation";

type Preview = {
  items: number;
  orders: number;
  multipleItemOrders: number;
  newItems: number;
  duplicates: number;
  warnings: string[];
};
type History = { id: string; filename: string; itemCount: number; orderCount: number; createdAt: string };

export default function AmazonImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function loadHistory() {
    const body = await fetch("/api/amazon/import").then((response) => response.json());
    if (Array.isArray(body)) setHistory(body);
  }
  useEffect(() => { fetch("/api/amazon/import").then((response) => response.json()).then((body) => { if (Array.isArray(body)) setHistory(body); }); }, []);
  async function upload(mode: "preview" | "commit") {
    if (!file) return;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    form.set("mode", mode);
    const response = await fetch("/api/amazon/import", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(body.error); return; }
    if (mode === "preview") { setPreview(body); return; }
    setMessage(`${body.importedItems} Artikel aus ${body.importedOrders} Bestellungen wurden sicher importiert.`);
    setPreview(null);
    setFile(null);
    await loadHistory();
  }
  return <div className="space-y-7">
    <PageHeader eyebrow="Einstellungen · Daten" title="Amazon-Bestellungen" description="Importiere „Order History.csv“ aus dem Amazon-Datenexport, um Sammelbestellungen aufzuteilen." />
    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <article className="card p-5 sm:p-7">
        <div className="flex items-center gap-3"><PackageSearch className="text-[var(--primary)]"/><div><h2 className="font-bold">Order History.csv auswählen</h2><p className="mt-1 text-sm muted">Aus „Your Orders/Your Amazon Orders“ · maximal 30 MB</p></div></div>
        <label className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center hover:border-[var(--primary)]"><Upload size={30} className="text-[var(--primary)]"/><span className="mt-3 font-bold">Amazon-CSV auswählen</span><span className="mt-1 text-sm muted">Die ZIP-Datei bitte vorher entpacken</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event)=>{setFile(event.target.files?.[0]??null);setPreview(null);setMessage("")}}/></label>
        {file&&<div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--surface-soft)] p-4"><CheckCircle2 className="text-[var(--primary)]"/><div><div className="font-semibold">{file.name}</div><div className="text-xs muted">{(file.size/1024/1024).toFixed(2)} MB</div></div></div>}
        <button disabled={!file||busy} onClick={()=>upload("preview")} className="btn-primary mt-5 w-full">{busy?"Datei wird geprüft …":"Datei lokal prüfen"}</button>
      </article>
      <article className="card p-5"><ShieldCheck className="text-[var(--primary)]"/><h2 className="mt-3 font-bold">Datensparsam</h2><p className="mt-2 text-sm leading-6 muted">Gespeichert werden nur die für Zuordnung und Aufteilung notwendigen Bestelldaten. Bestellnummer und Artikelname werden verschlüsselt. Adressen, Zahlungsdetails, Tracking, Geschenknachrichten und Seriennummern werden verworfen.</p></article>
    </section>
    {message&&<div role="status" className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{message}</div>}
    {preview&&<section className="card p-5"><h2 className="font-bold">Importvorschau</h2><div className="mt-4 grid gap-3 sm:grid-cols-5">{[["Artikel",preview.items],["Bestellungen",preview.orders],["Mehrere Artikel",preview.multipleItemOrders],["Neu",preview.newItems],["Dubletten",preview.duplicates]].map(([label,value])=><div key={label} className="rounded-xl bg-[var(--surface-soft)] p-4"><div className="text-xs font-semibold muted">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>)}</div>{preview.warnings.length>0&&<div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{preview.warnings.length} Zeilen benötigen Prüfung. Erste Meldung: {preview.warnings[0]}</div>}<button disabled={busy||preview.newItems===0} onClick={()=>upload("commit")} className="btn-primary mt-5">{preview.newItems} neue Artikel importieren</button></section>}
    <section className="card overflow-hidden"><div className="border-b border-[var(--border)] p-5"><h2 className="font-bold">Bisherige Amazon-Importe</h2></div>{history.length?history.map(item=><div key={item.id} className="flex flex-col justify-between gap-2 border-b border-[var(--border)] p-5 last:border-0 sm:flex-row"><div><div className="font-semibold">{item.filename}</div><div className="mt-1 text-sm muted">{new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.createdAt))}</div></div><div className="text-sm font-semibold">{item.orderCount} Bestellungen · {item.itemCount} Artikel</div></div>):<div className="p-5 text-sm muted">Noch keine Amazon-Datei importiert.</div>}</section>
    <AmazonReconciliation />
  </div>;
}
