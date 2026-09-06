"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Check, ChevronRight, Circle, FileUp, PackageSearch, Sparkles } from "lucide-react";

type Status = { accountCount:number;transactionCount:number;uncategorizedCount:number;amazonOpenCount:number;lastImportAt:string|null;aiConfigured:boolean };

export function MonthlyWorkflow() {
  const [status,setStatus]=useState<Status|null>(null);
  useEffect(()=>{fetch("/api/workflow/status").then(response=>response.json()).then(body=>{if(typeof body.accountCount==="number")setStatus(body)})},[]);
  if(!status)return null;
  const steps=[
    {number:1,title:"Kontoauszug importieren",detail:status.lastImportAt?`Letzter Import: ${new Intl.DateTimeFormat("de-DE",{dateStyle:"medium"}).format(new Date(status.lastImportAt))}`:status.accountCount?"Bereit für den ersten Kontoauszug":"Zuerst ein Konto anlegen",href:status.accountCount?"/einstellungen/import":"/konten",done:status.transactionCount>0,icon:FileUp},
    {number:2,title:"Zuordnungen klären",detail:status.uncategorizedCount?`${status.uncategorizedCount} Umsätze sind noch offen${status.aiConfigured?"":" · KI noch nicht eingerichtet"}`:status.transactionCount?"Alle Umsätze sind zugeordnet":"Nach dem ersten Import verfügbar",href:"/umsaetze",done:status.transactionCount>0&&status.uncategorizedCount===0,icon:Sparkles},
    {number:null,title:"Amazon-Einkäufe ergänzen",detail:status.amazonOpenCount?`Optional: ${status.amazonOpenCount} Artikel sind noch nicht verbunden`:"Optional, falls du Amazon-Bestellungen aufteilen möchtest",href:"/einstellungen/amazon",done:false,optional:true,icon:PackageSearch},
    {number:3,title:"Analyse ansehen",detail:status.transactionCount?status.uncategorizedCount?"Bereits verfügbar; nach der Prüfung vollständig":"Deine geprüfte Monatsanalyse ist bereit":"Nach dem ersten Import verfügbar",href:"#analyse",done:status.transactionCount>0&&status.uncategorizedCount===0,icon:BarChart3},
  ];
  const primaryHref=status.accountCount?"/einstellungen/import":"/konten";
  return <section className="card p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold">Dein Monatsablauf</h2><p className="mt-1 text-sm muted">Dateien einlesen, nur offene Fälle klären und anschließend die fertige Analyse nutzen.</p></div><Link href={primaryHref} className="btn-primary">{status.accountCount?<FileUp size={17}/>:<Circle size={17}/>} {status.accountCount?"Neuen Kontoauszug auswerten":"Erstes Konto anlegen"}</Link></div><div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{steps.map(({number,title,detail,href,done,optional,icon:Icon})=><Link key={title} href={href} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-4 text-[var(--text)] no-underline hover:bg-[var(--surface-soft)]"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done?"bg-emerald-100 text-emerald-800":"bg-[var(--surface-soft)] text-[var(--primary)]"}`}>{done?<Check size={17}/>:<Circle size={15}/>}</span><span className="min-w-0 flex-1"><span className="text-xs font-bold uppercase muted">{optional?"Optional":`Schritt ${number}`}</span><span className="mt-1 flex items-center gap-2 font-bold"><Icon size={16}/>{title}</span><span className="mt-1 block text-sm muted">{detail}</span></span><ChevronRight size={18} className="mt-2 shrink-0 muted"/></Link>)}</div></section>;
}
