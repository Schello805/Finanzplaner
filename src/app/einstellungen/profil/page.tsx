"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PasswordInput } from "@/components/password-input";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((response) => response.json())
      .then((body) => {
        setEmail(body.email ?? "");
        setDisplayName(body.displayName ?? "");
        setUsername(body.username ?? "");
      })
      .finally(() => setBusy(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, currentPassword: form.get("currentPassword") }),
    });
    const body = await response.json();
    setMessage(
      response.ok
        ? "E-Mail-Adresse gespeichert. Der Passwort-Reset ist jetzt einsatzbereit."
        : body.error,
    );
    if (response.ok) event.currentTarget.reset();
    setBusy(false);
  }

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/anmelden");
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Persönlich"
        title="Profil & Zugang"
        description="Verwalte deine E-Mail-Adresse, Sicherheit und persönliche Sitzung."
        action={
          <button type="button" onClick={logout} disabled={busy} className="btn-secondary">
            <LogOut size={17} />
            Abmelden
          </button>
        }
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="card p-6">
          <div className="flex items-center gap-3">
            <UserRound className="text-[var(--primary)]" />
            <div>
              <h2 className="font-bold">{displayName || "Benutzerprofil"}</h2>
              <p className="text-sm muted">Benutzername: {username || "–"}</p>
            </div>
          </div>
          <form onSubmit={submit} className="mt-6">
            <label className="block text-sm font-semibold">
              E-Mail-Adresse
              <div className="relative mt-2">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4"
                  placeholder="name@beispiel.de"
                />
              </div>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Aktuelles Passwort zur Bestätigung
              <PasswordInput
                name="currentPassword"
                required
                autoComplete="current-password"
                className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4"
              />
            </label>
            <p className="mt-2 text-xs leading-5 muted">
              Die Adresse wird für Passwort-Reset und sicherheitsrelevante Nachrichten ohne Finanzdaten verwendet.
            </p>
            {message && <div role="status" className="mt-4 rounded-xl bg-[var(--surface-soft)] p-4 text-sm">{message}</div>}
            <button disabled={busy} className="btn-primary mt-5">E-Mail-Adresse speichern</button>
          </form>
        </article>
        <article className="card p-6">
          <KeyRound className="text-[var(--primary)]" />
          <h2 className="mt-3 font-bold">Passwort und Zwei-Faktor-Anmeldung</h2>
          <p className="mt-2 text-sm leading-6 muted">
            Ändere dein Passwort oder schütze deinen Zugang zusätzlich mit einer Authenticator-App.
          </p>
          <Link href="/einstellungen/sicherheit" className="btn-primary mt-5">Sicherheit verwalten</Link>
        </article>
      </section>
    </div>
  );
}
