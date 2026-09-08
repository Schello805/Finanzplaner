"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CircleDollarSign, CreditCard, Landmark, PackageSearch, ShieldCheck, TrendingDown, TrendingUp, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import {AiInsightsCard} from "@/components/ai-insights-card";
import {MonthlyWorkflow} from "@/components/monthly-workflow";
import { CategoryHistoryChart } from "@/components/category-history-chart";

type CategoryRow={id:string;name:string;current:number;last:number;average:number;color:string};
type AccountRow={id:string;name:string};
type QualityTotals={total:number;confirmed:number;automaticSafe:number;needsReview:number;uncategorized:number;qualityPercent:number};
type Trend={categoryId:string;categoryName:string;direction:"rising"|"falling";change:number;months:number;series:Array<{month:string;value:number}>};
type Opportunity={categoryId:string;categoryName:string;monthlyIncrease:number;annualImpact:number};
type DetailEntry={id:string;transactionId:string;bookedOn:string;amount:number;currency:string;counterparty:string|null;purpose:string|null;bookingType:string|null;accountName:string;categoryName:string;split:boolean};
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const compactEur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const formatMonth=(value:string)=>value?new Intl.DateTimeFormat("de-DE",{month:"long",year:"numeric"}).format(new Date(`${value}-01T12:00:00Z`)):"";

const RADIAN=Math.PI/180;
function RingLabel(props:PieLabelRenderProps){
  const cx=Number(props.cx);const cy=Number(props.cy);const midAngle=Number(props.midAngle);const outerRadius=Number(props.outerRadius);const percent=Number(props.percent??0);
  const item=props.payload as Partial<CategoryRow>|undefined;const name=String(item?.name??props.name??"");const last=Number(item?.last??props.value??0);
  const cos=Math.cos(-midAngle*RADIAN);const sin=Math.sin(-midAngle*RADIAN);
  const startX=cx+(outerRadius+3)*cos;const startY=cy+(outerRadius+3)*sin;
  const elbowX=cx+(outerRadius+18)*cos;const elbowY=cy+(outerRadius+18)*sin;
  const right=cos>=0;const endX=elbowX+(right?12:-12);const label= name.length>18?`${name.slice(0,17)}…`:name;
  return <g aria-label={`${name}: ${eur.format(last)}, ${(percent*100).toFixed(0)} Prozent`}>
    <path d={`M${startX},${startY}L${elbowX},${elbowY}L${endX},${elbowY}`} fill="none" stroke="var(--muted)" strokeWidth={1}/>
    <text x={endX+(right?3:-3)} y={elbowY-3} textAnchor={right?"start":"end"} fill="var(--text)" fontSize={10} fontWeight={700}>{label}</text>
    <text x={endX+(right?3:-3)} y={elbowY+10} textAnchor={right?"start":"end"} fill="var(--muted)" fontSize={9}>{compactEur.format(last)} · {(percent*100).toFixed(0)} %</text>
  </g>;
}

export function AnalysisDashboard() {
  const [account, setAccount] = useState("all");
  const [accounts,setAccounts]=useState<AccountRow[]>([]);const[lastMonth,setLastMonth]=useState("");const[currentMonth,setCurrentMonth]=useState("");
  const [totals,setTotals]=useState({last:0,current:0,average:0});
  const [categories,setCategories]=useState<CategoryRow[]>([]);const[months,setMonths]=useState<Array<{month:string;value:number;excludedTransfers:number;excludedManually:number}>>([]);const[historyMonths,setHistoryMonths]=useState(0);const[loading,setLoading]=useState(true);const[loadError,setLoadError]=useState("");
  const[quality,setQuality]=useState<QualityTotals|null>(null);
  const[integrityChecks,setIntegrityChecks]=useState<string[]>([]);
  const[trends,setTrends]=useState<Trend[]>([]);const[opportunities,setOpportunities]=useState<Opportunity[]>([]);
  const[details,setDetails]=useState<{categoryId:string;name:string;entries:DetailEntry[];total:number;loading:boolean;error?:string}|null>(null);
  const[showAllCategories,setShowAllCategories]=useState(false);
  useEffect(()=>{fetch("/api/accounts").then(r=>r.json()).then(body=>{if(Array.isArray(body))setAccounts(body.map((item:AccountRow)=>({id:item.id,name:item.name})))})},[]);
  useEffect(()=>{const suffix=account==="all"?"":`?accountId=${encodeURIComponent(account)}`;fetch(`/api/analytics/overview${suffix}`).then(r=>r.json()).then(body=>{if(body.error){setLoadError(body.error);return}setLastMonth(body.lastMonth??"");setCurrentMonth(body.currentMonth??"");setTotals(body.totals??{last:0,current:0,average:0});setCategories((body.categories??[]).map((c:{categoryId:string;categoryName:string;current:number;last:number;average:number|null;color:string})=>({id:c.categoryId,name:c.categoryName,current:c.current,last:c.last,average:c.average??0,color:c.color})));setMonths((body.months??[]).map((m:{month:string;value:number;excludedTransfers?:number;excludedManually?:number})=>({month:new Intl.DateTimeFormat("de-DE",{month:"short"}).format(new Date(`${m.month}-01T00:00:00Z`)),value:m.value,excludedTransfers:m.excludedTransfers??0,excludedManually:m.excludedManually??0})));setHistoryMonths(body.historyMonths??0);setTrends(body.trends??[]);setOpportunities(body.opportunities??[]);setIntegrityChecks(body.integrityCheck?.status==="passed"?body.integrityCheck.checks??[]:[])}).catch(()=>setLoadError("Analyse konnte nicht geladen werden.")).finally(()=>setLoading(false))},[account]);
  useEffect(()=>{const suffix=account==="all"?"":`?accountId=${encodeURIComponent(account)}`;fetch(`/api/data-quality${suffix}`).then(r=>r.json()).then(body=>setQuality(body.totals??null)).catch(()=>setQuality(null))},[account]);
  const lastTotal = totals.last;
  const averageTotal = totals.average;
  const currentTotal = totals.current;
  const delta = lastTotal - averageTotal;
  const totalDeltaPercent = averageTotal > 0 ? Math.abs(delta / averageTotal * 100) : null;
  const usagePercent = averageTotal > 0 ? currentTotal / averageTotal * 100 : null;
  const positiveCategoryTotal=categories.reduce((sum,item)=>sum+Math.max(0,item.last),0);
  const refundOffset=Math.max(0,positiveCategoryTotal-lastTotal);
  const topCategories = [...categories].filter(item=>item.last>0).sort((a,b) => b.last-a.last).slice(0,5);
  const remainingTotal = Math.max(0,positiveCategoryTotal-topCategories.reduce((sum,item)=>sum+item.last,0));
  const distribution = remainingTotal>0?[...topCategories,{id:"",name:"Weitere Kategorien",current:0,last:remainingTotal,average:0,color:"#94a3b8"}]:topCategories;
  async function openDetails(categoryId:string,name:string){setDetails({categoryId,name,entries:[],total:0,loading:true});const params=new URLSearchParams({categoryId,month:lastMonth});if(account!=="all")params.set("accountId",account);const response=await fetch(`/api/analytics/category-details?${params}`);const body=await response.json();setDetails(response.ok?{categoryId,name,entries:body.entries,total:body.total,loading:false}:{categoryId,name,entries:[],total:0,loading:false,error:body.error});}

  return <div className="space-y-7">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><div className="eyebrow">Analyse</div><h1 className="page-heading mt-1">Wohin fließt dein Geld?</h1><p className="mt-2 muted">Letzter vollständiger Monat im Vergleich zu deinem üblichen Monatswert.</p></div>
      <div className="flex flex-col gap-2 lg:items-end"><nav aria-label="Schnellimport" className="flex flex-wrap gap-2"><Link href="/einstellungen/import?source=bank" className="btn-secondary !min-h-9 !px-3 text-sm"><Landmark size={15}/>Bank</Link><Link href="/einstellungen/amazon" className="btn-secondary !min-h-9 !px-3 text-sm"><PackageSearch size={15}/>Amazon</Link><Link href="/einstellungen/import?source=credit-card" className="btn-secondary !min-h-9 !px-3 text-sm"><CreditCard size={15}/>Kreditkarte</Link></nav><div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="account-filter">Konten filtern</label>
        <select id="account-filter" value={account} onChange={(e) => {setLoading(true);setLoadError("");setAccount(e.target.value)}} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold">
          <option value="all">Alle sichtbaren Konten</option>{accounts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="btn-secondary" aria-label="Ausgewerteter Monat"><CalendarDays size={18} /> {formatMonth(lastMonth)||"Letzter Monat"}</div>
      </div></div>
    </header>

    <MonthlyWorkflow />

    {quality&&quality.total>0&&<section className="card p-5" aria-label="Zuverlässigkeit der Zuordnungen"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--primary)]"/><div><h2 className="font-bold">Datenqualität · {quality.qualityPercent} % belastbar</h2><p className="mt-1 text-sm muted">Jede echte Ausgabe zählt in der Gesamtsumme. Unsichere KI-Treffer erscheinen bis zur Bestätigung unter „Nicht zugeordnet“, damit nur ihre Verteilung offen bleibt.</p></div></div><Link href="/einstellungen/datenqualitaet" className="btn-secondary shrink-0">Details prüfen <ArrowRight size={15}/></Link></div><div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]" aria-hidden="true"><span className="bg-[var(--primary)]" style={{width:`${quality.confirmed/quality.total*100}%`}}/><span className="bg-[var(--accent)]" style={{width:`${quality.automaticSafe/quality.total*100}%`}}/><span className="bg-amber-400" style={{width:`${quality.needsReview/quality.total*100}%`}}/><span className="bg-red-400" style={{width:`${quality.uncategorized/quality.total*100}%`}}/></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold"><span>{Math.round(quality.confirmed/quality.total*100)} % bestätigt/Regel</span><span>{Math.round(quality.automaticSafe/quality.total*100)} % automatisch sehr sicher</span><Link href="/umsaetze?confidence=review" className="text-amber-700">{quality.needsReview} zu prüfen</Link><Link href="/umsaetze?categoryId=none" className="text-[var(--danger)]">{quality.uncategorized} nicht zugeordnet</Link></div></section>}

    {loadError&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}</div>}
    {loading&&<div className="card p-5 text-sm muted">Analysedaten werden geladen …</div>}
    {!loading&&historyMonths>0&&historyMonths<3&&<div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Der Durchschnitt basiert erst auf {historyMonths} vollständigen {historyMonths===1?"Monat":"Monaten"}. Mit weiteren Importen wird der Vergleich belastbarer.</div>}
    {!loading&&!loadError&&integrityChecks.length>0&&<div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={16}/>Summen automatisch geprüft: {integrityChecks.join(" · ")}</div>}
    {!loading&&!loadError&&categories.length===0&&<div className="card p-6"><h2 className="font-bold">Noch keine Ausgaben für diese Auswahl</h2><p className="mt-2 text-sm muted">Lege bei Bedarf zuerst ein Konto an und importiere danach den passenden Kontoauszug. Bereits vorhandene Konten kannst du oben auswählen.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/konten" className="btn-secondary">Konten verwalten</Link><Link href="/einstellungen/import" className="btn-primary">Kontoauszug importieren</Link></div></div>}
    <section id="analyse" aria-label="Monatskennzahlen" className={`grid scroll-mt-6 gap-4 md:grid-cols-3 ${loading||loadError||!categories.length?"hidden":""}`}>
      <article className="card p-5"><div className="text-sm font-semibold muted">Letzter Monat</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(lastTotal)}</div>{totalDeltaPercent===null?<div className="mt-3 text-sm muted">Noch kein historischer Vergleichswert</div>:<div className={`mt-3 flex items-center gap-1 text-sm font-semibold ${delta > 0 ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{delta > 0 ? <ArrowUpRight size={17}/> : <ArrowDownRight size={17}/>} {eur.format(Math.abs(delta))} · {totalDeltaPercent.toFixed(1)} % zum Ø</div>}</article>
      <article className="card p-5"><div className="text-sm font-semibold muted">12-Monats-Durchschnitt</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(averageTotal)}</div><div className="mt-3 text-sm muted">Grundlage: {historyMonths} vollständige {historyMonths===1?"Monat":"Monate"}</div></article>
      <article className="card p-5"><div className="text-sm font-semibold muted">Aktueller Monat · {formatMonth(currentMonth)||"laufend"}</div><div className="mt-2 text-3xl font-bold tracking-tight">{eur.format(currentTotal)}</div>{usagePercent===null?<div className="mt-3 text-sm muted">Noch kein historischer Vergleichswert</div>:<><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, usagePercent)}%` }} /></div><div className="mt-2 text-sm font-semibold">{usagePercent.toFixed(0)} % des üblichen Monatswerts</div></>}</article>
    </section>

    <section className={`grid gap-5 xl:grid-cols-[1.45fr_.8fr] ${loading||loadError||!categories.length?"hidden":""}`}>
      <article className="card p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold">Top 5 Kategorien</h2><p className="mt-1 text-sm muted">{formatMonth(lastMonth)||"Letzter Monat"} gegenüber dem Durchschnitt</p></div><button type="button" onClick={()=>setShowAllCategories(true)} className="btn-secondary !min-h-9 !px-3 text-sm">Alle anzeigen <ArrowRight size={15}/></button></div>
        <div className="space-y-1">
          {topCategories.map((item) => { const pct = item.average > 0 ? (item.last-item.average)/item.average*100 : null; return (
            <button type="button" onClick={()=>void openDetails(item.id,item.name)} key={item.name} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-[var(--surface-soft)] sm:grid-cols-[1fr_110px_150px]">
              <span className="flex items-center gap-3 font-semibold"><span className="h-3 w-3 rounded-full" style={{background:item.color}} />{item.name}</span>
              <span className="font-bold">{eur.format(item.last)}</span><span className={`hidden text-right text-sm font-semibold sm:block ${pct!==null&&pct>0 ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}>{item.last-item.average>0?"+":""}{eur.format(item.last-item.average)} · {pct===null?"kein Vergleich":`${pct>0?"+":""}${pct.toFixed(0)} %`}</span>
            </button>
          ); })}
        </div>
      </article>
      <article className="card p-5 sm:p-6"><h2 className="text-lg font-bold">Verteilung</h2><p className="mt-1 text-sm muted">Top-Kategorien im {formatMonth(lastMonth)||"letzten Monat"}; Segmente lassen sich für Details öffnen.</p><div className="h-[330px] w-full"><ResponsiveContainer><PieChart margin={{top:42,right:72,bottom:42,left:72}}><Pie data={distribution} dataKey="last" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={2} labelLine={false} label={RingLabel} onClick={(entry)=>{const item=entry as unknown as CategoryRow;if(item.id)void openDetails(item.id,item.name)}} className="cursor-pointer">{distribution.map(c=><Cell key={c.name} fill={c.color}/>)}</Pie><Tooltip formatter={(v)=>eur.format(Number(v))}/></PieChart></ResponsiveContainer></div>{refundOffset>0&&<p className="mt-1 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Erstattungen von {eur.format(refundOffset)} reduzieren den Monatsgesamtwert auf {eur.format(lastTotal)}.</p>}</article>
    </section>

    {!loading&&!loadError&&categories.length>0&&<CategoryHistoryChart accountId={account}/>}

    <section className={`grid gap-5 lg:grid-cols-2 ${loading||loadError||!categories.length?"hidden":""}`}>
      <article className="card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><TrendingUp className="text-[var(--primary)]"/>Erkannte Entwicklungen</h2><p className="mt-1 text-sm muted">Nur klare, durchgängige Bewegungen über mindestens drei vollständige Monate.</p><div className="mt-4 space-y-2">{trends.length?trends.map(trend=><button type="button" key={trend.categoryId} onClick={()=>void openDetails(trend.categoryId,trend.categoryName)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-soft)]"><span><strong>{trend.categoryName}</strong><span className="mt-1 block text-xs muted">{trend.months} Monate in Folge {trend.direction==="rising"?"gestiegen":"gesunken"}</span><span className="mt-1 block text-xs muted">{trend.series.slice(-4).map(point=>`${new Intl.DateTimeFormat("de-DE",{month:"short"}).format(new Date(`${point.month}-01T12:00:00Z`))} ${compactEur.format(point.value)}`).join(" → ")}</span></span><span className={`flex shrink-0 items-center gap-1 font-bold ${trend.direction==="rising"?"text-[var(--danger)]":"text-[var(--primary)]"}`}>{trend.direction==="rising"?<TrendingUp size={17}/>:<TrendingDown size={17}/>} {eur.format(Math.abs(trend.change))}</span></button>):<p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm muted">Noch kein eindeutiger mehrmonatiger Trend erkennbar.</p>}</div></article>
      <article className="card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="text-[var(--primary)]"/>Größte Mehrkosten</h2><p className="mt-1 text-sm muted">Rechnerisches Prüfpotenzial gegenüber deinem bisherigen Monatsdurchschnitt – keine Spargarantie.</p><div className="mt-4 space-y-2">{opportunities.length?opportunities.map(item=><button type="button" key={item.categoryId} onClick={()=>void openDetails(item.categoryId,item.categoryName)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-soft)]"><span><strong>{item.categoryName}</strong><span className="mt-1 block text-xs muted">zuletzt {eur.format(item.monthlyIncrease)} über dem Durchschnitt</span></span><span className="text-right font-bold text-[var(--danger)]">{eur.format(item.annualImpact)}<span className="block text-xs font-normal muted">hochgerechnet/Jahr</span></span></button>):<p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm muted">Keine relevante Mehrbelastung gegenüber dem Durchschnitt erkannt.</p>}</div></article>
    </section>

    <section className={`grid gap-5 xl:grid-cols-[1.2fr_1fr] ${loading||loadError||!categories.length?"hidden":""}`}>
      <article className="card p-5 sm:p-6"><h2 className="text-lg font-bold">Ausgabenverlauf</h2><p className="mt-1 text-sm muted">Letzte sechs vollständige Monate · interne Umbuchungen zählen nicht als Ausgabe</p><div className="mt-5 h-[280px]"><ResponsiveContainer><BarChart data={months} margin={{top:28,right:8,left:8,bottom:0}}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v)=>eur.format(Number(v))}/><Bar dataKey="value" fill="var(--primary)" radius={[8,8,0,0]}><LabelList dataKey="value" position="top" formatter={(value:unknown)=>`${new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(value))} €`} fill="var(--text)" fontSize={12} fontWeight={700}/></Bar></BarChart></ResponsiveContainer></div>{months.some(month=>month.excludedTransfers>0||month.excludedManually>0)&&<div className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-xs muted"><strong className="text-[var(--text)]">Nicht in den Balken enthalten:</strong> {months.filter(month=>month.excludedTransfers>0||month.excludedManually>0).map(month=>`${month.month}: ${month.excludedTransfers?`${eur.format(month.excludedTransfers)} interne Umbuchungen`:""}${month.excludedTransfers&&month.excludedManually?" + ":""}${month.excludedManually?`${eur.format(month.excludedManually)} manuell ausgeschlossen`:""}`).join(" · ")} <Link href="/umsaetze?type=transfer" className="ml-1 font-semibold text-[var(--primary)] underline">Umbuchungen prüfen</Link></div>}</article>
      <AiInsightsCard/>
    </section>
    {showAllCategories&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="all-categories-title"><section className="card w-full max-w-2xl p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="all-categories-title" className="text-xl font-bold">Alle Kategorien · {formatMonth(lastMonth)}</h2><p className="mt-1 text-sm muted">Hauptkategorien einschließlich ihrer Unterkategorien. Öffne eine Kategorie für die einzelnen Buchungen.</p></div><button type="button" onClick={()=>setShowAllCategories(false)} className="btn-secondary !min-h-10 !px-3" aria-label="Übersicht schließen"><X size={18}/></button></div><div className="mt-5 max-h-[65dvh] space-y-2 overflow-y-auto">{[...categories].sort((a,b)=>b.last-a.last).map(item=><button type="button" key={item.id} onClick={()=>{setShowAllCategories(false);void openDetails(item.id,item.name)}} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-soft)]"><span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{background:item.color}}/><strong>{item.name}</strong></span><span className="text-right"><strong>{eur.format(item.last)}</strong><span className="block text-xs muted">Ø {eur.format(item.average)}</span></span></button>)}</div></section></div>}
    {details&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="category-details-title"><section className="card w-full max-w-3xl p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="category-details-title" className="text-xl font-bold">{details.name} · {formatMonth(lastMonth)}</h2><p className="mt-1 text-sm muted">Enthaltene Unterkategorien und verursachende Buchungen · Summe {eur.format(details.total)}</p></div><button type="button" onClick={()=>setDetails(null)} className="btn-secondary !min-h-10 !px-3" aria-label="Details schließen"><X size={18}/></button></div>{details.loading?<p className="mt-5 text-sm muted">Buchungen werden geladen …</p>:details.error?<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{details.error}</p>:<div className="mt-5 max-h-[65dvh] space-y-2 overflow-y-auto">{details.entries.map(entry=><article key={entry.id} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[100px_1fr_auto]"><span className="text-sm">{new Intl.DateTimeFormat("de-DE").format(new Date(`${entry.bookedOn}T12:00:00Z`))}</span><span className="min-w-0"><strong className="block break-words">{entry.counterparty??entry.bookingType??"Unbekannt"}</strong><span className="mt-1 block break-words text-xs muted">{entry.purpose||"Kein weiterer Buchungstext"} · {entry.accountName} · {entry.categoryName}{entry.split?" · Teilbetrag":""}</span></span><strong>{entry.amount<0?"− ":""}{eur.format(Math.abs(entry.amount))}</strong></article>)}{!details.entries.length&&<p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm muted">Keine Buchungen gefunden.</p>}</div>}</section></div>}
  </div>;
}
