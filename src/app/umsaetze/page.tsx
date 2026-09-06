"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, Filter, Pencil, RefreshCw, Search, SlidersHorizontal, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AiCategorizationPanel } from "@/components/ai-categorization-panel";
import { CategorySelectOptions } from "@/components/category-select-options";
import { TransactionEditor } from "@/components/transaction-editor";
import { InlineCategoryCreate } from "@/components/inline-category-create";
type Row = {
  id: string;
  accountId:string;
  bookedOn: string;
  amount: string;
  currency: string;
  counterparty: string | null;
  purpose: string | null;
  categoryId: string | null;
  categoryName: string | null;
  accountName: string;
  note: string | null;
  tags: string[];
  excluded: boolean;
  specialType: "normal" | "refund" | "transfer";
  linkedTransactionId: string | null;
  categorizationConfidence: string | null;
  categorizedBy: string | null;
  aiReviewDeferredAt: string | null;
  splits: Array<{ categoryId: string; amount: string; note?: string | null }>;
};
type Category = { id: string; name: string; parentId: string | null; isIncome: boolean };
function isUnassigned(row: Row) {
  return !row.categoryId && row.splits.length === 0;
}
function confidenceBand(row:Row){
  if(row.aiReviewDeferredAt)return "deferred";
  if(!row.categoryId)return "unassigned";
  if(row.categorizedBy==="manual")return "manual";
  const confidence=Number(row.categorizationConfidence??0);
  if(confidence>=.9)return "very-safe";
  if(confidence>=.7)return "likely";
  return "check";
}
export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState(()=>typeof window==="undefined"?"all":new URLSearchParams(window.location.search).get("accountId")??"all");
  const [categoryFilter, setCategoryFilter] = useState(()=>typeof window==="undefined"?"all":new URLSearchParams(window.location.search).get("categoryId")??"all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confidenceFilter,setConfidenceFilter]=useState(()=>typeof window==="undefined"?"all":new URLSearchParams(window.location.search).get("confidence")??"all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const [importSummary, setImportSummary] = useState<{accountId?:string;imported:number;locallyCategorized:number;duplicates?:number;skippedSuspected?:number;ignoredPending?:number;ignoredZero?:number}|null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [pendingCategory, setPendingCategory] = useState<{row:Row;categoryId:string}|null>(null);
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<Row | null>(null);
  async function refreshTransactions() {
    const tx = await fetch("/api/transactions").then((r) => r.json());
    if (Array.isArray(tx)) setRows(tx);
    else setError(tx.error);
  }
  useEffect(() => {
    const stored = sessionStorage.getItem("finanzplaner-last-import");
    if (stored) {
      try { setImportSummary(JSON.parse(stored)); } finally { sessionStorage.removeItem("finanzplaner-last-import"); }
    }
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([tx, cats]) => {
      if (Array.isArray(tx)) setRows(tx);
      else setError(tx.error);
      if (Array.isArray(cats)) setCategories(cats);
    });
  }, []);
  const accountOptions = useMemo(() => [...new Map(rows.map((row) => [row.accountId, row.accountName])).entries()].map(([id, name]) => ({ id, name })).sort((a,b)=>a.name.localeCompare(b.name,"de")), [rows]);
  const accountRows = useMemo(() => rows.filter((row) => accountFilter === "all" || row.accountId === accountFilter), [rows, accountFilter]);
  const unassignedCount = useMemo(
    () => accountRows.filter(isUnassigned).length,
    [accountRows],
  );
  const sampleIds=useMemo(()=>{const safe=accountRows.filter(row=>confidenceBand(row)==="very-safe");const sampled=safe.filter(row=>{let hash=0;for(const char of row.id)hash=(hash*31+char.charCodeAt(0))|0;return Math.abs(hash)%20===0}).slice(0,10);if(!sampled.length&&safe.length)sampled.push(safe[0]);return new Set(sampled.map(row=>row.id))},[accountRows]);
  const visible = useMemo(() => {
    const q = query.toLocaleLowerCase("de-DE");
    return accountRows.filter(
      (r) =>
        (!q ||
          `${r.counterparty} ${r.purpose} ${r.categoryName} ${r.note} ${r.tags.join(" ")}`
            .toLocaleLowerCase("de-DE")
            .includes(q)) &&
        (categoryFilter === "all" ||
          (categoryFilter === "none"
            ? isUnassigned(r)
            : r.categoryId === categoryFilter)) &&
        (typeFilter === "all" || r.specialType === typeFilter) &&
        (confidenceFilter === "all" || (confidenceFilter === "review" ? ["likely","check"].includes(confidenceBand(r)) : confidenceFilter==="sample"?sampleIds.has(r.id):confidenceBand(r) === confidenceFilter)),
    );
  }, [accountRows, query, categoryFilter, typeFilter,confidenceFilter,sampleIds]);
  async function patch(body: Record<string, unknown>) {
    const response = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return false;
    }
    await refreshTransactions();
    return true;
  }
  async function setCategory(row: Row, categoryId: string) {
    if (categoryId === "__create__") { setCreatingCategoryFor(row); return; }
    if (!categoryId) { await patch({ id: row.id, categoryId: null, ruleMode: "none" }); return; }
    setPendingCategory({row,categoryId});
  }
  async function confirmCategory(ruleMode:"none"|"future"|"all") { if(!pendingCategory)return;await patch({id:pendingCategory.row.id,categoryId:pendingCategory.categoryId,ruleMode});setPendingCategory(null); }
  async function confirmSuggestion(row:Row){if(row.categoryId)await patch({id:row.id,categoryId:row.categoryId,ruleMode:"none"});}
  async function applyLocalRules() {
    setLocalBusy(true);
    setLocalMessage("");
    setError("");
    try {
      const response = await fetch("/api/categorization/local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(accountFilter === "all" ? {} : { accountId: accountFilter }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Automatische Erkennung konnte nicht ausgeführt werden.");
      if (result.applied > 0) {
        setLocalMessage(`${result.applied} vorhandene Umsätze wurden anhand deiner bisherigen Zuordnungen und eindeutiger Buchungstexte automatisch kategorisiert.${result.learned ? ` Dabei wurden ${result.learned} ältere Händler-Zuordnungen nachträglich gelernt.` : ""}${result.keywordApplied ? ` ${result.keywordApplied} Zuordnungen wurden direkt aus dem Buchungstext erkannt.` : ""}`);
      } else if (result.learned > 0) {
        setLocalMessage(`${result.learned} ältere Händler-Zuordnungen wurden nachträglich gelernt. Weitere passende offene Umsätze waren nicht vorhanden.`);
      } else if (result.rules === 0) {
        setLocalMessage("Noch keine gelernten Zuordnungen vorhanden. Ordne zuerst einen eindeutigen Händler manuell einer Kategorie zu.");
      } else {
        setLocalMessage("Alle Umsätze, die zu deinen bisherigen Zuordnungen passen, sind bereits kategorisiert.");
      }
      await refreshTransactions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automatische Erkennung konnte nicht ausgeführt werden.");
    } finally {
      setLocalBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Buchungen"
        title="Umsätze"
        description="Durchsuche, prüfe und kategorisiere deine Buchungen."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={applyLocalRules} disabled={localBusy}>
              <RefreshCw size={18} className={localBusy ? "animate-spin" : ""} />
              {localBusy ? "Erkennung läuft …" : "Gelernte Regeln anwenden"}
            </button>
            <Link href="/einstellungen/kategorien" className="btn-secondary">
              <SlidersHorizontal size={18} /> Kategorien verwalten
            </Link>
            <Link href="/einstellungen/regeln" className="btn-secondary">
              <WandSparkles size={18} /> Regeln verwalten
            </Link>
          </div>
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {importSummary && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <strong className="text-base">Import abgeschlossen und geprüft</strong>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div>✓ <strong>{importSummary.imported}</strong> neu importiert</div><div>✓ <strong>{importSummary.duplicates??0}</strong> sichere Dubletten übersprungen{(importSummary.skippedSuspected??0)>0&&<span className="block text-xs">+ {importSummary.skippedSuspected} mögliche Dubletten nicht übernommen</span>}</div><div>✓ <strong>{(importSummary.ignoredPending??0)+(importSummary.ignoredZero??0)}</strong> Vormerkungen/Nullbuchungen ignoriert</div><div>→ <strong>{rows.filter(row=>(!importSummary.accountId||row.accountId===importSummary.accountId)&&["unassigned","likely","check"].includes(confidenceBand(row))).length}</strong> noch zu klären</div></div>
          <p className="mt-3">{importSummary.locallyCategorized} Zuordnungen wurden automatisch erkannt. Prüfe jetzt offene und wahrscheinliche Fälle; anschließend ist die Analyse bereit.</p>
        </div>
      )}
      {localMessage && (
        <div role="status" className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          {localMessage}
        </div>
      )}
      <AiCategorizationPanel onApplied={refreshTransactions} accountId={accountFilter === "all" ? undefined : accountFilter} />
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">
            <Search size={18} className="muted" />
            <span className="sr-only">Umsätze suchen</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-0 bg-transparent outline-none"
              placeholder="Empfänger, Verwendungszweck, Notiz oder Schlagwort"
            />
          </label>
          <button
            type="button"
            onClick={() => setCategoryFilter((current) => current === "none" ? "all" : "none")}
            className={categoryFilter === "none" ? "btn-secondary border-red-200 bg-red-50 text-red-800" : "btn-secondary"}
            aria-pressed={categoryFilter === "none"}
          >
            <CircleAlert size={17} /> {unassignedCount} nicht zugeordnet
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className="btn-secondary"
            aria-expanded={filtersOpen}
          >
            <Filter size={17} /> Filter
            {accountFilter !== "all" || categoryFilter !== "all" || typeFilter !== "all" || confidenceFilter!=="all" ? " · aktiv" : ""}
          </button>
        </div>
        {filtersOpen && (
          <div className="grid gap-3 border-b border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold">
              Konto
              <select value={accountFilter} onChange={(event)=>setAccountFilter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                <option value="all">Alle sichtbaren Konten</option>
                {accountOptions.map((account)=><option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Kategorie
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                <option value="all">Alle Kategorien</option>
                <option value="none">Nicht zugeordnet</option>
                <CategorySelectOptions categories={categories} />
              </select>
            </label>
            <label className="text-sm font-semibold">
              Buchungsart
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                <option value="all">Alle Buchungsarten</option>
                <option value="normal">Normale Buchungen</option>
                <option value="refund">Erstattungen</option>
                <option value="transfer">Umbuchungen</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Sicherheit
              <select value={confidenceFilter} onChange={(event)=>setConfidenceFilter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                <option value="all">Alle Sicherheitsstufen</option>
                <option value="review">Noch prüfen (wahrscheinlich + unsicher)</option>
                <option value="deferred">Für später zurückgestellt</option>
                <option value="likely">Wahrscheinlich</option>
                <option value="check">Bitte prüfen</option>
                <option value="very-safe">Sehr sicher</option>
                <option value="sample">Stichprobe aus „Sehr sicher“ ({sampleIds.size})</option>
                <option value="manual">Manuell bestätigt</option>
              </select>
            </label>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead className="bg-[var(--surface-soft)] text-left muted">
              <tr>
                {["Datum", "Empfänger", "Konto", "Kategorie", "Betrag", ""].map(
                  (heading, index) => (
                    <th
                      key={`${heading}-${index}`}
                      className="px-5 py-3 font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--border)] ${isUnassigned(row) ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-[var(--surface-soft)]"} ${row.excluded ? "opacity-60" : ""}`}
                >
                  <td className="px-5 py-4">
                    {new Intl.DateTimeFormat("de-DE").format(
                      new Date(`${row.bookedOn}T00:00:00`),
                    )}
                  </td>
                  <td className="max-w-[260px] px-5 py-4">
                    <div className="truncate font-semibold" title={row.counterparty ?? undefined}>
                      {row.counterparty ?? "Unbekannt"}
                    </div>
                    <div
                      className="mt-1 line-clamp-2 break-words text-xs leading-5 muted"
                      title={row.purpose ?? undefined}
                    >
                      {row.purpose}
                    </div>
                    {row.tags.length > 0 && (
                      <div className="mt-1 text-xs text-[var(--primary)]">
                        {row.tags.map((tag) => `#${tag}`).join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 muted">{row.accountName}</td>
                  <td className="px-5 py-4">
                    {row.splits.length > 0 ? (
                      <span className="inline-flex min-h-9 items-center rounded-lg bg-[var(--surface-soft)] px-3 text-xs font-semibold">
                        Aufgeteilt ({row.splits.length})
                      </span>
                    ) : (
                      <select
                        value={row.categoryId ?? ""}
                        onChange={(e) => setCategory(row, e.target.value)}
                        className={`min-h-9 rounded-lg border px-2 ${isUnassigned(row) ? "border-red-200 bg-red-50 font-semibold text-red-800" : "border-[var(--border)] bg-[var(--surface)]"}`}
                      >
                        <option value="">Nicht zugeordnet</option>
                        <CategorySelectOptions categories={categories} />
                        <option value="__create__">＋ Neue Kategorie anlegen …</option>
                      </select>
                    )}
                    {row.categoryId&&<div className="mt-1 flex items-center gap-2"><span className={`text-xs font-semibold ${Number(row.categorizationConfidence??1)>=.9?"text-emerald-700":Number(row.categorizationConfidence??0)>=.7?"text-amber-700":"text-red-700"}`}>{row.categorizedBy==="manual"?"Manuell bestätigt":Number(row.categorizationConfidence??0)>=.9?"Sehr sicher":Number(row.categorizationConfidence??0)>=.7?"Wahrscheinlich":"Bitte prüfen"}</span>{row.categorizedBy!=="manual"&&<button type="button" onClick={()=>confirmSuggestion(row)} className="text-xs font-semibold text-[var(--primary)] underline decoration-dotted underline-offset-2">Bestätigen</button>}</div>}
                    {row.aiReviewDeferredAt&&<div className="mt-1 flex items-center gap-2"><span className="text-xs font-semibold text-amber-700">Später prüfen</span><button type="button" onClick={()=>patch({id:row.id,deferAiReview:false})} className="text-xs font-semibold text-[var(--primary)] underline decoration-dotted underline-offset-2">Wieder für KI freigeben</button></div>}
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-bold ${Number(row.amount) > 0 ? "text-[var(--primary)]" : ""}`}
                  >
                    {Number(row.amount).toLocaleString("de-DE", {
                      style: "currency",
                      currency: row.currency,
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSelected(row)}
                      className="btn-secondary min-h-9 px-3"
                      aria-label={`Details von ${row.counterparty ?? "Umsatz"} bearbeiten`}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center muted">
                    Keine passenden Umsätze vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <TransactionEditor
          row={selected}
          rows={rows}
          categories={categories}
          onClose={() => setSelected(null)}
          onSave={patch}
        />
      )}{" "}
      {pendingCategory&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rule-choice-title"><section className="card w-full max-w-lg p-6"><h2 id="rule-choice-title" className="text-xl font-bold">Zuordnung speichern</h2><p className="mt-2 text-sm leading-6 muted">Wie soll die Zuordnung für „{pendingCategory.row.counterparty??"diesen Umsatz"}“ verwendet werden? Neue Regeln gelten zunächst nur für {pendingCategory.row.accountName}.</p><div className="mt-5 grid gap-3"><button onClick={()=>confirmCategory("none")} className="btn-secondary justify-start">Nur diesen Umsatz ändern</button><button onClick={()=>confirmCategory("future")} className="btn-secondary justify-start">Diesen Umsatz ändern und Kontoregel speichern</button><button onClick={()=>confirmCategory("all")} className="btn-primary justify-start">Alle passenden Umsätze dieses Kontos ändern</button></div><button onClick={()=>setPendingCategory(null)} className="btn-secondary mt-4 w-full">Abbrechen</button></section></div>}
      {creatingCategoryFor&&<InlineCategoryCreate categories={categories} defaultIsIncome={Number(creatingCategoryFor.amount)>0} onClose={()=>setCreatingCategoryFor(null)} onCreated={async(category)=>{setCategories(current=>[...current,category]);setCreatingCategoryFor(null);setPendingCategory({row:creatingCategoryFor,categoryId:category.id});}}/>}
    </div>
  );
}
