"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { annualCategoryHistory, averageCategoryValues } from "@/features/analytics/calculations";

type HistoryCategory = {
  categoryId: string;
  categoryName: string;
  average: number;
  total: number;
  values: number[];
  color: string;
};

type HistoryResponse = {
  months: string[];
  categories: HistoryCategory[];
  error?: string;
};

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const compactEur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const shortMonth = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const longMonth = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);

export function CategoryHistoryChart({ accountId }: { accountId: string }) {
  const [history, setHistory] = useState<HistoryResponse>({ months: [], categories: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const suffix = accountId === "all" ? "" : `?accountId=${encodeURIComponent(accountId)}`;
    fetch(`/api/analytics/category-history${suffix}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as HistoryResponse;
        if (!response.ok || body.error) throw new Error(body.error ?? "Kategorieverlauf konnte nicht geladen werden.");
        setError("");
        setHistory(body);
        const preferred = body.categories.filter((category) => category.categoryId !== "uncategorized");
        const defaults = (preferred.length ? preferred : body.categories).slice(0, 5);
        setSelected(new Set(defaults.map((category) => category.categoryId)));
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Kategorieverlauf konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedAccountId(accountId);
      });
    return () => controller.abort();
  }, [accountId]);

  const categoryById = useMemo(
    () => new Map(history.categories.map((category) => [category.categoryId, category])),
    [history.categories],
  );
  const lineStartIndex = Math.max(0, history.months.length - 12);
  const lineMonths = history.months.slice(lineStartIndex);
  const linePoints = useMemo(
    () => lineMonths.map((month, relativeIndex) => {
      const point: Record<string, string | number> = { month };
      const index = lineStartIndex + relativeIndex;
      for (const category of history.categories) point[category.categoryId] = category.values[index] ?? 0;
      return point;
    }),
    [history, lineMonths, lineStartIndex],
  );
  const activeCategories = history.categories.filter((category) => selected.has(category.categoryId));
  const lineAverages = useMemo(
    () => new Map(history.categories.map((category) => [category.categoryId, averageCategoryValues(category.values.slice(lineStartIndex))])),
    [history.categories, lineStartIndex],
  );
  const annualPoints = useMemo(
    () => annualCategoryHistory(history.months, history.categories).map((point) => ({
      label: `${point.year} · ${point.monthCount} Mon.`,
      ...point.values,
    })),
    [history],
  );
  const loading = loadedAccountId !== accountId;
  const period = history.months.length
    ? `${longMonth.format(monthDate(history.months[0]))} bis ${longMonth.format(monthDate(history.months.at(-1)!))}`
    : "";

  function toggle(categoryId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="category-history-title">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 id="category-history-title" className="text-lg font-bold">Kategorien im Zeitverlauf</h2>
          <p className="mt-1 text-sm muted">
            Zwölf-Monats-Verlauf und Jahressummen nach Kategorie{period ? ` · Datenbasis ${period}` : ""}.
          </p>
        </div>
        {!!history.categories.length && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary !min-h-9 !px-3 text-sm"
              onClick={() => setSelected(new Set(history.categories.filter((category) => category.categoryId !== "uncategorized").slice(0, 5).map((category) => category.categoryId)))}
            >
              Top 5
            </button>
            <button
              type="button"
              className="btn-secondary !min-h-9 !px-3 text-sm"
              onClick={() => setSelected(new Set(history.categories.map((category) => category.categoryId)))}
            >
              Alle
            </button>
            <button type="button" className="btn-secondary !min-h-9 !px-3 text-sm" onClick={() => setSelected(new Set())}>
              Keine
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 flex h-[320px] items-center justify-center rounded-xl bg-[var(--surface-soft)] text-sm muted">Verlauf wird geladen …</div>
      ) : error ? (
        <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : !history.months.length ? (
        <div className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4 text-sm muted">Für einen Verlauf ist mindestens ein vollständig importierter Monat erforderlich.</div>
      ) : (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {history.categories.map((category) => (
              <label
                key={category.categoryId}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${selected.has(category.categoryId) ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(category.categoryId)}
                  onChange={() => toggle(category.categoryId)}
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{category.categoryName}</strong>
                  <span className="block text-xs muted">Ø {lineMonths.length} Mon. {eur.format(lineAverages.get(category.categoryId) ?? 0)}</span>
                </span>
              </label>
            ))}
          </div>

          {activeCategories.length ? (
            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(520px,1.6fr)]">
              <div>
                <h3 className="font-bold">Jahressummen</h3>
                <p className="mt-1 text-xs muted">Nur vollständige Monate; die Monatszahl kennzeichnet unvollständige Jahre.</p>
                <div className="mt-3 h-[300px] sm:h-[350px]">
                  <ResponsiveContainer>
                    <BarChart data={annualPoints} margin={{ top: 12, right: 8, left: 2, bottom: 8 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} />
                      <YAxis axisLine={false} tickLine={false} width={68} tickFormatter={(value) => compactEur.format(Number(value))} fontSize={12} />
                      <Tooltip
                        formatter={(value, name) => [eur.format(Number(value)), categoryById.get(String(name))?.categoryName ?? String(name)]}
                      />
                      {activeCategories.map((category) => (
                        <Bar key={category.categoryId} dataKey={category.categoryId} name={category.categoryId} stackId="categories" fill={category.color} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="font-bold">Letzte {lineMonths.length} vollständige Monate</h3>
                <p className="mt-1 text-xs muted">Gestrichelt: Monatsdurchschnitt der jeweiligen Kategorie in diesem Zeitraum.</p>
                <div className="mt-3 h-[300px] sm:h-[350px]">
                  <ResponsiveContainer>
                    <LineChart data={linePoints} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tickFormatter={(value) => shortMonth.format(monthDate(String(value)))}
                    fontSize={12}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={68}
                    tickFormatter={(value) => compactEur.format(Number(value))}
                    fontSize={12}
                  />
                  <Tooltip
                    labelFormatter={(value) => longMonth.format(monthDate(String(value)))}
                    formatter={(value, name) => [
                      eur.format(Number(value)),
                      categoryById.get(String(name))?.categoryName ?? String(name),
                    ]}
                  />
                  {activeCategories.map((category) => (lineAverages.get(category.categoryId) ?? 0) !== 0 && (
                    <ReferenceLine
                      key={`average-${category.categoryId}`}
                      y={lineAverages.get(category.categoryId)}
                      stroke={category.color}
                      strokeDasharray="5 5"
                      strokeOpacity={0.65}
                    />
                  ))}
                  {activeCategories.map((category) => (
                    <Line
                      key={category.categoryId}
                      type="monotone"
                      dataKey={category.categoryId}
                      name={category.categoryId}
                      stroke={category.color}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex h-[220px] items-center justify-center rounded-xl bg-[var(--surface-soft)] p-4 text-center text-sm muted">
              Wähle mindestens eine Kategorie aus, um ihren Verlauf anzuzeigen.
            </div>
          )}
        </>
      )}
    </section>
  );
}
