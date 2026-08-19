"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Voice } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import "./voiceList.css";

/**
 * Die Stimmen zu einem Thema — an zwei Orten dasselbe.
 *
 * Weitere Erinnerungen werden im Detail-Fenster des Zeitstrahls gezeigt UND im
 * Panel der Erinnerungs-Wolke. Bis hierher stand die Liste zweimal fast gleich
 * im Code; seit die Verwaltung einzelne Stimmen ändern und löschen darf, wäre
 * das zweimal dieselbe Mechanik gewesen — inklusive zweier Gelegenheiten,
 * beim nächsten Mal nur eine der beiden zu reparieren. Deshalb liegt beides
 * jetzt hier, und die Hüllen unterscheiden sich nur noch in dem, was sie
 * wirklich unterscheidet: `dense` setzt den engeren Satz für das schmale
 * Panel der Wolke.
 *
 * WER DARF WAS. Ändern und Löschen sieht nur, wer als Verwaltung angemeldet
 * ist. Das ist bloß die Oberfläche — durchgesetzt wird es in der Datenbank
 * (Policies `entry_voices_update_admin` / `entry_voices_delete_admin`).
 * Eintrag-Konten dürfen ausschließlich hinzufügen. Deren Schreibversuch
 * scheitert nicht laut, sondern STILL: Die Zeile ist für sie schlicht nicht
 * sichtbar, PostgREST meldet „nichts geändert“ statt eines Fehlers. Genau das
 * fangen `speichern()` und `loeschen()` unten ab — sonst behauptete die Seite,
 * etwas getan zu haben, was nie passiert ist.
 */

/*
 * Feldgrenzen aus 0015_entry_voices.sql. `body` ist NOT NULL und braucht
 * mindestens ein Zeichen — eine Stimme ohne Text gibt es nicht.
 */
const BODY_MAX = 2000;
const AUTHOR_MAX = 80;
const CLASS_MAX = 30;

/**
 * Der Satz, den das Ergänzen-Formular einsetzt, wenn jemand nur seinen Namen
 * dagelassen hat. Er steht hier, damit die Verwaltung ihn beim Aufräumen mit
 * einem Griff wieder herstellen kann, statt ihn abzutippen.
 */
const FALLBACK_BODY = "Ich war auch dabei.";

const NETZ_MELDUNG =
  "Keine Verbindung zum Server — bitte die Internetverbindung prüfen und noch einmal versuchen.";

/**
 * Fehlt das Recht, meldet die Datenbank keinen Fehler: Sie ändert einfach
 * nichts. Diese beiden Sätze sagen, was wirklich los ist.
 */
const KEIN_RECHT_AENDERN =
  "Nichts geändert — fremde Erinnerungen darf nur die Verwaltung bearbeiten. Bitte neu anmelden und es noch einmal versuchen.";
const KEIN_RECHT_LOESCHEN =
  "Die Erinnerung steht noch da — löschen darf nur die Verwaltung. Bitte neu anmelden und es noch einmal versuchen.";

/** Datenbankfehler in einen Satz übersetzen, mit dem man etwas anfangen kann. */
function beschreibeFehler(roh: string): string {
  const m = roh.toLowerCase();
  if (m.includes("row-level security") || m.includes("row level security")) {
    return "Keine Berechtigung für diese Aktion — bitte mit dem Verwaltungs-Konto anmelden.";
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
    return NETZ_MELDUNG;
  }
  return `Speichern fehlgeschlagen: ${roh}`;
}

/** „Maria K., Klasse 8a“ — was davon da ist, in dieser Reihenfolge. */
function herkunft(voice: Voice): string {
  return [
    voice.author_name?.trim() || null,
    voice.class_name?.trim() ? `Klasse ${voice.class_name.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Welche Stimme ist gerade offen — und wozu? */
type OffenerZustand = { id: string; art: "bearbeiten" | "loeschen" };

interface VoiceListProps {
  /** Alle Stimmen zu diesem Thema. Wird hier noch einmal selbst sortiert. */
  voices: Voice[];
  /** Kategoriefarbe des Themas — der Strich links an jeder Stimme. */
  accent: string;
  /** Engerer Satz für das schmale Panel der Erinnerungs-Wolke. */
  dense?: boolean;
  /**
   * Überschrift über der Liste. Sie bekommt die tatsächlich sichtbare Anzahl
   * herein — nur so bleibt „3 Stimmen“ auch dann richtig, wenn die Verwaltung
   * eben eine gelöscht hat und die Seite noch nicht nachgeladen hat. Den
   * Wortlaut bestimmt die Hülle: im Fenster steht etwas anderes als im Panel.
   */
  heading?: (count: number) => ReactNode;
  /**
   * Nach erfolgreichem Ändern oder Löschen. Die Seite lädt die Stimmen dieses
   * Themas dann neu (`refetchEntry`), damit auch die Zähler am Zeitstrahl und
   * an der Wolke wieder stimmen. Fehlt die Funktion, bleibt die Liste hier
   * trotzdem richtig — sie merkt sich, was sie geschrieben hat.
   */
  onVoicesChanged?: (entryId: string) => void;
}

/**
 * Liste der weiteren Stimmen — mit stillen Griffen für die Verwaltung.
 *
 * Jede Stimme sieht aus wie ein Zitat: farbiger Strich in der Kategoriefarbe,
 * der Text, darunter leise, wer das erzählt hat. Kein Zeitstempel, kein
 * Bildchen, kein Antworten — es ist eine Erinnerung und keine Kommentarspalte.
 *
 * Für Admin-Konten kommt in der Namenszeile rechts „Bearbeiten · Löschen“
 * dazu, in genau deren Größe und Blässe (siehe voiceList.css). Beides
 * passiert AN ORT UND STELLE: Bearbeiten verwandelt die Stimme in ein kleines
 * Formular, Löschen klappt die Rückfrage unter dem Text auf. Für ein paar
 * Wörter ein weiteres Fenster aufzureißen wäre zu viel Apparat — und ein
 * `window.confirm()` gehört einer anderen Website.
 */
export default function VoiceList({
  voices,
  accent,
  dense = false,
  heading,
  onVoicesChanged,
}: VoiceListProps) {
  const { isAdmin } = useAuth();
  const feldId = useId();

  const [offen, setOffen] = useState<OffenerZustand | null>(null);
  const [entwurf, setEntwurf] = useState({ body: "", autor: "", klasse: "" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState("");

  /*
   * Was diese Liste selbst geschrieben hat.
   *
   * Nach dem Speichern soll sofort der neue Text dastehen — auch dann, wenn
   * die Seite die Stimmen gar nicht nachlädt (Live-Übertragung aus, kein
   * `onVoicesChanged` angeschlossen). Gewinnen darf die eigene Fassung aber
   * nur so lange, bis von oben eine mindestens genauso frische kommt; sonst
   * überschriebe der eigene Stand die Änderung einer zweiten Verwaltung.
   */
  const [selbstGeaendert, setSelbstGeaendert] = useState<Record<string, Voice>>(
    {}
  );
  /** Selbst gelöscht — bleibt verschwunden, bis auch von oben nichts mehr kommt. */
  const [selbstGeloescht, setSelbstGeloescht] = useState<string[]>([]);

  const listeRef = useRef<HTMLUListElement>(null);
  /** Die gerade offene Karte — sie wird nach dem Öffnen sichtbar gerückt. */
  const karteRef = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const behaltenRef = useRef<HTMLButtonElement>(null);
  /** Der Knopf, der den Zustand geöffnet hat — dorthin geht der Fokus zurück. */
  const ausloeserRef = useRef<HTMLElement | null>(null);
  const hinweisTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(hinweisTimer.current), []);

  /*
   * Chronologisch, älteste zuerst: Die Stimmen sollen sich lesen wie ein
   * Gespräch, das gewachsen ist. Bei gleicher Sekunde entscheidet die id,
   * damit zwei Stimmen aus derselben Minute nicht bei jedem Laden die Plätze
   * tauschen.
   */
  const sichtbar = useMemo(() => {
    const liste = voices
      .filter((voice) => !selbstGeloescht.includes(voice.id))
      .map((voice) => {
        const eigen = selbstGeaendert[voice.id];
        return eigen && eigen.updated_at > voice.updated_at ? eigen : voice;
      });
    return liste.sort((a, b) => {
      const nachZeit = a.created_at.localeCompare(b.created_at);
      return nachZeit !== 0 ? nachZeit : a.id.localeCompare(b.id);
    });
  }, [voices, selbstGeaendert, selbstGeloescht]);

  /** Kurze Rückmeldung, die von selbst wieder geht. */
  const melde = useCallback((text: string) => {
    setHinweis(text);
    window.clearTimeout(hinweisTimer.current);
    hinweisTimer.current = window.setTimeout(() => setHinweis(""), 5000);
  }, []);

  /** Zumachen ohne zu speichern — und den Fokus dorthin zurück, wo er herkam. */
  const schliessen = useCallback(() => {
    setOffen(null);
    setFehler(null);
    const zurueck = ausloeserRef.current;
    ausloeserRef.current = null;
    if (zurueck?.isConnected) zurueck.focus();
  }, []);

  function oeffneBearbeiten(voice: Voice, ausloeser: HTMLElement) {
    ausloeserRef.current = ausloeser;
    setFehler(null);
    setEntwurf({
      body: voice.body,
      autor: voice.author_name ?? "",
      klasse: voice.class_name ?? "",
    });
    setOffen({ id: voice.id, art: "bearbeiten" });
  }

  function oeffneLoeschen(voice: Voice, ausloeser: HTMLElement) {
    ausloeserRef.current = ausloeser;
    setFehler(null);
    setOffen({ id: voice.id, art: "loeschen" });
  }

  /* Der Fokus wandert dorthin, wo weitergearbeitet wird: ins Textfeld — bei
     der Rückfrage auf „Behalten“, also auf die harmlose Antwort. */
  useEffect(() => {
    if (!offen) return;
    /*
     * `preventScroll`, damit nicht das Textfeld allein an den Rand springt und
     * die Erinnerung, um die es geht, dabei aus dem Bild schiebt. Sichtbar
     * gerückt wird stattdessen die ganze Karte — im schmalen Panel der Wolke
     * ist das der Unterschied zwischen „ich sehe, was ich ändere“ und einem
     * Textfeld im Nirgendwo.
     */
    if (offen.art === "bearbeiten") {
      textRef.current?.focus({ preventScroll: true });
    } else {
      behaltenRef.current?.focus({ preventScroll: true });
    }
    karteRef.current?.scrollIntoView({ block: "nearest" });
  }, [offen]);

  /*
   * ESCAPE GEHÖRT DER INNERSTEN EBENE.
   *
   * Wer gerade eine Stimme bearbeitet, will mit Escape genau dieses Formular
   * loswerden — nicht das ganze Fenster und schon gar nicht die Wolke. Beide
   * Hüllen horchen aber selbst mit: das Detail-Fenster am Dokument, die
   * Vollansicht der Wolke sogar in der Capture-Phase. Ein Handler am Element
   * käme also zu spät. Der einzige Platz davor ist `window` — auch dort in
   * der Capture-Phase, und nur so lange, wie hier wirklich etwas offen ist.
   *
   * Während geschrieben wird, tut die Taste gar nichts: Ein Fenster, das
   * mitten im Speichern zufällt, ist schlimmer als eine Taste ohne Wirkung.
   */
  useEffect(() => {
    if (!offen) return;
    const aufEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (busy) return;
      schliessen();
    };
    window.addEventListener("keydown", aufEscape, true);
    return () => window.removeEventListener("keydown", aufEscape, true);
  }, [offen, busy, schliessen]);

  async function speichern(voice: Voice) {
    if (busy) return;

    const body = entwurf.body.trim();
    const autor = entwurf.autor.trim();
    const klasse = entwurf.klasse.trim();

    if (!body) {
      setFehler(
        "Ohne Text kann die Stimme nicht bleiben — ein Satz genügt. Wer nur dabei war, schreibt einfach den Standardsatz."
      );
      textRef.current?.focus();
      return;
    }
    if (body.length > BODY_MAX) {
      setFehler(
        `Der Text ist zu lang (höchstens ${BODY_MAX} Zeichen) — bitte etwas kürzen.`
      );
      return;
    }

    // Nichts verändert? Dann auch nicht schreiben — das spart der Datenbank
    // die Zeile und allen anderen einen unnötigen Live-Hinweis.
    if (
      body === voice.body &&
      (autor || null) === (voice.author_name ?? null) &&
      (klasse || null) === (voice.class_name ?? null)
    ) {
      schliessen();
      return;
    }

    setBusy(true);
    setFehler(null);
    try {
      const { data, error } = await supabase
        .from("entry_voices")
        .update({
          body,
          author_name: autor || null,
          class_name: klasse || null,
        })
        .eq("id", voice.id)
        .select();

      if (error) {
        setFehler(beschreibeFehler(error.message));
        setBusy(false);
        return;
      }
      // Kein Fehler, aber auch keine Zeile: Die Policy hat still abgelehnt.
      const frisch = data?.[0];
      if (!frisch) {
        setFehler(KEIN_RECHT_AENDERN);
        setBusy(false);
        return;
      }

      setSelbstGeaendert((current) => ({ ...current, [voice.id]: frisch }));
      setBusy(false);
      setOffen(null);
      const zurueck = ausloeserRef.current;
      ausloeserRef.current = null;
      if (zurueck?.isConnected) zurueck.focus();
      melde("Die Erinnerung wurde geändert.");
      onVoicesChanged?.(voice.entry_id);
    } catch (cause) {
      setFehler(
        beschreibeFehler(cause instanceof Error ? cause.message : String(cause))
      );
      setBusy(false);
    }
  }

  async function loeschen(voice: Voice) {
    if (busy) return;

    setBusy(true);
    setFehler(null);
    try {
      const { data, error } = await supabase
        .from("entry_voices")
        .delete()
        .eq("id", voice.id)
        .select("id");

      if (error) {
        setFehler(beschreibeFehler(error.message));
        setBusy(false);
        return;
      }
      if (!data?.length) {
        setFehler(KEIN_RECHT_LOESCHEN);
        setBusy(false);
        return;
      }

      setSelbstGeloescht((current) => [...current, voice.id]);
      setBusy(false);
      setOffen(null);
      ausloeserRef.current = null;
      // Der Knopf, der den Fokus hatte, ist mit der Stimme verschwunden.
      // Also übernimmt ihn die Liste selbst — sonst fiele er auf `body`.
      listeRef.current?.focus();
      melde("Die Erinnerung wurde gelöscht.");
      onVoicesChanged?.(voice.entry_id);
    } catch (cause) {
      setFehler(
        beschreibeFehler(cause instanceof Error ? cause.message : String(cause))
      );
      setBusy(false);
    }
  }

  if (sichtbar.length === 0) return null;

  const textKlasse = dense
    ? "text-[14px] leading-relaxed whitespace-pre-line text-coal"
    : "text-[15px] leading-relaxed whitespace-pre-line text-coal";
  const nameKlasse = dense
    ? "text-[11px] text-coal-faint"
    : "text-xs text-coal-faint";

  return (
    <>
      {heading?.(sichtbar.length)}

      <ul
        ref={listeRef}
        tabIndex={-1}
        className="flex flex-col gap-2.5 outline-none"
      >
        {sichtbar.map((voice) => {
          const von = herkunft(voice);
          const bearbeitet = offen?.id === voice.id && offen.art === "bearbeiten";
          const gefragt = offen?.id === voice.id && offen.art === "loeschen";
          const id = `${feldId}-${voice.id}`;

          return (
            <li
              key={voice.id}
              ref={bearbeitet || gefragt ? karteRef : undefined}
              className={`relative rounded-xl py-3 pr-3.5 pl-4 ${
                bearbeitet
                  ? "vl-open vl-open--edit"
                  : gefragt
                    ? "vl-open"
                    : "bg-paper-sunk"
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
                style={{ backgroundColor: accent, opacity: 0.5 }}
              />

              {bearbeitet ? (
                /* ------------------------------------------ Bearbeiten */
                <div className="vl-unfold">
                  <div className="flex items-baseline justify-between gap-3">
                    <label
                      className="label mb-0 text-[13px]"
                      htmlFor={`${id}-text`}
                    >
                      Erinnerung
                    </label>
                    <span aria-hidden="true" className="hint tabular-nums">
                      noch {BODY_MAX - entwurf.body.length}
                    </span>
                  </div>
                  <textarea
                    id={`${id}-text`}
                    ref={textRef}
                    rows={dense ? 3 : 5}
                    className="input mt-1.5 leading-relaxed"
                    maxLength={BODY_MAX}
                    value={entwurf.body}
                    disabled={busy}
                    onChange={(event) =>
                      setEntwurf((c) => ({ ...c, body: event.target.value }))
                    }
                  />

                  <div
                    className={`mt-2.5 grid gap-2.5 ${dense ? "" : "sm:grid-cols-2"}`}
                  >
                    <div>
                      <label
                        className="label mb-1 text-[13px]"
                        htmlFor={`${id}-name`}
                      >
                        Wer erinnert sich?
                      </label>
                      <input
                        id={`${id}-name`}
                        type="text"
                        className="input min-h-11"
                        placeholder="z. B. Maria K."
                        maxLength={AUTHOR_MAX}
                        value={entwurf.autor}
                        disabled={busy}
                        onChange={(event) =>
                          setEntwurf((c) => ({ ...c, autor: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="label mb-1 text-[13px]"
                        htmlFor={`${id}-klasse`}
                      >
                        Klasse
                      </label>
                      <input
                        id={`${id}-klasse`}
                        type="text"
                        className="input min-h-11"
                        placeholder="z. B. 8a oder Abi 1996"
                        maxLength={CLASS_MAX}
                        value={entwurf.klasse}
                        disabled={busy}
                        onChange={(event) =>
                          setEntwurf((c) => ({
                            ...c,
                            klasse: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-accent min-h-11"
                      disabled={busy || !entwurf.body.trim()}
                      onClick={() => void speichern(voice)}
                    >
                      {busy ? "Wird gespeichert …" : "Speichern"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-11"
                      disabled={busy}
                      onClick={schliessen}
                    >
                      Abbrechen
                    </button>
                  </div>

                  {/* Ein grauer Knopf ohne Grund ist eine Sackgasse — der
                      Grund steht dabei, samt Weg heraus. */}
                  {!entwurf.body.trim() && (
                    <p className="hint mt-2 leading-relaxed">
                      Eine Stimme ohne Text gibt es nicht — ein Satz genügt.{" "}
                      <button
                        type="button"
                        className="vl-act font-semibold underline underline-offset-2"
                        disabled={busy}
                        onClick={() =>
                          setEntwurf((c) => ({ ...c, body: FALLBACK_BODY }))
                        }
                      >
                        „{FALLBACK_BODY}“ einsetzen
                      </button>
                    </p>
                  )}

                  {fehler && (
                    <p
                      role="alert"
                      className="mt-2 text-xs leading-relaxed font-semibold text-brick"
                    >
                      {fehler}
                    </p>
                  )}
                </div>
              ) : (
                /* --------------------------------------- Ruhe und Rückfrage */
                <>
                  <p className={textKlasse}>{voice.body}</p>

                  <div
                    className={`flex items-end justify-between gap-3 ${
                      von ? "mt-2" : "mt-1.5"
                    }`}
                  >
                    {von ? (
                      <p className={`${nameKlasse} min-w-0`}>— {von}</p>
                    ) : (
                      <span />
                    )}

                    {/* Die beiden leisen Wörter — nur für die Verwaltung und
                        nur, solange keine Rückfrage offen ist. */}
                    {isAdmin && !gefragt && (
                      <span
                        className={`flex shrink-0 items-center gap-0.5 ${nameKlasse}`}
                      >
                        <button
                          type="button"
                          className="vl-act"
                          disabled={busy}
                          aria-label={
                            von
                              ? `Erinnerung von ${von} bearbeiten`
                              : "Diese Erinnerung bearbeiten"
                          }
                          onClick={(event) =>
                            oeffneBearbeiten(voice, event.currentTarget)
                          }
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="vl-act vl-act--danger"
                          disabled={busy}
                          aria-label={
                            von
                              ? `Erinnerung von ${von} löschen`
                              : "Diese Erinnerung löschen"
                          }
                          onClick={(event) =>
                            oeffneLoeschen(voice, event.currentTarget)
                          }
                        >
                          Löschen
                        </button>
                      </span>
                    )}
                  </div>

                  {/* ------------------------------------------- Rückfrage */}
                  {/*
                    Ruhig gefragt, nicht gewarnt: Papier statt rotem Kasten,
                    und der Text, um den es geht, bleibt oben stehen — man
                    sieht also genau, was verschwindet. Kräftig ist nur die
                    Antwort, die wirklich löscht.
                  */}
                  {gefragt && (
                    <div
                      role="group"
                      aria-labelledby={`${id}-frage`}
                      className="vl-unfold mt-3 border-t border-paper-line pt-3"
                    >
                      <p
                        id={`${id}-frage`}
                        className={`font-semibold text-coal ${
                          dense ? "text-[13px]" : "text-sm"
                        }`}
                      >
                        Diese Erinnerung löschen?
                      </p>
                      <p className="hint mt-1 leading-relaxed">
                        {von
                          ? `Der Text von ${von} ist danach weg und lässt sich nicht zurückholen.`
                          : "Der Text ist danach weg und lässt sich nicht zurückholen."}{" "}
                        Das Thema selbst und alle anderen Stimmen bleiben
                        stehen.
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          ref={behaltenRef}
                          className="btn-ghost min-h-11"
                          disabled={busy}
                          onClick={schliessen}
                        >
                          Behalten
                        </button>
                        <button
                          type="button"
                          className="btn-danger min-h-11"
                          disabled={busy}
                          onClick={() => void loeschen(voice)}
                        >
                          {busy ? "Wird gelöscht …" : "Endgültig löschen"}
                        </button>
                      </div>

                      {fehler && (
                        <p
                          role="alert"
                          className="mt-2 text-xs leading-relaxed font-semibold text-brick"
                        >
                          {fehler}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/*
        Steht bei der Verwaltung immer im Dokument, auch leer: Ein Bereich, der
        erst mit seinem Text erscheint, wird von Vorleseprogrammen nicht mehr
        angesagt. Wer ohnehin nichts ändern kann, braucht ihn gar nicht.
      */}
      {isAdmin && (
        <p role="status" className={`hint ${hinweis ? "mt-2" : ""}`}>
          {hinweis}
        </p>
      )}
    </>
  );
}
