"use client";

import Link from "next/link";

/**
 * Die Einwilligung direkt über dem Absende-Knopf.
 *
 * Sie steht bewusst hier und nicht als Kleingedrucktes in der Fußzeile: Der
 * Haken ist die letzte Handlung vor dem Veröffentlichen, also gehört er auch
 * dorthin. Und weil „Nutzungsbedingungen“ und „Datenschutzerklärung“ zwei
 * Wörter sind, die man erst versteht, wenn man sie gelesen hat, öffnen beide
 * Links in einem NEUEN TAB — sonst wäre der halb fertige Entwurf weg, und
 * niemand liest freiwillig etwas, das ihn seine Arbeit kostet.
 *
 * Darunter steht in einem Satz, was der Haken praktisch bedeutet. Wer
 * unterschreibt, soll wissen, was er unterschreibt — vor allem, wenn er
 * dreizehn ist.
 */

export interface ConsentCheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Erst nach einem Absende-Versuch die Meldung zeigen — vorher wäre sie eine Rüge auf Verdacht. */
  showError?: boolean;
  /** Was genau danach öffentlich sichtbar ist. Je nach Weg ein anderer Satz. */
  note: string;
  /** Eigene Kennung, damit Knopf und Meldung auf dasselbe Feld zeigen können. */
  id?: string;
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mb-0.5 inline-block h-3 w-3 shrink-0"
    >
      <path d="M9.5 2.5H13.5V6.5" />
      <path d="M13.5 2.5 8 8" />
      <path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

/** Ein Link auf eine Rechtsseite — immer im neuen Tab, immer erkennbar als solcher. */
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="consent-link font-semibold text-fox-deep"
    >
      {children}
      <ExternalIcon />
      <span className="sr-only"> (öffnet in einem neuen Tab)</span>
    </Link>
  );
}

export function ConsentCheck({
  checked,
  onChange,
  disabled = false,
  showError = false,
  note,
  id = "entry-consent",
}: ConsentCheckProps) {
  const missing = showError && !checked;
  const errorId = `${id}-fehler`;

  return (
    <div>
      <div className="choice-row rounded-xl border p-3.5" data-on={checked} data-missing={missing}>
        <label
          className={`flex min-h-11 items-start gap-3 ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <input
            id={id}
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-fox"
            checked={checked}
            disabled={disabled}
            aria-required="true"
            aria-invalid={missing}
            aria-describedby={missing ? errorId : undefined}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="min-w-0 text-sm leading-relaxed text-coal">
            Mit dem Erstellen stimme ich den{" "}
            <LegalLink href="/nutzungsbedingungen/">Nutzungsbedingungen</LegalLink> und der{" "}
            <LegalLink href="/datenschutz/">Datenschutzerklärung</LegalLink> zu.
          </span>
        </label>
      </div>

      <p className="hint mt-2 leading-relaxed">{note}</p>

      {/* Der Platz für die Meldung ist reserviert — sie schiebt den Knopf nicht weg. */}
      <div className="mt-1.5 min-h-4.5">
        {missing && (
          <p
            id={errorId}
            role="alert"
            className="note-enter text-xs font-semibold text-ink-bad"
          >
            Bitte setz den Haken — ohne Zustimmung dürfen wir deinen Beitrag nicht
            veröffentlichen.
          </p>
        )}
      </div>
    </div>
  );
}
