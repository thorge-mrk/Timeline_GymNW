"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { categoryById, categoryPillStyle } from "@/lib/categories";
import { formatEntryDate } from "@/lib/dates";
import { richTextToPlain } from "@/lib/richText";
import { supabase } from "@/lib/supabase";
import type { Entry, VoiceInsert } from "@/lib/types";
import { ConsentNote } from "./ConsentNote";
import { SuccessCard } from "./SuccessCard";

/**
 * Ergänzen statt doppelt eintragen.
 *
 * „Berlinfahrt“ gibt es schon dreimal — und jedes Mal war es eine andere
 * Fahrt mit anderen Leuten. Statt einen vierten Punkt auf die Achse zu setzen,
 * hängt diese Maske eine weitere Stimme an das bestehende Thema. Auf dem
 * Zeitstrahl wächst der Eintrag dadurch sichtbar, und beim Öffnen liest man
 * alle Erinnerungen untereinander.
 *
 * Bewusst ohne Formatier-Werkzeuge: Wer hier landet, will einen Absatz
 * schreiben, kein Dokument setzen. Drei Felder, ein Knopf, fertig.
 *
 * ALLE drei Felder sind freiwillig — so will es die Schule. Das geht aber nur
 * bis zu einer Grenze: Eine Stimme, die weder Text noch Namen trägt, sagt gar
 * nichts. Sie wäre ein stummer Eintrag in der Liste, den niemand zuordnen
 * kann. Deshalb ist die Regel hier: mindestens EINES von beidem — entweder du
 * erzählst etwas, oder du stellst wenigstens deinen Namen dazu („ich war auch
 * dabei“). Beides zusammen ist natürlich am schönsten.
 *
 * Die Datenbankspalte `body` ist NOT NULL und braucht mindestens ein Zeichen.
 * Wer nur den Namen dalässt, bekommt deshalb den Standardsatz aus
 * `FALLBACK_BODY` — das ist genau das, was der Klick bedeutet, und es liest
 * sich unter dem Eintrag wie ein Satz und nicht wie ein Platzhalter.
 *
 * Was hier NICHT geht: fremde Texte ändern oder löschen. Das lässt die
 * Datenbank gar nicht erst zu (Policies entry_voices_update_admin /
 * entry_voices_delete_admin) — und es wäre auch falsch. Eine fremde Erinnerung
 * anzufassen ist etwas anderes, als die eigene danebenzustellen.
 */

const BODY_MAX = 2000;
const AUTHOR_MAX = 80;
const CLASS_MAX = 30;

/**
 * Der Satz, der gespeichert wird, wenn jemand nur seinen Namen dalässt.
 * Er behauptet nichts, was nicht stimmt — genau das sagt dieser Klick aus.
 */
const FALLBACK_BODY = "Ich war auch dabei.";

const NETWORK_MESSAGE =
  "Keine Verbindung zum Server — bitte die Internetverbindung prüfen und noch einmal versuchen.";

/** Datenbankfehler in einen Satz übersetzen, mit dem man etwas anfangen kann. */
function describeVoiceError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("row-level security") || m.includes("row level security")) {
    return "Keine Berechtigung für diese Aktion — ist das Konto richtig eingerichtet?";
  }
  if (m.includes("jwt") || m.includes("token is expired")) {
    return "Die Anmeldung ist abgelaufen — bitte neu anmelden und noch einmal speichern.";
  }
  if (m.includes("check constraint") || m.includes("violates")) {
    return `Der Text passt nicht zu den Vorgaben — er darf höchstens ${BODY_MAX} Zeichen lang sein.`;
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  ) {
    return NETWORK_MESSAGE;
  }
  return `Speichern fehlgeschlagen: ${raw}`;
}

function AlertIcon() {
  return (
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
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M11.5 5 6.5 10l5 5" />
    </svg>
  );
}

export interface VoiceFormProps {
  /** Der Eintrag, zu dem geschrieben wird. */
  entry: Entry;
  session: Session;
  /**
   * Dieselbe Regel wie im großen Formular („10/3“ → „10-3“). Sie wird
   * hereingereicht statt kopiert, damit beide Wege garantiert gleich
   * normalisieren — eine zweite Fassung würde irgendwann auseinanderlaufen.
   */
  normalizeClass: (value: string) => string;
  /** Zurück zum eigenen, noch unfertigen Eintrag — es geht nichts verloren. */
  onBack: () => void;
  /** Nach erfolgreichem Schreiben in die Datenbank. */
  onSaved?: () => void;
}

export function VoiceForm({
  entry,
  session,
  normalizeClass,
  onBack,
  onSaved,
}: VoiceFormProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [className, setClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saved, setSaved] = useState(false);

  const category = categoryById(entry.category);
  const dateText = formatEntryDate(entry);
  /* Leer ist erlaubt — leer UND ohne Namen nicht. Die Meldung hängt deshalb
     an beiden Feldern zusammen, nicht am Textfeld allein. */
  const nothingSaid =
    triedSubmit && body.trim().length === 0 && authorName.trim().length === 0;

  /** Ein Vorgeschmack auf das, was schon dasteht — damit man weiß, wo man ist. */
  const existing = richTextToPlain(entry.description).slice(0, 180);

  function resetForNext() {
    setBody("");
    setTriedSubmit(false);
    setError(null);
    setSaved(false);
    window.setTimeout(() => bodyRef.current?.focus(), 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setTriedSubmit(true);
    setError(null);

    const clean = body.trim();
    const cleanAuthor = authorName.trim();
    if (!clean && !cleanAuthor) {
      setError(
        "Schreib ein paar Worte — oder trag wenigstens deinen Namen ein. Sonst weiß niemand, wessen Erinnerung das ist."
      );
      bodyRef.current?.focus();
      return;
    }
    if (clean.length > BODY_MAX) {
      setError(
        `Der Text ist zu lang (höchstens ${BODY_MAX} Zeichen) — bitte etwas kürzen.`
      );
      return;
    }
    setSaving(true);
    try {
      // `created_by` MUSS die eigene uid sein: Die Insert-Policy prüft genau
      // das, sonst weist die Datenbank die Zeile ab.
      const payload: VoiceInsert = {
        entry_id: entry.id,
        // `body` ist in der Datenbank NOT NULL: Wer nur den Namen dalässt,
        // hinterlässt trotzdem einen lesbaren Satz.
        body: clean || FALLBACK_BODY,
        author_name: cleanAuthor || null,
        class_name: normalizeClass(className.trim()) || null,
        created_by: session.user.id,
      };
      const { error: dbErr } = await supabase
        .from("entry_voices")
        .insert(payload);
      if (dbErr) {
        setError(describeVoiceError(dbErr.message));
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaved(true);
      onSaved?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(describeVoiceError(raw));
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <SuccessCard
        title="Gespeichert!"
        text={`Deine Erinnerung steht jetzt bei „${entry.title}“ — danke fürs Erinnern.`}
      >
        <button
          type="button"
          className="btn-accent min-h-12 text-base"
          onClick={resetForNext}
        >
          Noch etwas dazu schreiben
        </button>
        <button type="button" className="btn-ghost min-h-12" onClick={onBack}>
          Eigenen Eintrag anlegen
        </button>
        <Link href="/" className="btn-primary min-h-12">
          Zum Zeitstrahl
        </Link>
      </SuccessCard>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="card animate-fade-up space-y-7 p-5 shadow-(--shadow-card-lg) sm:p-7"
    >
      {/* Kopfzeile: Woran schreibe ich hier eigentlich? */}
      <header className="border-b border-paper-line pb-5">
        <button
          type="button"
          className="btn-ghost -ml-1 min-h-11"
          disabled={saving}
          onClick={onBack}
        >
          <BackIcon />
          Doch einen eigenen Eintrag
        </button>

        <p className="mt-4 text-[11px] font-bold tracking-wider text-coal-faint uppercase">
          Du schreibst zu
        </p>
        <h2 className="mt-1 text-xl leading-tight font-bold tracking-tight text-coal">
          {entry.title}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="chip cursor-default"
            style={categoryPillStyle(category.id)}
          >
            {category.label}
          </span>
          <span className="hint">
            {dateText || "Ohne Datum — in der Erinnerungs-Wolke"}
          </span>
        </p>
        {existing && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-coal-soft">
            {existing}
            {existing.length >= 180 ? " …" : ""}
          </p>
        )}
        <p className="hint mt-3 leading-relaxed">
          Deine Erinnerung kommt als eigene Stimme dazu — nichts von dem, was
          hier schon steht, wird dabei verändert.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="animate-pop-in flex items-start gap-2.5 rounded-2xl border border-brick/25 bg-brick/8 p-4 text-sm font-semibold text-ink-bad"
        >
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className="label" htmlFor="voice-body">
            Deine Erinnerung
          </label>
          <span aria-hidden className="hint tabular-nums">
            noch {BODY_MAX - body.length}
          </span>
        </div>
        <textarea
          id="voice-body"
          ref={bodyRef}
          rows={6}
          className="input min-h-40 leading-relaxed"
          placeholder="Was hast du dabei erlebt? Woran erinnerst du dich besonders gern?"
          maxLength={BODY_MAX}
          value={body}
          disabled={saving}
          aria-invalid={nothingSaid}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-1.5 min-h-4.5">
          {nothingSaid ? (
            <p
              role="alert"
              className="note-enter text-xs font-semibold text-ink-bad"
            >
              Bitte schreib ein paar Worte — oder trag unten deinen Namen ein.
            </p>
          ) : (
            <p className="hint">
              Freiwillig — ein einziger Satz genügt. Wenn du nichts schreiben
              magst, reicht auch dein Name weiter unten.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="voice-author">
            Wer erinnert sich?
          </label>
          <input
            id="voice-author"
            type="text"
            className="input min-h-12"
            placeholder="z. B. Maria K., Abi 1998"
            maxLength={AUTHOR_MAX}
            autoComplete="name"
            value={authorName}
            disabled={saving}
            aria-invalid={nothingSaid}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <p className="hint mt-1.5">Optional — der Name steht an deiner Stimme.</p>
        </div>

        <div>
          <label className="label" htmlFor="voice-class">
            Klasse
          </label>
          <input
            id="voice-class"
            type="text"
            className="input min-h-12"
            placeholder="z. B. 8a oder Abi 1996"
            maxLength={CLASS_MAX}
            value={className}
            disabled={saving}
            onChange={(e) => setClassName(e.target.value)}
          />
          <p className="hint mt-1.5">Optional — hilft beim Filtern nach Jahrgängen.</p>
        </div>
      </div>

      <div className="space-y-5 border-t border-paper-line pt-6">
        {/* Dieselbe Regel wie im Eintrags-Formular: kein Häkchen mehr, sondern
            ein Satz über dem Knopf. Wer hier landet, will einen Absatz
            dazuschreiben — ein zusätzlicher Handgriff davor ist reine Hürde. */}
        <ConsentNote
          note={`Deine Erinnerung steht danach öffentlich bei „${entry.title}“ — für alle Besucherinnen und Besucher der Website sichtbar.`}
        />

        <div>
          <button
            type="submit"
            className="btn-accent min-h-12 w-full text-base sm:w-auto sm:px-10"
            disabled={saving}
          >
            {saving && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-navy/25 border-t-navy [animation-duration:0.72s]"
              />
            )}
            {saving ? "Wird gespeichert …" : "Erinnerung hinzufügen"}
          </button>
        </div>
      </div>
    </form>
  );
}
