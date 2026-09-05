"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { flattenCategoryHierarchy } from "@/features/categories/hierarchy";
type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isIncome: boolean;
  parentId: string | null;
  transactionCount: number;
};
export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<{category:Category;impact:{transactions:number;splits:number;amazonItems:number;rules:number;childCategories:number}}|null>(null);
  const [resolution, setResolution] = useState<"move"|"uncategorize">("move");
  const [replacementCategoryId, setReplacementCategoryId] = useState("");
  async function load() {
    const body = await fetch("/api/categories").then((r) => r.json());
    if (Array.isArray(body)) setRows(body);
    else setMessage(body.error);
  }
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((body) =>
        Array.isArray(body) ? setRows(body) : setMessage(body.error),
      );
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      ...(editing !== "new" && editing ? { id: editing.id } : {}),
      name: form.get("name"),
      color: form.get("color"),
      icon: "Tag",
      isIncome: form.get("isIncome") === "on",
      parentId: form.get("parentId") || null,
    };
    const response = await fetch("/api/categories", {
      method: editing === "new" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Kategorie gespeichert.");
    setEditing(null);
    await load();
  }
  async function remove(category: Category, confirmed = false) {
    const response = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id, ...(confirmed ? { resolution, replacementCategoryId: resolution === "move" ? replacementCategoryId : null } : {}) }),
    });
    const result = await response.json();
    if (response.status === 409) {
      setDeleting({ category, impact: result.impact });
      setReplacementCategoryId(rows.find((row) => row.id !== category.id && row.isIncome === category.isIncome)?.id ?? "");
      return;
    }
    if (!response.ok) { setMessage(result.error); return; }
    setMessage("Kategorie wurde gelöscht.");
    setDeleting(null);
    await load();
  }
  const current =
    editing === "new"
      ? { name: "", color: "#136f78", isIncome: false, parentId: null }
      : editing;
  const hierarchy = useMemo(() => flattenCategoryHierarchy(rows), [rows]);
  const sections = useMemo(
    () => [
      {
        key: "expenses",
        title: "Ausgaben",
        description: "Kategorien für Käufe, Verträge und sonstige Ausgaben",
        items: flattenCategoryHierarchy(rows.filter((row) => !row.isIncome)),
      },
      {
        key: "income",
        title: "Einnahmen",
        description: "Kategorien für Gehalt, Erstattungen und sonstige Einnahmen",
        items: flattenCategoryHierarchy(rows.filter((row) => row.isIncome)),
      },
    ],
    [rows],
  );
  function exportJson() {
    const exported = {
      format: "Finanzplaner-Kategorien",
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: hierarchy.map(({ category, depth }) => ({
        name: category.name,
        art: category.isIncome ? "Einnahme" : "Ausgabe",
        parentCategory:
          rows.find((parent) => parent.id === category.parentId)?.name ?? null,
        level: depth,
        color: category.color,
        icon: category.icon,
        assignedTransactions: category.transactionCount,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `finanzplaner-kategorien-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Einstellungen · Auswertung"
        title="Kategorien"
        description="Passe Ausgaben- und Einnahmegruppen an deinen Haushalt an."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportJson} className="btn-secondary">
              <Download size={17} /> Als JSON exportieren
            </button>
            <button onClick={() => setEditing("new")} className="btn-primary">
              <Plus size={17} /> Kategorie anlegen
            </button>
          </div>
        }
      />
      {message && (
        <div
          role="status"
          className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm"
        >
          {message}
        </div>
      )}
      {sections.map((section) => (
        <section key={section.key} className="card overflow-hidden">
          <header className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4">
            <h2 className="text-lg font-bold">{section.title}</h2>
            <p className="mt-1 text-sm muted">{section.description} · {section.items.length} Kategorien</p>
          </header>
          <div className="divide-y divide-[var(--border)]">
          {section.items.map(({ category: row, depth }) => (
            <div key={row.id} className="flex items-center gap-4 p-4">
            <div className="flex-1" style={{ paddingLeft: `${depth * 24}px` }}>
              <div className="flex items-start gap-3">
                {depth > 0 && <span className="muted" aria-hidden="true">↳</span>}
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <div>
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs muted">
                    {row.isIncome ? "Einnahme" : "Ausgabe"}
                    {row.parentId
                      ? ` · Unterkategorie von ${rows.find((parent) => parent.id === row.parentId)?.name ?? "Unbekannt"}`
                      : ""}
                  </div>
                </div>
              </div>
            </div>
            <span
              className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold whitespace-nowrap"
              aria-label={`${row.transactionCount} zugeordnete Umsätze`}
            >
              {row.transactionCount} {row.transactionCount === 1 ? "Umsatz" : "Umsätze"}
            </span>
            <button
              onClick={() => setEditing(row)}
              className="btn-secondary min-h-9 px-3"
              aria-label={`${row.name} bearbeiten`}
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => remove(row)}
              className="btn-secondary min-h-9 px-3 text-[var(--danger)]"
              aria-label={`${row.name} löschen`}
            >
              <Trash2 size={15} />
            </button>
            </div>
          ))}
          {!section.items.length && (
            <p className="p-5 text-sm muted">Noch keine Kategorien in diesem Abschnitt.</p>
          )}
          </div>
        </section>
      ))}
      {current && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center">
          <form onSubmit={save} className="card w-full max-w-lg p-6">
            <div className="flex justify-between">
              <div className="flex items-center gap-2">
                <Tags className="text-[var(--primary)]" />
                <h2 className="font-bold">
                  {editing === "new"
                    ? "Neue Kategorie"
                    : "Kategorie bearbeiten"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-secondary min-h-9 px-3"
              >
                <X size={16} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Name
              <input
                name="name"
                required
                defaultValue={current.name}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
              />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Farbe
                <input
                  name="color"
                  type="color"
                  defaultValue={current.color}
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-1"
                />
              </label>
              <label className="text-sm font-semibold">
                Übergeordnete Kategorie
                <select
                  name="parentId"
                  defaultValue={current.parentId ?? ""}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
                >
                  <option value="">Keine</option>
                  {hierarchy
                    .filter(
                      ({ category }) =>
                        category.id !==
                        (editing !== "new" && editing ? editing.id : ""),
                    )
                    .map(({ category: row, depth }) => (
                      <option key={row.id} value={row.id}>
                        {"— ".repeat(depth)}{row.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--surface-soft)] p-4 text-sm font-semibold">
              <input
                name="isIncome"
                type="checkbox"
                defaultChecked={current.isIncome}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              Als Einnahmekategorie behandeln
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button className="btn-primary">Speichern</button>
            </div>
          </form>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
          <div className="card w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 id="delete-category-title" className="text-lg font-bold">„{deleting.category.name}“ löschen</h2><p className="mt-2 text-sm muted">Betroffen: {deleting.impact.transactions} direkte Umsätze, {deleting.impact.splits} Aufteilungen, {deleting.impact.amazonItems} Amazon-Artikel, {deleting.impact.rules} Lernregeln und {deleting.impact.childCategories} Unterkategorien.</p></div><button onClick={()=>setDeleting(null)} className="btn-secondary min-h-9 px-3" aria-label="Dialog schließen"><X size={16}/></button></div>
            <div className="mt-5 space-y-3"><label className="block rounded-xl bg-[var(--surface-soft)] p-4 text-sm"><input type="radio" checked={resolution==="move"} onChange={()=>setResolution("move")} className="mr-2 accent-[var(--primary)]"/><strong>In eine andere Kategorie verschieben</strong></label>{resolution==="move"&&<select value={replacementCategoryId} onChange={event=>setReplacementCategoryId(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"><option value="">Zielkategorie auswählen</option>{rows.filter(row=>row.id!==deleting.category.id&&row.isIncome===deleting.category.isIncome).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>}<label className="block rounded-xl bg-[var(--surface-soft)] p-4 text-sm"><input type="radio" checked={resolution==="uncategorize"} onChange={()=>setResolution("uncategorize")} className="mr-2 accent-[var(--primary)]"/><strong>Zuordnungen entfernen</strong><span className="mt-1 block muted">Betroffene Umsätze erscheinen anschließend wieder als „Nicht zugeordnet“.</span></label></div>
            <div className="mt-5 flex justify-end gap-3"><button onClick={()=>setDeleting(null)} className="btn-secondary">Abbrechen</button><button disabled={resolution==="move"&&!replacementCategoryId} onClick={()=>remove(deleting.category,true)} className="btn-primary bg-[var(--danger)]">Kategorie endgültig löschen</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
