"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, Filter, Pencil, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AiCategorizationPanel } from "@/components/ai-categorization-panel";
import { TransactionEditor } from "@/components/transaction-editor";
type Row = {
  id: string;
  bookedOn: string;
  amount: string;
  currency: string;
  counterparty: string | null;
  purpose: string | null;
  categoryId: string | null;
  categoryName: string | null;
  accountName: string;
  note: string | null;
  tags: string[];
  excluded: boolean;
  specialType: "normal" | "refund" | "transfer";
  linkedTransactionId: string | null;
  splits: Array<{ categoryId: string; amount: string; note?: string | null }>;
};
type Category = { id: string; name: string; parentId: string | null };
function isUnassigned(row: Row) {
  return !row.categoryId && row.splits.length === 0;
}
export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const [importSummary, setImportSummary] = useState<{imported:number;locallyCategorized:number}|null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  async function refreshTransactions() {
    const tx = await fetch("/api/transactions").then((r) => r.json());
    if (Array.isArray(tx)) setRows(tx);
    else setError(tx.error);
  }
  useEffect(() => {
    const stored = sessionStorage.getItem("finanzplaner-last-import");
    if (stored) {
      try { setImportSummary(JSON.parse(stored)); } finally { sessionStorage.removeItem("finanzplaner-last-import"); }
    }
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([tx, cats]) => {
      if (Array.isArray(tx)) setRows(tx);
      else setError(tx.error);
      if (Array.isArray(cats)) setCategories(cats);
    });
  }, []);
  const unassignedCount = useMemo(
    () => rows.filter(isUnassigned).length,
    [rows],
  );
  const visible = useMemo(() => {
    const q = query.toLocaleLowerCase("de-DE");
    return rows.filter(
      (r) =>
        (!q ||
          `${r.counterparty} ${r.purpose} ${r.categoryName} ${r.note} ${r.tags.join(" ")}`
            .toLocaleLowerCase("de-DE")
            .includes(q)) &&
        (categoryFilter === "all" ||
          (categoryFilter === "none"
            ? isUnassigned(r)
            : r.categoryId === categoryFilter)) &&
        (typeFilter === "all" || r.specialType === typeFilter),
    );
  }, [rows, query, categoryFilter, typeFilter]);
  async function patch(body: Record<string, unknown>) {
    const response = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return false;
    }
    await refreshTransactions();
    return true;
  }
  async function setCategory(row: Row, categoryId: string) {
    await patch({ id: row.id, categoryId: categoryId || null });
  }
  async function applyLocalRules() {
    setLocalBusy(true);
    setLocalMessage("");
    setError("");
    try {
      const response = await fetch("/api/categorization/local", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Automatische Erkennung konnte nicht ausgeführt werden.");
      if (result.applied > 0) {
        setLocalMessage(`${result.applied} vorhandene Umsätze wurden anhand deiner bisherigen Zuordnungen automatisch kategorisiert.${result.learned ? ` Dabei wurden ${result.learned} ältere Händler-Zuordnungen nachträglich gelernt.` : ""}`);
      } else if (result.learned > 0) {
        setLocalMessage(`${result.learned} ältere Händler-Zuordnungen wurden nachträglich gelernt. Weitere passende offene Umsätze waren nicht vorhanden.`);
      } else if (result.rules === 0) {
        setLocalMessage("Noch keine gelernten Zuordnungen vorhanden. Ordne zuerst einen eindeutigen Händler manuell einer Kategorie zu.");
      } else {
        setLocalMessage("Alle Umsätze, die zu deinen bisherigen Zuordnungen passen, sind bereits kategorisiert.");
      }
      await refreshTransactions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automatische Erkennung konnte nicht ausgeführt werden.");
    } finally {
      setLocalBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Buchungen"
        title="Umsätze"
        description="Durchsuche, prüfe und kategorisiere deine Buchungen."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={applyLocalRules} disabled={localBusy}>
              <RefreshCw size={18} className={localBusy ? "animate-spin" : ""} />
              {localBusy ? "Erkennung läuft …" : "Gelernte Regeln anwenden"}
            </button>
            <Link href="/einstellungen/kategorien" className="btn-secondary">
              <SlidersHorizontal size={18} /> Kategorien verwalten
            </Link>
          </div>
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {importSummary && (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>{importSummary.imported} Umsätze importiert.</strong>{" "}
          {importSummary.locallyCategorized} davon wurden anhand deiner bisherigen Zuordnungen automatisch kategorisiert. Darunter erscheinen nur noch offene Umsätze für die KI oder manuelle Prüfung.
        </div>
      )}
      {localMessage && (
        <div role="status" className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          {localMessage}
        </div>
      )}
      <AiCategorizationPanel onApplied={refreshTransactions} />
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3">
            <Search size={18} className="muted" />
            <span className="sr-only">Umsätze suchen</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-0 bg-transparent outline-none"
              placeholder="Empfänger, Verwendungszweck, Notiz oder Schlagwort"
            />
          </label>
          <button
            type="button"
            onClick={() => setCategoryFilter((current) => current === "none" ? "all" : "none")}
            className={categoryFilter === "none" ? "btn-secondary border-red-200 bg-red-50 text-red-800" : "btn-secondary"}
            aria-pressed={categoryFilter === "none"}
          >
            <CircleAlert size={17} /> {unassignedCount} nicht zugeordnet
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className="btn-secondary"
            aria-expanded={filtersOpen}
          >
            <Filter size={17} /> Filter
            {categoryFilter !== "all" || typeFilter !== "all" ? " · aktiv" : ""}
          </button>
        </div>
        {filtersOpen && (
          <div className="grid gap-3 border-b border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Kategorie
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                <option value="all">Alle Kategorien</option>
                <option value="none">Nicht zugeordnet</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Buchungsart
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
              >
                <option value="all">Alle Buchungsarten</option>
                <option value="normal">Normale Buchungen</option>
                <option value="refund">Erstattungen</option>
                <option value="transfer">Umbuchungen</option>
              </select>
            </label>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead className="bg-[var(--surface-soft)] text-left muted">
              <tr>
                {["Datum", "Empfänger", "Konto", "Kategorie", "Betrag", ""].map(
                  (heading, index) => (
                    <th
                      key={`${heading}-${index}`}
                      className="px-5 py-3 font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--border)] ${isUnassigned(row) ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-[var(--surface-soft)]"} ${row.excluded ? "opacity-60" : ""}`}
                >
                  <td className="px-5 py-4">
                    {new Intl.DateTimeFormat("de-DE").format(
                      new Date(`${row.bookedOn}T00:00:00`),
                    )}
                  </td>
                  <td className="max-w-[260px] px-5 py-4">
                    <div className="truncate font-semibold">
                      {row.counterparty ?? "Unbekannt"}
                    </div>
                    <div className="truncate text-xs muted">{row.purpose}</div>
                    {row.tags.length > 0 && (
                      <div className="mt-1 text-xs text-[var(--primary)]">
                        {row.tags.map((tag) => `#${tag}`).join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 muted">{row.accountName}</td>
                  <td className="px-5 py-4">
                    {row.splits.length > 0 ? (
                      <span className="inline-flex min-h-9 items-center rounded-lg bg-[var(--surface-soft)] px-3 text-xs font-semibold">
                        Aufgeteilt ({row.splits.length})
                      </span>
                    ) : (
                      <select
                        value={row.categoryId ?? ""}
                        onChange={(e) => setCategory(row, e.target.value)}
                        className={`min-h-9 rounded-lg border px-2 ${isUnassigned(row) ? "border-red-200 bg-red-50 font-semibold text-red-800" : "border-[var(--border)] bg-[var(--surface)]"}`}
                      >
                        <option value="">Nicht zugeordnet</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-bold ${Number(row.amount) > 0 ? "text-[var(--primary)]" : ""}`}
                  >
                    {Number(row.amount).toLocaleString("de-DE", {
                      style: "currency",
                      currency: row.currency,
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSelected(row)}
                      className="btn-secondary min-h-9 px-3"
                      aria-label={`Details von ${row.counterparty ?? "Umsatz"} bearbeiten`}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center muted">
                    Keine passenden Umsätze vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <TransactionEditor
          row={selected}
          rows={rows}
          categories={categories}
          onClose={() => setSelected(null)}
          onSave={patch}
        />
      )}{" "}
    </div>
  );
}
