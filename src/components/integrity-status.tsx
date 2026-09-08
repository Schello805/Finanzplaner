"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

type Result = {
  ok: boolean;
  checkedTransactions: number;
  checkedSplits: number;
  checkedAmazonItems: number;
  errorCount: number;
  warningCount: number;
  issues: Array<{ code: string; severity: "error" | "warning"; entityId: string; message: string }>;
};

export function IntegrityStatus() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true);
    const response = await fetch("/api/admin/integrity", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) { setResult(body); setError(""); }
    else setError(body.error ?? "Integritätsprüfung fehlgeschlagen.");
    setBusy(false);
  }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  return <article className={`card p-5 ${result&&!result.ok?"border-red-400":""}`}>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex gap-3">
        {result?.ok?<CheckCircle2 className="shrink-0 text-emerald-600"/>:<AlertTriangle className="shrink-0 text-amber-600"/>}
        <div><h2 className="font-bold">Finanzielle Datenintegrität</h2><p className="mt-1 text-sm muted">Centgenaue Aufteilungen, Amazon-Verknüpfungen, Buchungsrichtungen und interne Umbuchungen.</p></div>
      </div>
      <button type="button" onClick={load} disabled={busy} className="btn-secondary"><RefreshCw size={16} className={busy?"animate-spin":""}/>{busy?"Prüft …":"Erneut prüfen"}</button>
    </div>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result&&<><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Umsätze",result.checkedTransactions],["Aufteilungen",result.checkedSplits],["Amazon-Positionen",result.checkedAmazonItems]].map(([label,value])=><div key={label} className="rounded-xl bg-[var(--surface-soft)] p-3"><span className="text-xs muted">{label}</span><strong className="block text-lg">{value}</strong></div>)}</div>{result.ok?<p className="mt-4 font-semibold text-emerald-700">Alle geprüften Zusammenhänge sind konsistent.</p>:<div className="mt-4"><p className="font-semibold text-red-700">{result.errorCount} Fehler · {result.warningCount} Warnungen</p><div className="mt-3 space-y-2">{result.issues.slice(0,20).map(issue=><div key={`${issue.code}-${issue.entityId}`} className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>{issue.code}</strong> · {issue.message} <span className="opacity-70">({issue.entityId.slice(0,8)})</span></div>)}</div>{result.issues.length>20&&<p className="mt-2 text-xs muted">Weitere {result.issues.length-20} Abweichungen stehen im Systemprotokoll.</p>}</div>}</>}
  </article>;
}
