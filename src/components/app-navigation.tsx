"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Landmark, List, Settings, ShieldCheck } from "lucide-react";

const links = [
  { href: "/", label: "Analysen", icon: BarChart3 },
  { href: "/umsaetze", label: "Umsätze", icon: List },
  { href: "/konten", label: "Konten", icon: Landmark },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export function AppNavigation() {
  const pathname = usePathname();
  if (pathname === "/anmelden" || pathname === "/passwort-aendern" || pathname === "/einrichtung" || pathname === "/einladung") return null;
  return <>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 md:block">
      <Link href="/" className="mb-9 flex items-center gap-3 px-2 no-underline text-[var(--text)]">
        <Image src="/logo-finanzplaner.jpeg" alt="Finanzplaner" width={46} height={46} className="rounded-xl" priority />
        <div><div className="font-bold tracking-tight">Finanzplaner</div><div className="text-xs muted">Familienfinanzen</div></div>
      </Link>
      <nav aria-label="Hauptnavigation" className="space-y-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 font-semibold no-underline transition ${active ? "bg-[var(--surface-soft)] text-[var(--primary-dark)]" : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"}`}>
            <Icon size={20} aria-hidden />{label}
          </Link>;
        })}
      </nav>
      <div className="absolute bottom-6 left-4 right-4 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm">
        <div className="font-semibold">Familie Schellenberger</div><div className="mt-1 muted">3 Konten · 2 Mitglieder</div>
      </div>
    </aside>
    <nav aria-label="Mobile Hauptnavigation" className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)] px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ href, label, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return (
        <Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline ${active ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>
          <Icon size={21} aria-hidden /><span>{label}</span>
        </Link>
      ); })}
    </nav>
  </>;
}
