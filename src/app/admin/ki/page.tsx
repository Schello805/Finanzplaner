"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PasswordInput } from "@/components/password-input";

type Provider = { model?: string; configured?: boolean; inputPricePerMillion?: number; outputPricePerMillion?: number };
type Config = { defaultProvider: "openai" | "gemini"; openai: Provider; gemini: Provider };

export default function AdminAi() {
  const [config, setConfig] = useState<Config>({ defaultProvider: "openai", openai: { model: "gpt-5-mini" }, gemini: { model: "gemini-3.7-flash" } });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((response) => response.json()).then((body) => { if (body.ai) setConfig(body.ai); });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const provider = (id: "openai" | "gemini") => ({
      model: form.get(`${id}Model`), apiKey: form.get(`${id}Key`) || undefined,
      inputPricePerMillion: Number(form.get(`${id}InputPrice`) || 0), outputPricePerMillion: Number(form.get(`${id}OutputPrice`) || 0),
    });
    const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "ai", defaultProvider: form.get("defaultProvider"), openai: provider("openai"), gemini: provider("gemini") }) });
    const body = await response.json();
    setMessage(response.ok ? "Einstellungen gespeichert." : body.error);
  }

  return <form key={JSON.stringify(config)} onSubmit={submit} className="space-y-7">
    <PageHeader eyebrow="Admin · KI" title="KI-Anbieter" description="Schlüssel werden verschlüsselt gespeichert und nie wieder vollständig angezeigt." />
    <section className="grid gap-4 lg:grid-cols-2">
      {([["openai", "OpenAI", config.openai], ["gemini", "Google Gemini", config.gemini]] as const).map(([id, name, item]) => <article className="card p-5" key={id}>
        <div className="flex justify-between"><Bot className="text-[var(--primary)]" /><label className="text-sm font-semibold"><input type="radio" name="defaultProvider" value={id} defaultChecked={config.defaultProvider === id} className="mr-2 accent-[var(--primary)]" />Standard</label></div>
        <h2 className="mt-4 font-bold">{name}</h2>
        <label className="mt-4 block text-sm font-semibold">API-Schlüssel<PasswordInput name={`${id}Key`} autoComplete="off" placeholder={item.configured ? "Gespeichert – leer lassen zum Beibehalten" : "API-Schlüssel eingeben"} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label>
        <label className="mt-4 block text-sm font-semibold">Modell<input name={`${id}Model`} defaultValue={item.model} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label>
        <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Eingabe €/1 Mio. Tokens<input name={`${id}InputPrice`} type="number" min="0" step="0.0001" defaultValue={item.inputPricePerMillion ?? 0} className="mt-2 min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label><label className="text-xs font-semibold">Ausgabe €/1 Mio. Tokens<input name={`${id}OutputPrice`} type="number" min="0" step="0.0001" defaultValue={item.outputPricePerMillion ?? 0} className="mt-2 min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3" /></label></div>
        <div className="mt-4 flex items-center gap-2 text-sm muted"><CheckCircle2 size={16} />{item.configured ? "Schlüssel eingerichtet" : "Noch nicht eingerichtet"}</div>
        {id === "gemini" && <p className="mt-3 text-xs leading-5 muted">Dieser Schlüssel ermöglicht zusätzlich die natürliche deutsche Sprachausgabe mit Gemini TTS – auch wenn OpenAI als Standardanbieter ausgewählt ist.</p>}
      </article>)}
    </section>
    {message && <div role="status" className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{message}</div>}
    <button className="btn-primary">KI-Einstellungen speichern</button>
    <article className="card p-5"><h2 className="font-bold">Kosteninformationen</h2><p className="mt-2 text-sm muted">Die App berechnet Euro-Schätzungen ausschließlich aus den hier hinterlegten Preisen und den vom Anbieter gemeldeten Tokens. Trage deshalb die effektiven Europreise aus der aktuellen Anbieterabrechnung ein. Ohne Preisangaben zeigt die App bewusst keine vermeintlichen Kosten an.</p></article>
  </form>;
}
