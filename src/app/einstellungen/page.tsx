import Link from "next/link";
import { Activity, Bot, Building2, ChevronRight, FileUp, PackageSearch, Repeat2, Tags, UserRound, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const settings = [
  { icon:FileUp, title:"Datenimporte", detail:"CSV hochladen und Importverlauf anzeigen", href:"/einstellungen/import" },
  { icon:Building2, title:"Sparkasse verbinden", detail:"Konten und Umsätze ausschließlich lesend über FinTS abrufen", href:"/einstellungen/sparkasse" },
  { icon:PackageSearch, title:"Amazon-Bestellungen", detail:"Order History importieren und Sammelbestellungen aufteilen", href:"/einstellungen/amazon" },
  { icon:WandSparkles, title:"Zuordnungen & Automatik", detail:"Bank-, Buchungstext- und Amazon-Regeln gemeinsam verwalten", href:"/einstellungen/automatik" },
  { icon:Bot, title:"KI & Datenschutz", detail:"Einwilligungen, Übertragungsmodus und Kostennutzung", href:"/einstellungen/ki" },
  { icon:Tags, title:"Kategorien", detail:"Ausgaben, Einnahmen und Unterkategorien verwalten", href:"/einstellungen/kategorien" },
  { icon:Repeat2, title:"Abos & regelmäßige Kosten", detail:"Kündbare Abonnements, Fixkosten und Preisänderungen prüfen", href:"/einstellungen/wiederkehrend" },
  { icon:Activity, title:"Datenqualität", detail:"Importstand, Zeiträume und offene Aufgaben je Konto prüfen", href:"/einstellungen/datenqualitaet" },
];
export default function SettingsPage() { return <div className="space-y-7"><PageHeader eyebrow="Finanzplaner" title="Einstellungen" description="Verwalte Importe, Automatik, Kategorien und Datenqualität." action={<Link href="/einstellungen/profil" className="btn-secondary"><UserRound size={17}/>Mein Profil</Link>}/><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{settings.map(({icon:Icon,title,detail,href})=><Link key={title} href={href} className="card group grid min-h-28 grid-cols-[44px_1fr_auto] items-center gap-4 p-5 text-[var(--text)] no-underline hover:border-[var(--primary)] hover:bg-[var(--surface-soft)]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><Icon size={21}/></span><span className="min-w-0"><strong className="block">{title}</strong><span className="mt-1 block text-sm leading-5 muted">{detail}</span></span><ChevronRight className="muted transition-transform group-hover:translate-x-1" size={19}/></Link>)}</section></div>; }
