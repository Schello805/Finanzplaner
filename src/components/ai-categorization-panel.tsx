"use client";
/* Der Initiallauf liest die beim Einhängen gültige Einwilligung genau einmal. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { CategorySelectOptions, type SelectCategory } from "@/components/category-select-options";
import { InlineCategoryCreate } from "@/components/inline-category-create";
import { LIKELY_CONFIDENCE, VERY_SAFE_CONFIDENCE } from "@/features/categorization/confidence";
type Mode = "minimal" | "full_text";
type Preview = {
  count: number;
  deferredCount: number;
  batchSize: number;
  totalRounds: number;
  remainingAfterBatch:number;
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
  cost: { approximateInputTokens: number; lowEur: number; highEur: number } | null;
};
type Suggestion = {
  id: string;
  category: string;
  categoryId: string;
  confidence: number;
  reason: string;
  matchingKeyword?: string | null;
};
type CategoryProposal = {
  name: string;
  isIncome: boolean;
  transactionIds: string[];
  matchingKeywords: Record<string,string>;
  confidence: number;
  reason: string;
};
export function AiCategorizationPanel({
  onApplied,
  accountId,
}: {
  onApplied: () => void;
  accountId?: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categoryProposals, setCategoryProposals] = useState<CategoryProposal[]>([]);
  const [categories, setCategories] = useState<SelectCategory[]>([]);
  const [creatingCategoryForSuggestion,setCreatingCategoryForSuggestion]=useState<Suggestion|null>(null);
  const [mode, setMode] = useState<Mode>("minimal");
  const [analyzedTransactions, setAnalyzedTransactions] = useState<Preview["transactions"]>([]);
  const [processedIds,setProcessedIds]=useState<string[]>([]);
  const [initialTotal,setInitialTotal]=useState(0);
  const [undoIds,setUndoIds]=useState<string[]>([]);
  async function requestPreview(nextMode: Mode, preserveMessage = false, excludedIds:string[]=processedIds) {
    const params = new URLSearchParams({ privacyMode: nextMode });
    if (accountId) params.set("accountId", accountId);
    if(excludedIds.length)params.set("exclude",excludedIds.join(","));
    const response = await fetch(`/api/ai/categorize?${params}`);
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
    alreadyProcessed:string[]=processedIds,
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
        `${automatic ? "Automatische Analyse abgeschlossen: " : ""}${body.applied} sichere Zuordnungen übernommen. ${body.suggestions.length} Zuordnungen und ${body.categoryProposals.length} neue Kategorien müssen geprüft werden. ${body.pricingAvailable ? `Geschätzte Kosten: ${Number(body.estimatedCostEur) > 0 && Number(body.estimatedCostEur) < 0.0001 ? "< 0,0001 €" : `${Number(body.estimatedCostEur).toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} €`}.` : "Preisangaben fehlen im Adminbereich."}`,
      );
      setSuggestions(existing=>[...existing,...body.suggestions]);
      setCategoryProposals(existing=>[...existing,...body.categoryProposals]);
      setAnalyzedTransactions(existing=>[...existing,...current.transactions]);
      const nextProcessed=[...new Set([...alreadyProcessed,...current.transactions.map(item=>item.id)])];
      setProcessedIds(nextProcessed);
      const next=await requestPreview(currentMode, true,nextProcessed);
      onApplied();
      if(automatic&&next?.transactions.length)await analyze(next,currentMode,true,nextProcessed);
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
      body: JSON.stringify({ id: suggestion.id, categoryId: suggestion.categoryId, ruleMode: "future", matchingKeyword: suggestion.matchingKeyword }),
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
          body: JSON.stringify({ id, categoryId: category.id, ruleMode: "future", matchingKeyword: proposal.matchingKeywords[id] }),
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
  async function deferTransactions(ids: string[]) {
    setBusy(true);
    setMessage("");
    try {
      for (const id of ids) {
        const response = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, deferAiReview: true }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
      }
      setSuggestions((current) => current.filter((item) => !ids.includes(item.id)));
      setCategoryProposals((current) => current.filter((item) => !item.transactionIds.some((id) => ids.includes(id))));
      setMessage(`${ids.length} ${ids.length === 1 ? "Umsatz wurde" : "Umsätze wurden"} für die spätere Prüfung zurückgestellt.`);
      await requestPreview(mode, true);
      onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Umsatz konnte nicht zurückgestellt werden.");
    } finally {
      setBusy(false);
    }
  }
  async function acceptMany(ids: string[]) {
    setBusy(true);
    setMessage("");
    const acceptedIds:string[]=[];
    try {
      const selectedSuggestions=suggestions.filter(suggestion=>ids.includes(suggestion.id));
      for (const suggestion of selectedSuggestions) {
        const response = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: suggestion.id, categoryId: suggestion.categoryId, ruleMode: "none" }),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        acceptedIds.push(suggestion.id);
      }
      const count = selectedSuggestions.length;
      setSuggestions(current=>current.filter(suggestion=>!ids.includes(suggestion.id)));
      setUndoIds(acceptedIds);
      setMessage(`${count} ${count===1?"KI-Zuordnung wurde":"KI-Zuordnungen wurden"} bestätigt. Sammelbestätigungen erzeugen aus Sicherheitsgründen keine Lernregeln. ${categoryProposals.length ? `${categoryProposals.length} Vorschläge für neue Kategorien warten weiterhin auf deine ausdrückliche Einzelentscheidung.` : ""}`);
      await requestPreview(mode, true);
      onApplied();
    } catch (error) {
      setUndoIds(acceptedIds);
      setSuggestions(current=>current.filter(suggestion=>!acceptedIds.includes(suggestion.id)));
      setMessage(`${error instanceof Error ? error.message : "Die Vorschläge konnten nicht vollständig übernommen werden."}${acceptedIds.length?` ${acceptedIds.length} bereits gespeicherte Zuordnungen können rückgängig gemacht werden.`:""}`);
    } finally {
      setBusy(false);
    }
  }
  async function undoMany(){
    if(!undoIds.length)return;
    setBusy(true);
    try{
      for(const id of undoIds){
        const response=await fetch("/api/transactions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,categoryId:null,ruleMode:"none"})});
        if(!response.ok)throw new Error((await response.json()).error);
      }
      const count=undoIds.length;setUndoIds([]);setMessage(`${count} ${count===1?"Sammelzuordnung wurde":"Sammelzuordnungen wurden"} rückgängig gemacht.`);setProcessedIds([]);await requestPreview(mode,true,[]);onApplied();
    }catch(error){setMessage(error instanceof Error?error.message:"Sammelzuordnung konnte nicht rückgängig gemacht werden.");}finally{setBusy(false);}
  }
  useEffect(() => {
    Promise.all([
      fetch("/api/user/preferences").then((r) => r.json()),
      fetch(`/api/ai/categorize?privacyMode=minimal${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(async ([preferences, initial, categoryRows]) => {
      if (Array.isArray(categoryRows)) setCategories(categoryRows);
      const selectedMode: Mode =
        preferences.aiPrivacyMode === "full_text" ? "full_text" : "minimal";
      setMode(selectedMode);
      const current =
        selectedMode === "minimal"
          ? initial.available === false
            ? null
            : initial
          : await requestPreview(selectedMode);
      if (selectedMode === "minimal" && initial.available !== false) setPreview(initial);
      if(initial?.count)setInitialTotal(initial.count);
      if (selectedMode === "minimal" && initial.available === false) setPreview(null);
      if (selectedMode === "minimal" && initial.error) setMessage(initial.error);
      if (preferences.automaticCategorization && current?.count) {
        const key = `finanzplaner-auto-ai:${current.transactions.map((item: { id: string }) => item.id).join(",")}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "started");
          await analyze(current, selectedMode, true,[]);
        }
      }
    });
  }, [accountId]);
  async function changeMode(next: Mode) {
    setMode(next);
    await requestPreview(next);
  }
  if (!preview && !message) return null;
  return (
    <section className="card border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] p-5">
      {busy&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5" role="status" aria-live="polite"><div className="card w-full max-w-md p-7 text-center shadow-2xl"><Sparkles className="mx-auto animate-pulse text-[var(--primary)]" size={38}/><h2 className="mt-4 text-xl font-bold">KI-Analyse läuft</h2><p className="mt-2 text-sm muted">Die Umsätze werden geprüft und passenden Kategorien zugeordnet. Bitte lasse diese Seite geöffnet.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--primary)]"/></div><p className="mt-3 text-xs muted">Runde {Math.floor(processedIds.length/25)+1} von {Math.max(1,Math.ceil((initialTotal||preview?.count||1)/25))}</p></div></div>}
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
                  {preview.model} · Runde {Math.floor(processedIds.length/25)+1} von {Math.max(1,Math.ceil((initialTotal||preview.count)/25))} · nächster Stapel: {preview.batchSize}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => analyze(preview, mode)}
                className="btn-primary"
              >
                <Sparkles size={16} />
                {busy
                  ? "KI analysiert …"
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
              {preview.cost ? <p className="mt-4 text-sm">
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
              </p> : <p className="mt-4 text-sm text-amber-800">Für dieses Modell fehlen Preisangaben im Adminbereich.</p>}
            </div>
          )}
          <div className="mt-4"><div className="mb-1 flex justify-between text-xs font-semibold"><span>{Math.min(processedIds.length,initialTotal||preview.count)} von {initialTotal||preview.count} in dieser Analyse bearbeitet</span><span>{Math.round(Math.min(1,processedIds.length/Math.max(1,initialTotal||preview.count))*100)} %</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full bg-[var(--primary)] transition-all" style={{width:`${Math.min(100,processedIds.length/Math.max(1,initialTotal||preview.count)*100)}%`}}/></div></div>
        </>
      ) : suggestions.length||categoryProposals.length ? (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-bold">Alle KI-Runden sind abgeschlossen</h2><p className="mt-1 text-sm muted">{suggestions.length+categoryProposals.reduce((sum,item)=>sum+item.transactionIds.length,0)} Vorschläge warten unten auf deine Entscheidung.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">Prüfung offen</span></div>
      ) : preview?.deferredCount ? (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="font-bold">{preview.deferredCount} {preview.deferredCount === 1 ? "Umsatz wartet" : "Umsätze warten"} auf deine spätere Prüfung</h2><p className="mt-1 text-sm muted">Zurückgestellte Umsätze werden nicht erneut an die KI gesendet.</p></div>
          <a href="/umsaetze?confidence=deferred" className="btn-secondary shrink-0">Zur Prüfliste</a>
        </div>
      ) : preview ? (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="font-bold">Alle Umsätze sind zugeordnet</h2><p className="mt-1 text-sm muted">Die Kategorieprüfung ist abgeschlossen. Als Nächstes kannst du die Monatsanalyse ansehen.</p></div>
          <Link href="/" className="btn-primary shrink-0">Zur Analyse</Link>
        </div>
      ) : null}
      {message && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm"
        >
          {message}
          {undoIds.length>0&&<span className="mt-3 block"><button type="button" disabled={busy} onClick={undoMany} className="font-semibold text-[var(--primary)] underline">Letzte Sammelzuordnung rückgängig machen ({undoIds.length})</button></span>}
          {message.includes("zurückgestellt") && <span className="mt-3 block"><a href="/umsaetze?confidence=deferred" className="font-semibold text-[var(--primary)]">Zur Liste „Später prüfen“</a></span>}
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
      {suggestions.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="mb-3 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">{suggestions.filter(item=>item.confidence>=VERY_SAFE_CONFIDENCE).length} sehr sicher</span><span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">{suggestions.filter(item=>item.confidence>=LIKELY_CONFIDENCE&&item.confidence<VERY_SAFE_CONFIDENCE).length} wahrscheinlich</span><span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-900">{suggestions.filter(item=>item.confidence<LIKELY_CONFIDENCE).length} bitte prüfen</span></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy||!suggestions.some(item=>item.confidence>=VERY_SAFE_CONFIDENCE)} onClick={()=>acceptMany(suggestions.filter(item=>item.confidence>=VERY_SAFE_CONFIDENCE).map(item=>item.id))} className="btn-secondary"><ShieldCheck size={17}/>Nur sehr sichere übernehmen ({suggestions.filter(item=>item.confidence>=VERY_SAFE_CONFIDENCE).length})</button>
            <button type="button" disabled={busy} onClick={()=>acceptMany(suggestions.map(item=>item.id))} className="btn-primary">Alle Vorschläge übernehmen ({suggestions.length})</button>
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div>
            <h3 className="font-bold">KI-Vorschläge prüfen</h3>
            <p className="mt-1 text-sm muted">
              Prüfe den Vorschlag, ändere ihn bei Bedarf und bestätige anschließend einzeln oder gesammelt.
            </p>
          </div>
          {suggestions.map((suggestion) => {
            const transaction = analyzedTransactions.find(
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2.5 py-1 font-semibold ${suggestion.confidence>=VERY_SAFE_CONFIDENCE?"bg-emerald-100 text-emerald-900":suggestion.confidence>=LIKELY_CONFIDENCE?"bg-amber-100 text-amber-900":"bg-red-100 text-red-900"}`}>{suggestion.confidence>=VERY_SAFE_CONFIDENCE?"Sehr sicher":suggestion.confidence>=LIKELY_CONFIDENCE?"Wahrscheinlich":"Bitte prüfen"}</span><span className="muted">{(suggestion.confidence * 100).toFixed(0)} % Sicherheit</span></div>
                  <select
                    aria-label={`Kategorie für ${transaction?.merchant ?? "Umsatz"}`}
                    value={suggestion.categoryId}
                    onChange={(event) => {
                      if(event.target.value==="__create__"){
                        setCreatingCategoryForSuggestion(suggestion);
                        return;
                      }
                      setSuggestions((current) => current.map((item) => item.id === suggestion.id ? { ...item, categoryId: event.target.value, category: categories.find((category) => category.id === event.target.value)?.name ?? item.category } : item));
                    }}
                    className="mt-2 min-h-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
                  >
                    <CategorySelectOptions categories={categories} />
                    <option value="__create__">＋ Neue Kategorie direkt anlegen …</option>
                  </select>
                  {transaction && <div className="mt-2 text-xs muted">{transaction.date} · {transaction.amount.toLocaleString("de-DE", { style: "currency", currency: transaction.currency })} · {transaction.purpose}</div>}
                  <div className="mt-1 text-xs muted">{suggestion.reason}</div>
                  {suggestion.matchingKeyword&&<div className="mt-1 text-xs font-semibold text-[var(--primary)]">Wird gelernt: Händler + „{suggestion.matchingKeyword}“ im Buchungstext</div>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => deferTransactions([suggestion.id])} className="btn-secondary"><Clock3 size={16}/> Später prüfen</button>
                  <button type="button" disabled={busy} onClick={() => acceptSuggestion(suggestion)} className="btn-secondary">Übernehmen</button>
                </div>
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
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => deferTransactions(proposal.transactionIds)} className="btn-secondary"><Clock3 size={16}/> Später prüfen</button>
                <button type="button" disabled={busy} onClick={() => createCategory(proposal)} className="btn-secondary">Kategorie anlegen & zuordnen</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {creatingCategoryForSuggestion&&<InlineCategoryCreate
        categories={categories}
        defaultIsIncome={(analyzedTransactions.find(item=>item.id===creatingCategoryForSuggestion.id)?.amount??-1)>0}
        onClose={()=>setCreatingCategoryForSuggestion(null)}
        onCreated={category=>{
          setCategories(current=>[...current,category]);
          setSuggestions(current=>current.map(item=>item.id===creatingCategoryForSuggestion.id?{...item,categoryId:category.id,category:category.name}:item));
          setCreatingCategoryForSuggestion(null);
          setMessage(`Kategorie „${category.name}“ wurde angelegt und ist für diesen KI-Vorschlag ausgewählt. Prüfe die Auswahl und klicke anschließend auf „Übernehmen“.`);
        }}
      />}
    </section>
  );
}
