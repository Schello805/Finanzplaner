import Link from "next/link";
import { Activity, Bot, ChevronRight, FileUp, Lock, PackageSearch, Repeat2, Tags, UserRound, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const settings = [
  { icon:FileUp, title:"Datenimporte", detail:"CSV hochladen und Importverlauf anzeigen", href:"/einstellungen/import" },
  { icon:PackageSearch, title:"Amazon-Bestellungen", detail:"Order History importieren und Sammelbestellungen aufteilen", href:"/einstellungen/amazon" },
  { icon:Bot, title:"KI & Datenschutz", detail:"Einwilligungen, Übertragungsmodus und Kostennutzung", href:"/einstellungen/ki" },
  { icon:Tags, title:"Kategorien", detail:"Ausgaben, Einnahmen und Unterkategorien verwalten", href:"/einstellungen/kategorien" },
  { icon:WandSparkles, title:"Gelernte Regeln", detail:"Automatische Händlerzuordnungen korrigieren oder pausieren", href:"/einstellungen/regeln" },
  { icon:Repeat2, title:"Wiederkehrende Kosten", detail:"Abos, regelmäßige Zahlungen und Preisänderungen erkennen", href:"/einstellungen/wiederkehrend" },
  { icon:Activity, title:"Datenqualität", detail:"Importstand, Zeiträume und offene Aufgaben je Konto prüfen", href:"/einstellungen/datenqualitaet" },
  { icon:UserRound, title:"Profil & Reset-E-Mail", detail:"Kontaktadresse für den Passwort-Reset verwalten", href:"/einstellungen/profil" },
  { icon:Lock, title:"Sicherheit", detail:"Passwort und optionale Zwei-Faktor-Anmeldung", href:"/einstellungen/sicherheit" },
];
export default function SettingsPage() { return <div className="space-y-7"><PageHeader eyebrow="Persönlich" title="Einstellungen" description="Verwalte Daten, Freigaben und deine Privatsphäre."/><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{settings.map(({icon:Icon,title,detail,href})=><Link key={title} href={href} className="card group flex min-h-40 flex-col p-5 text-[var(--text)] no-underline hover:border-[var(--primary)] hover:bg-[var(--surface-soft)]"><div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--primary)]"><Icon size={21}/></div><ChevronRight className="muted transition-transform group-hover:translate-x-1" size={19}/></div><div className="mt-5 font-bold">{title}</div><div className="mt-1 text-sm leading-5 muted">{detail}</div></Link>)}</section></div>; }
