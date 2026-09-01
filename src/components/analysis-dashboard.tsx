"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Sparkles, Volume2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CategoryRow={name:string;current:number;last:number;average:number;color:string};
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function speak() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Im letzten vollständigen Monat lagen deine Ausgaben für Lebensmittel 96 Euro über dem Durchschnitt. App- und In-Game-Käufe waren 53 Euro höher als üblich.");
  utterance.lang = "de-DE";
  window.speechSynthesis.speak(utterance);
}

export function AnalysisDashboard() {
  const [account, setAccount] = useState("Alle sichtbaren Konten");
  const [categories,setCategories]=useState<CategoryRow[]>([]);const[months,setMonths]=useState<Array<{month:string;value:number}>>([]);const[historyMonths,setHistoryMonths]=useState(0);const[loading,setLoading]=useState(true);const[loadError,setLoadError]=useState("");
  useEffect(()=>{fetch("/api/analytics/overview").then(r=>r.json()).then(body=>{if(body.error){setLoadError(body.error);return}setCategories((body.categories??[]).map((c:{categoryName:string;current:number;last:number;average:number|null;color:string})=>({name:c.categoryName,current:c.current,last:c.last,average:c.average??0,color:c.color})));setMonths((body.months??[]).map((m:{month:string;value:number})=>({month:new Intl.DateTimeFormat("de-DE",{month:"short"}).format(new Date(`${m.month}-01T00:00:00Z`)),value:m.value})));setHistoryMonths(body.historyMonths??0)}).catch(()=>setLoadError("Analyse konnte nicht geladen werden.")).finally(()=>setLoading(false))},[]);
  const lastTotal = categories.reduce((sum, item) => sum + item.last, 0);
  const averageTotal = categories.reduce((sum, item) => sum + item.average, 0);
  const currentTotal = categories.reduce((sum, item) => sum + item.current, 0);
  const delta = lastTotal - averageTotal;
  const totalDeltaPercent = averageTotal ? Math.abs(delta / averageTotal * 100) : 0;
  const usagePercent = averageTotal ? currentTotal / averageTotal * 100 : 0;

  return <div className="space-y-7">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><div className="eyebrow">Analyse</div><h1 className="page-heading mt-1">Wohin fließt dein Geld?</h1><p className="mt-2 muted">Letzter vollständiger Monat im Vergleich zu deinem üblichen Monatswert.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="account-filter">Konten filtern</label>
        <select id="account-filter" value={account} onChange={(e) => setAccount(e.target.value)} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold">
          <option>Alle sichtbaren Konten</option><option>Gemeinschaftskonto</option><option>Mein Girokonto</option>
        </select>
        <button className="btn-secondary"><CalendarDays size={18} /> August 2026</button>
      </div>
    </header>

    {loadError&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}</div>}
    {loading&&<div className="card p-5 text-sm muted">Analysedaten werden geladen …</div>}
    {!loading&&categories.length===0&&<div className="card p-6"><h2 className="font-bold">Noch keine Ausgaben vorhanden</h2><p className="mt-2 text-sm muted">Lege unter „Konten“ ein Konto an und importiere anschließend in den Einstellungen deinen ersten Kontoauszug.</p></div>}
    <section aria-label="Monatskennzahlen" className="grid gap-4 md:grid-cols-3">
      <article className="card p-5"><div className="text-sm font-semibold muted">Letzter Monat</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(lastTotal)}</div><div className={`mt-3 flex items-center gap-1 text-sm font-semibold ${delta > 0 ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{delta > 0 ? <ArrowUpRight size={17}/> : <ArrowDownRight size={17}/>} {eur.format(Math.abs(delta))} · {totalDeltaPercent.toFixed(1)} % zum Ø</div></article>
      <article className="card p-5"><div className="text-sm font-semibold muted">12-Monats-Durchschnitt</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(averageTotal)}</div><div className="mt-3 text-sm muted">Grundlage: {historyMonths} vollständige {historyMonths===1?"Monat":"Monate"}</div></article>
      <article className="card p-5"><div className="text-sm font-semibold muted">Aktueller Monat</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(currentTotal)}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, usagePercent)}%` }} /></div><div className="mt-2 text-sm font-semibold">{usagePercent.toFixed(0)} % des üblichen Monatswerts</div></article>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
      <article className="card p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold">Top 5 Kategorien</h2><p className="mt-1 text-sm muted">August gegenüber dem Durchschnitt</p></div><button className="btn-secondary !min-h-9 !px-3 text-sm">Alle anzeigen <ArrowRight size={15}/></button></div>
        <div className="space-y-1">
          {[...categories].sort((a,b) => b.last-a.last).map((item) => { const pct = item.average ? (item.last-item.average)/item.average*100 : 0; return (
            <button key={item.name} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl border-0 bg-transparent px-2 py-3 text-left hover:bg-[var(--surface-soft)] sm:grid-cols-[1fr_110px_150px_auto]">
              <span className="flex items-center gap-3 font-semibold"><span className="h-3 w-3 rounded-full" style={{background:item.color}} />{item.name}</span>
              <span className="font-bold">{eur.format(item.last)}</span><span className={`hidden text-right text-sm font-semibold sm:block ${pct > 0 ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{pct > 0 ? "+" : ""}{eur.format(item.last-item.average)} · {pct > 0 ? "+" : ""}{pct.toFixed(0)} %</span><ChevronRight size={18} className="muted" />
            </button>
          ); })}
        </div>
      </article>
      <article className="card p-5 sm:p-6"><h2 className="text-lg font-bold">Verteilung</h2><p className="mt-1 text-sm muted">Top-Kategorien im August</p><div className="h-[270px] w-full"><ResponsiveContainer><PieChart><Pie data={categories} dataKey="last" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2}>{categories.map(c=><Cell key={c.name} fill={c.color}/>)}</Pie><Tooltip formatter={(v)=>eur.format(Number(v))}/></PieChart></ResponsiveContainer></div></article>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <article className="card p-5 sm:p-6"><h2 className="text-lg font-bold">Ausgabenverlauf</h2><p className="mt-1 text-sm muted">Letzte sechs vollständige Monate</p><div className="mt-5 h-[260px]"><ResponsiveContainer><BarChart data={months}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v)=>eur.format(Number(v))}/><Bar dataKey="value" fill="var(--primary)" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div></article>
      <article className="card border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[linear-gradient(145deg,var(--surface),var(--surface-soft))] p-5 sm:p-6">
        <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white"><Sparkles size={20}/></div><button onClick={speak} className="btn-secondary !min-h-9 !px-3 text-sm"><Volume2 size={16}/> Vorlesen</button></div>
        <h2 className="mt-5 text-lg font-bold">Was diesen Monat auffällt</h2>
        <p className="mt-3 leading-7">Deine Lebensmittel-Ausgaben lagen im August <strong>96 € über deinem Durchschnitt</strong>. App- und In-Game-Käufe waren mit 124 € ebenfalls deutlich höher als üblich.</p>
        <button className="btn-primary mt-5">KI-Hinweise erstellen <Sparkles size={17}/></button>
        <p className="mt-3 text-xs muted">Vor dem Senden siehst du Datenumfang und Kostenschätzung.</p>
      </article>
    </section>
  </div>;
}
