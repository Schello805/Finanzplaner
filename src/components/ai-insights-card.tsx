"use client";

import { useEffect, useState } from "react";
import { Banknote, Car, House, Lightbulb, PartyPopper, Repeat2, ShoppingBasket, Sparkles, TriangleAlert, Volume2 } from "lucide-react";

type Preview = { provider: "openai" | "gemini"; model: string; cost: { lowEur: number; highEur: number } | null; pricingSource: "configured" | "model-default" | null };
type Opportunity = { category: string; action: string; reason: string; icon: "home" | "car" | "shopping" | "subscription" | "bank" | "leisure" | "general"; potentialEur: number };
type Insight = { summary: string; opportunities: Opportunity[]; watchouts: string[]; estimatedCostEur: number | null; pricingAvailable: boolean };

const iconMap = { home: House, car: Car, shopping: ShoppingBasket, subscription: Repeat2, bank: Banknote, leisure: PartyPopper, general: Lightbulb };
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
function aiCost(value: number | null | undefined) {
  if (value === null || value === undefined) return "Preisangaben fehlen";
  if (value > 0 && value < 0.0001) return "< 0,0001 €";
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} €`;
}

export function AiInsightsCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function create(automatic = false) {
    setBusy(true); setError("");
    const response = await fetch("/api/ai/insights", { method: "POST" });
    const body = await response.json();
    setBusy(false);
    if (response.ok) setInsight(body); else setError(body.error);
    if (automatic && response.ok) sessionStorage.setItem("finanzplaner-auto-insights", new Date().toISOString().slice(0, 10));
  }
  useEffect(() => {
    Promise.all([fetch("/api/ai/insights").then((response) => response.json()), fetch("/api/user/preferences").then((response) => response.json())]).then(([nextPreview, preferences]) => {
      if (nextPreview.provider) setPreview(nextPreview);
      if (preferences.automaticInsights && sessionStorage.getItem("finanzplaner-auto-insights") !== new Date().toISOString().slice(0, 10)) create(true);
    });
  }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  async function speak() {
    if (!insight || speechBusy) return;
    const text = [insight.summary, ...insight.opportunities.flatMap((item) => [`${item.category}. ${item.action}`, item.reason]), ...insight.watchouts].join(" ");
    setSpeechBusy(true); setError("");
    try {
      const response = await fetch("/api/ai/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Sprachausgabe konnte nicht erstellt werden.");
      }
      const url = URL.createObjectURL(await response.blob());
      setAudioUrl(url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Sprachausgabe konnte nicht erstellt werden.");
    } finally {
      setSpeechBusy(false);
    }
  }
  const opportunities = [...(insight?.opportunities ?? [])].sort((a, b) => b.potentialEur - a.potentialEur).slice(0, 3);
  return <article className="card border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[linear-gradient(145deg,var(--surface),var(--surface-soft))] p-5 sm:p-6">
    <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white"><Sparkles size={20}/></div>{insight&&<button disabled={speechBusy} onClick={speak} className="btn-secondary !min-h-9 !px-3 text-sm"><Volume2 size={16}/> {speechBusy ? "Stimme wird erzeugt …" : "Natürlich vorlesen"}</button>}</div>
    <h2 className="mt-5 text-lg font-bold">Größte Sparchancen</h2>
    {insight ? <>
      <p className="mt-2 text-sm leading-6 muted">{insight.summary}</p>
      <div className="mt-4 space-y-3">{opportunities.map((item, index) => { const Icon = iconMap[item.icon]; return <section key={`${item.category}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--primary)]"><Icon size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{item.category}</h3>{item.potentialEur>0&&<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">bis zu {eur.format(item.potentialEur)} Abweichung</span>}</div><p className="mt-2 font-semibold">{item.action}</p><p className="mt-1 text-xs leading-5 muted">{item.reason}</p></div></div>
      </section>; })}</div>
      {insight.watchouts.length>0&&<div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><div className="flex gap-2"><TriangleAlert size={17} className="mt-0.5 shrink-0"/><div>{insight.watchouts.map((item)=><p key={item} className="mb-1 last:mb-0">{item}</p>)}</div></div></div>}
      <p className="mt-4 text-xs muted">Geschätzte Kosten dieses Aufrufs: {aiCost(insight.estimatedCostEur)}</p>
    </> : <p className="mt-3 text-sm leading-6 muted">Die KI erhält nur verdichtete Kategoriesummen. Sie zeigt höchstens drei priorisierte Ansatzpunkte statt einer langen Wiederholung aller Kennzahlen.</p>}
    {error&&<div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {audioUrl&&<audio controls autoPlay src={audioUrl} className="mt-4 w-full" aria-label="Vorgelesene Sparchancen"/>}
    <button disabled={busy||!preview} onClick={()=>create(false)} className="btn-primary mt-5">{busy?"KI priorisiert Sparchancen …":insight?"Hinweise aktualisieren":"Sparchancen ermitteln"} <Sparkles size={17}/></button>
    {preview&&<p className="mt-3 text-xs muted">{preview.provider==="openai"?"OpenAI":"Gemini"} · {preview.model} · {preview.cost?`geschätzt ${aiCost(preview.cost.lowEur)}–${aiCost(preview.cost.highEur)}`:"Preisangaben im Adminbereich ergänzen"}{preview.pricingSource==="model-default"?" · Modellpreis automatisch ergänzt":""}</p>}
  </article>;
}
