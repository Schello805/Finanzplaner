"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Search, Trash2, Upload } from "lucide-react";

import {
  CategorySelectOptions,
  type SelectCategory,
} from "@/components/category-select-options";
import { PageHeader } from "@/components/page-header";

type Rule = {
  id: string;
  pattern: string;
  categoryId: string;
  enabled: boolean;
};

type Item = {
  id: string;
  name: string;
  categoryId: string | null;
  rule: Rule | null;
  occurrences: number;
};

type Data = {
  rules: Rule[];
  categories: SelectCategory[];
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
};

export default function AmazonRulesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/amazon/rules?page=${page}&search=${encodeURIComponent(search)}`,
    );
    const body = await response.json();
    if (response.ok) setData(body);
    else setMessage(body.error);
  }, [page, search]);

  useEffect(() => {
    fetch(`/api/amazon/rules?page=${page}&search=${encodeURIComponent(search)}`)
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (response.ok) setData(body);
        else setMessage(body.error);
      });
  }, [page, search]);

  async function save(value: string, selectedCategoryId: string) {
    setBusy(true);
    const response = await fetch("/api/amazon/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: value, categoryId: selectedCategoryId }),
    });
    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error);
      return;
    }
    setMessage(
      `Regel gespeichert und auf ${body.matched} bestehende Artikel angewendet.`,
    );
    setPattern("");
    setCategoryId("");
    await load();
  }

  async function applyAllRules() {
    setBusy(true);
    const response = await fetch("/api/amazon/rules", { method: "PUT" });
    const body = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `${body.matched} bestehende Artikel anhand der Regeln geprüft und zugeordnet.`
        : body.error,
    );
    if (response.ok) await load();
  }

  async function remove(id: string) {
    if (!confirm("Regel löschen? Bereits zugeordnete Artikel bleiben unverändert.")) return;
    const response = await fetch("/api/amazon/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();
    if (!response.ok) setMessage(body.error);
    await load();
  }

  function exportJson() {
    if (!data) return;
    const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "finanzplaner-amazon-artikelregeln",
            version: 1,
            exportedAt: new Date().toISOString(),
            rules: data.rules.map((rule) => ({
              pattern: rule.pattern,
              category: categoryNames.get(rule.categoryId) ?? "",
            })),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finanzplaner-amazon-regeln-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("format" in parsed) ||
        parsed.format !== "finanzplaner-amazon-artikelregeln" ||
        !("rules" in parsed) ||
        !Array.isArray(parsed.rules)
      ) {
        throw new Error("Keine gültige Finanzplaner-Regeldatei.");
      }

      setBusy(true);
      const response = await fetch("/api/amazon/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: parsed.rules }),
      });
      const body = await response.json();
      setBusy(false);
      if (!response.ok) throw new Error(body.error);
      setMessage(
        `${body.imported} Regeln importiert und auf ${body.matched} Artikel angewendet` +
          (body.skipped
            ? ` · ${body.skipped} wegen fehlender oder mehrdeutiger Kategorien übersprungen.`
            : "."),
      );
      await load();
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    }
  }

  const expenseCategories = (data?.categories ?? []).filter(
    (category) => !category.isIncome,
  );
  const pageCount = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 100)),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Amazon · Zuordnungswissen"
        title="Amazon-Artikelregeln"
        description="Ordne bekannte Artikel dauerhaft zu und pflege das Wissen als exportierbare Regelmatrix."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={exportJson} disabled={!data}>
              <Download size={17} />
              JSON exportieren
            </button>
            <label className="btn-secondary cursor-pointer">
              <Upload size={17} />
              JSON importieren
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void importJson(event.target.files?.[0])}
              />
            </label>
          </div>
        }
      />

      {message ? (
        <div className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm" role="status">
          {message}
        </div>
      ) : null}

      <section className="card p-5">
        <h2 className="font-bold">Neue Artikelregel</h2>
        <p className="mt-2 text-sm muted">
          Ohne Stern gilt der exakte Artikelname. <code>Filament*</code> findet Namen,
          die mit „Filament“ beginnen; <code>*Filament*</code> findet das Wort an jeder
          Stelle. Exakte und längere Regeln haben Vorrang.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_280px_auto]">
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="z. B. *Filament*"
            className="min-h-11 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="min-h-11 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="">Kategorie auswählen</option>
            <CategorySelectOptions categories={expenseCategories} />
          </select>
          <button
            disabled={busy || pattern.trim().length < 2 || !categoryId}
            onClick={() => void save(pattern, categoryId)}
            className="btn-primary"
          >
            Regel speichern
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <header className="flex flex-col justify-between gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold">Gespeicherte Regeln</h2>
            <p className="mt-1 text-sm muted">
              {data?.rules.length ?? 0} Regeln · verschlüsselt gespeichert
            </p>
          </div>
          <button
            className="btn-secondary"
            disabled={busy || !data?.rules.length}
            onClick={() => void applyAllRules()}
          >
            <RefreshCw size={17} />
            Erneut anwenden
          </button>
        </header>
        {data?.rules.map((rule) => (
          <div
            key={rule.id}
            className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_280px_auto] md:items-center"
          >
            <code className="break-all font-semibold">{rule.pattern}</code>
            <select
              value={rule.categoryId}
              onChange={(event) => void save(rule.pattern, event.target.value)}
              className="min-h-11 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
            >
              <CategorySelectOptions categories={expenseCategories} />
            </select>
            <button
              onClick={() => void remove(rule.id)}
              className="btn-secondary text-red-700"
              aria-label={`Regel ${rule.pattern} löschen`}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {data && !data.rules.length ? (
          <p className="p-5 text-sm muted">Noch keine Artikelregeln gespeichert.</p>
        ) : null}
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-[var(--border)] p-5">
          <h2 className="font-bold">Artikelmatrix</h2>
          <p className="mt-1 text-sm muted">
            {data?.total ?? 0} unterschiedliche Artikel. Eine Änderung erzeugt eine
            exakte Regel und gilt rückwirkend sowie für künftige Importe.
          </p>
          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Artikel suchen"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </header>
        {data?.items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_280px] md:items-center"
          >
            <div>
              <div className="break-words font-semibold">{item.name}</div>
              <div className="mt-1 text-xs muted">
                {item.occurrences}× importiert · {item.rule ? `Regel: ${item.rule.pattern}` : "Noch keine Regel"}
              </div>
            </div>
            <select
              value={item.rule?.categoryId ?? item.categoryId ?? ""}
              onChange={(event) => void save(item.name, event.target.value)}
              className="min-h-11 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
            >
              <option value="">Kategorie auswählen</option>
              <CategorySelectOptions categories={expenseCategories} />
            </select>
          </div>
        ))}
        <footer className="flex items-center justify-between gap-3 p-4">
          <button
            className="btn-secondary"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Zurück
          </button>
          <span className="text-center text-sm muted">
            Seite {page} von {pageCount}
          </span>
          <button
            className="btn-secondary"
            disabled={!data || page * data.pageSize >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Weiter
          </button>
        </footer>
      </section>
    </div>
  );
}
