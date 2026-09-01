import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const rows = [
  ["31.08.2026", "Supermarkt Nord", "Lebensmittel", "− 84,32 €"],
  ["29.08.2026", "Tankstelle", "Tanken", "− 72,10 €"],
  ["28.08.2026", "App Store", "App- & In-Game-Käufe", "− 19,99 €"],
  ["27.08.2026", "Arbeitgeber", "Lohn & Gehalt", "+ 3.420,00 €"],
];
export default function TransactionsPage() { return <div className="space-y-7">
  <PageHeader eyebrow="Buchungen" title="Umsätze" description="Durchsuche, prüfe und kategorisiere deine Buchungen." action={<button className="btn-secondary"><SlidersHorizontal size={18}/> Kategorien verwalten</button>}/>
  <section className="card overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"><Search size={18} className="muted"/><span className="sr-only">Umsätze suchen</span><input className="w-full border-0 bg-transparent outline-none" placeholder="Empfänger, Verwendungszweck oder Betrag"/></label><button className="btn-secondary"><Filter size={17}/> Filter</button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-sm"><thead className="bg-[var(--surface-soft)] text-left muted"><tr>{["Datum","Empfänger","Kategorie","Betrag"].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface-soft)]">{r.map((c,j)=><td key={j} className={`px-5 py-4 ${j===3?"text-right font-bold":""}`}>{c}</td>)}</tr>)}</tbody></table></div>
  </section>
</div>; }
