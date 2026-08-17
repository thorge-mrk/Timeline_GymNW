"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageSpinner } from "@/components/form/Spinner";
import { useAuth } from "@/hooks/useAuth";

/** Supabase antwortet auf Englisch — hier die deutschen Entsprechungen. */
function describeAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid_credentials") ||
    m.includes("invalid grant")
  ) {
    return "E-Mail oder Passwort ist falsch.";
  }
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_request_rate_limit") ||
    m.includes("request this after")
  ) {
    return "Zu viele Versuche — bitte kurz warten.";
  }
  if (m.includes("email not confirmed")) {
    return "Diese E-Mail-Adresse ist noch nicht bestätigt — bitte beim Admin melden.";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  ) {
    return "Keine Verbindung zum Server — bitte die Internetverbindung prüfen.";
  }
  return `Anmeldung fehlgeschlagen: ${raw}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bereits angemeldet? Dann direkt zum Formular.
  useEffect(() => {
    if (!loading && session) router.replace("/eintragen/");
  }, [loading, session, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const mail = email.trim();
    if (!mail || !password) {
      setError("Bitte E-Mail-Adresse und Passwort eingeben.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await signIn(mail, password);
      if (authError) {
        setError(describeAuthError(authError.message));
        setBusy(false);
        return;
      }
      // busy bleibt gesetzt — die Weiterleitung folgt sofort.
      router.replace("/eintragen/");
    } catch (err) {
      setError(
        describeAuthError(err instanceof Error ? err.message : String(err))
      );
      setBusy(false);
    }
  }

  if (loading || session) {
    return <PageSpinner label="Einen Moment …" />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">
        <form
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
          className="card animate-fade-up space-y-5 p-6"
        >
          <div>
            <h1 className="text-xl font-bold text-coal">Anmelden</h1>
            <p className="hint mt-1.5">
              Nur für Accounts der Schule — es gibt keine öffentliche
              Registrierung.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-[#b3402a]/40 bg-[#fbeeea] p-3.5 text-sm font-semibold text-[#8f3423]"
            >
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="login-email">
              E-Mail
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              className="input min-h-12"
              placeholder="name@gym-nw.de"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="login-password">
              Passwort
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              className="input min-h-12"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary min-h-12 w-full text-base"
            disabled={busy}
          >
            {busy && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper"
              />
            )}
            {busy ? "Anmelden …" : "Anmelden"}
          </button>
        </form>

        <p className="mt-4 text-center">
          <Link href="/" className="hint hover:text-coal">
            ← Zurück zum Zeitstrahl
          </Link>
        </p>
      </div>
    </div>
  );
}
