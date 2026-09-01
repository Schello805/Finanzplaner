import { Eye, Landmark, LockKeyhole, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const accounts = [
  { name:"Gemeinschaftskonto", type:"Gemeinsam", icon:Users, suffix:"•••• 4821", info:"Für beide Partner sichtbar", balance:"2.840,18 €" },
  { name:"Mein Girokonto", type:"Persönlich", icon:Landmark, suffix:"•••• 1927", info:"Privat", balance:"1.275,44 €" },
  { name:"Kinderkonto Lena", type:"Kinderkonto", icon:LockKeyhole, suffix:"•••• 7310", info:"Verwaltet von Michael und Anna", balance:"340,00 €" },
];
export default function AccountsPage() { return <div className="space-y-7"><PageHeader eyebrow="Haushalt" title="Konten" description="Persönliche, gemeinsame und verwaltete Kinderkonten." action={<button className="btn-primary"><Plus size={18}/> Konto anlegen</button>}/><section className="grid gap-4 lg:grid-cols-3">{accounts.map(({name,type,icon:Icon,suffix,info,balance})=><article key={name} className="card p-5"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><Icon size={22}/></div><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold">{type}</span></div><h2 className="mt-5 text-lg font-bold">{name}</h2><div className="mt-1 text-sm muted">{suffix}</div><div className="mt-6 text-2xl font-bold">{balance}</div><div className="mt-1 text-xs muted">Berechneter Saldo</div><div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-4 text-sm muted"><Eye size={16}/>{info}</div></article>)}</section></div>; }
