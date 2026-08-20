"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageSpinner } from "@/components/form/Spinner";
import { Turnstile, turnstileEnabled } from "@/components/form/Turnstile";
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
  if (m.includes("captcha")) {
    return "Die Sicherheitsprüfung ist fehlgeschlagen — bitte die Seite neu laden und es noch einmal versuchen.";
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
  /** Frischer Nachweis von Turnstile — leer, solange keiner vorliegt. */
  const [captcha, setCaptcha] = useState<string | null>(null);
  /** Widget kam nicht zustande — dann entscheidet der Server, nicht wir. */
  const [captchaAusgefallen, setCaptchaAusgefallen] = useState(false);

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

    /*
     * Fehlt der Nachweis, obwohl das Widget läuft, ist er einfach noch nicht
     * fertig — dann kurz warten statt in eine Serverabfuhr zu rennen.
     *
     * Ist das Widget dagegen gar nicht erst zustande gekommen, versuchen wir
     * es trotzdem: Vielleicht verlangt der Server gar kein Captcha. Diese
     * Entscheidung gehört ihm, nicht uns — sonst sperrt eine kaputte
     * Cloudflare-Verbindung die Schule aus ihrer eigenen Seite aus.
     */
    if (turnstileEnabled && !captcha && !captchaAusgefallen) {
      setError(
        "Die Sicherheitsprüfung läuft noch — bitte einen Moment warten und es dann noch einmal versuchen."
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await signIn(
        mail,
        password,
        captcha ?? undefined
      );
      if (authError) {
        setError(describeAuthError(authError.message));
        // Ein Nachweis gilt genau einen Versuch lang — das Widget legt von
        // selbst einen neuen nach.
        setCaptcha(null);
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
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
      <div className="w-full max-w-sm">
        {/* Das vollständige Rund-Signet der Schule — hier darf es groß sein. */}
        <div className="animate-fade-up mb-5 flex justify-center">
          {/* Kein next/image — die Seite wird statisch exportiert. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-gymnw.png"
            alt="Gymnasium Neu Wulmstorf"
            width={840}
            height={800}
            className="h-14 w-auto"
          />
        </div>

        <form
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
          style={{ animationDelay: "60ms" }}
          className="card animate-fade-up space-y-6 p-6 shadow-(--shadow-card-lg) sm:p-7"
        >
          <div>
            <h1 className="text-xl font-bold tracking-tight text-coal">
              Anmelden
            </h1>
            <p className="hint mt-1.5 leading-relaxed">
              Nur für Accounts der Schule — es gibt keine öffentliche
              Registrierung.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="animate-pop-in flex items-start gap-2.5 rounded-2xl border border-brick/25 bg-brick/8 p-3.5 text-sm font-semibold text-ink-bad"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                className="mt-px h-4.5 w-4.5 shrink-0"
              >
                <circle cx="10" cy="10" r="7.6" />
                <path d="M10 6.1v4.6" />
                <path d="M10 13.6h.01" />
              </svg>
              <span>{error}</span>
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

          {/*
            Der Anmelde-Schutz. Er sitzt bewusst direkt über dem Knopf: Wenn er
            sich doch einmal meldet, sieht man sofort, warum es gerade nicht
            weitergeht. Ohne hinterlegten Schlüssel zeichnet er gar nichts.
          */}
          <Turnstile
            onToken={setCaptcha}
            onUnavailable={() => setCaptchaAusgefallen(true)}
          />

          <button
            type="submit"
            className="btn-primary min-h-12 w-full text-base"
            disabled={busy}
          >
            {busy && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper [animation-duration:0.72s]"
              />
            )}
            {busy ? "Wird angemeldet …" : "Anmelden"}
          </button>
        </form>

        <p
          style={{ animationDelay: "120ms" }}
          className="animate-fade-up mt-5 text-center"
        >
          <Link href="/" className="hint link-quiet">
            ← Zurück zum Zeitstrahl
          </Link>
        </p>
      </div>
    </div>
  );
}
