"use client";

import Link from "next/link";

/**
 * Die Einwilligung direkt über dem Absende-Knopf — als Satz, nicht als Hürde.
 *
 * Vorher stand hier ein Pflicht-Häkchen, und der Absende-Knopf blieb grau, bis
 * es gesetzt war. Am Aktionstag war genau das die letzte Stolperstelle: Der
 * Beitrag ist fertig getippt, der Knopf reagiert nicht, und der Grund steht
 * zwei Fingerbreit darüber in einem Kästchen, das auf dem Handy schon aus dem
 * Bild gescrollt ist.
 *
 * Deshalb jetzt die schlichtere Form, wie sie die Schule wollte: ein klarer
 * Satz über dem Knopf. Das Absenden IST die Zustimmung — genauso ausdrücklich,
 * nur ohne zusätzlichen Handgriff.
 *
 * Zwei Dinge bleiben unverändert wichtig:
 *   * „Nutzungsbedingungen“ und „Datenschutzerklärung“ sind Links und öffnen
 *     in einem NEUEN TAB. Sonst wäre der halb fertige Entwurf weg, und niemand
 *     liest freiwillig etwas, das ihn seine Arbeit kostet.
 *   * Darunter steht in einem Satz, was danach öffentlich sichtbar ist. Wer
 *     zustimmt, soll wissen, wozu — vor allem, wenn er dreizehn ist.
 */

export interface ConsentNoteProps {
  /** Was genau danach öffentlich sichtbar ist. Je nach Weg ein anderer Satz. */
  note: string;
  /**
   * Schlanke Fassung ohne Kasten — für den geführten Ablauf, wo jede
   * Bildschirmhöhe zählt. Derselbe Text, nur ohne Rahmen und Polster: Was
   * jemand vor dem Absenden zur Kenntnis nimmt, wird dadurch nicht weniger.
   */
  compact?: boolean;
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
function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
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

export function ConsentNote({ note, compact = false }: ConsentNoteProps) {
  return (
    <div
      className={
        compact
          ? "border-t border-paper-line pt-3"
          : "rounded-xl border border-paper-line bg-paper-sunk p-3.5"
      }
    >
      <p
        className={
          compact
            ? "text-[13px] leading-relaxed text-coal"
            : "text-sm leading-relaxed text-coal"
        }
      >
        Mit dem Eintragen stimmst du den{" "}
        <LegalLink href="/nutzungsbedingungen/">Nutzungsbedingungen</LegalLink>{" "}
        und der{" "}
        <LegalLink href="/datenschutz/">Datenschutzerklärung</LegalLink> zu.
      </p>
      <p className={compact ? "hint mt-1 leading-snug" : "hint mt-2 leading-relaxed"}>
        {note}
      </p>
    </div>
  );
}
