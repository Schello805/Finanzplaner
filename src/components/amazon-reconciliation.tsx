"use client";

import { useEffect, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";

type Category = { id: string; name: string; isIncome: boolean };
type Group = {
  key: string; orderDate: string; shipDate: string | null; total: number; currency: string; matchedTransactionId: string | null;
  items: Array<{ id: string; productName: string; quantity: number; gross: number; categoryId: string | null; suggestion: { categoryId: string; categoryName: string; reason: string } | null }>;
  candidates: Array<{ id: string; bookedOn: string; amount: number; currency: string; accountName: string }>;
};

export function AmazonReconciliation() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [orderRows, categoryRows] = await Promise.all([
      fetch("/api/amazon/orders").then((response) => response.json()),
      fetch("/api/categories").then((response) => response.json()),
    ]);
    if (Array.isArray(orderRows)) {
      setGroups(orderRows);
      setTransactions(Object.fromEntries(orderRows.map((group: Group) => [group.key, group.matchedTransactionId ?? (group.candidates.length === 1 ? group.candidates[0].id : "")])));
    } else setMessage(orderRows.error);
    if (Array.isArray(categoryRows)) setCategories(categoryRows);
  }
  useEffect(() => { Promise.all([fetch("/api/amazon/orders").then((response) => response.json()), fetch("/api/categories").then((response) => response.json())]).then(([orderRows, categoryRows]) => { if (Array.isArray(orderRows)) { setGroups(orderRows); setTransactions(Object.fromEntries(orderRows.map((group: Group) => [group.key, group.matchedTransactionId ?? (group.candidates.length === 1 ? group.candidates[0].id : "")]))); } if (Array.isArray(categoryRows)) setCategories(categoryRows); }); }, []);
  async function setCategory(itemId: string, categoryId: string) {
    const response = await fetch("/api/amazon/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, categoryId: categoryId || null }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error); return; }
    setGroups((current) => current.map((group) => ({ ...group, items: group.items.map((item) => item.id === itemId ? { ...item, categoryId: categoryId || null } : item) })));
  }
  async function apply(group: Group) {
    const transactionId = transactions[group.key];
    if (!transactionId) { setMessage("Bitte eine passende Bankbuchung auswählen."); return; }
    setBusy(true); setMessage("");
    const response = await fetch("/api/amazon/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: group.items.map((item) => item.id), transactionId }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(body.error); return; }
    setMessage(`Amazon-Zahlung wurde auf ${body.splitCount} Kategorien verteilt.`);
    await load();
  }
  async function acceptSuggestions(group: Group) {
    const proposed = group.items.filter((item) => !item.categoryId && item.suggestion);
    if (!proposed.length) return;
    setBusy(true); setMessage("");
    for (const item of proposed) {
      const response = await fetch("/api/amazon/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, categoryId: item.suggestion!.categoryId }) });
      if (!response.ok) { setMessage((await response.json()).error); setBusy(false); return; }
    }
    setMessage(`${proposed.length} lokale Amazon-Vorschläge wurden bestätigt.`);
    setBusy(false);
    await load();
  }
  const unresolved = groups.filter((group) => !group.matchedTransactionId);
  return <section className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-lg font-bold">Mit Bankumsätzen abstimmen</h2><p className="mt-1 text-sm muted">Artikel kategorisieren und anschließend mit einer betragsgleichen Amazon-Buchung verbinden.</p></div><button onClick={load} className="btn-secondary"><RefreshCw size={16}/> Aktualisieren</button></div>
    {message&&<div role="status" className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{message}</div>}
    {unresolved.length===0?<article className="card p-5 text-sm muted">Keine offenen Amazon-Zuordnungen mit passender Bankbuchung vorhanden.</article>:unresolved.map((group)=><article key={group.key} className="card p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><h3 className="font-bold">Amazon-Bestellung vom {new Intl.DateTimeFormat("de-DE").format(new Date(`${group.orderDate}T12:00:00`))}</h3><p className="mt-1 text-sm muted">{group.items.length} Artikel · {group.total.toLocaleString("de-DE",{style:"currency",currency:group.currency})}</p></div><select value={transactions[group.key]??""} onChange={(event)=>setTransactions((current)=>({...current,[group.key]:event.target.value}))} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"><option value="">Bankbuchung auswählen</option>{group.candidates.map((candidate)=><option key={candidate.id} value={candidate.id}>{new Intl.DateTimeFormat("de-DE").format(new Date(`${candidate.bookedOn}T12:00:00`))} · {candidate.accountName} · {Math.abs(candidate.amount).toLocaleString("de-DE",{style:"currency",currency:candidate.currency})}</option>)}</select></div>{group.items.some((item)=>!item.categoryId&&item.suggestion)&&<button disabled={busy} onClick={()=>acceptSuggestions(group)} className="btn-secondary mt-4">Alle passenden Vorschläge bestätigen</button>}<div className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">{group.items.map((item)=><div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_230px] sm:items-center"><div><div className="font-semibold">{item.productName}</div><div className="mt-1 text-xs muted">Menge {item.quantity} · Artikelwert {item.gross.toLocaleString("de-DE",{style:"currency",currency:group.currency})}</div>{!item.categoryId&&item.suggestion&&<div className="mt-2 text-xs font-semibold text-[var(--primary)]">Vorschlag: {item.suggestion.categoryName} · {item.suggestion.reason}</div>}</div><select value={item.categoryId??""} onChange={(event)=>setCategory(item.id,event.target.value)} className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"><option value="">Kategorie auswählen</option>{categories.filter((category)=>!category.isIncome).map((category)=><option key={category.id} value={category.id}>{category.name}</option>)}</select></div>)}</div><button disabled={busy||!transactions[group.key]||group.items.some((item)=>!item.categoryId)} onClick={()=>apply(group)} className="btn-primary mt-4"><Link2 size={16}/>{busy?"Wird zugeordnet …":"Kategorien auf Bankbuchung anwenden"}</button>{group.candidates.length===0&&<p className="mt-3 text-sm text-amber-800">Keine betragsgleiche Amazon-Buchung im Zeitraum von 21 Tagen gefunden.</p>}</article>)}
  </section>;
}
