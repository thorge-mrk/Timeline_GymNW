"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  EditConflictNotice,
  type EditConflict,
} from "@/components/form/EditConflictNotice";
import { EntryForm } from "@/components/form/EntryForm";
import { LiveEntriesBadge } from "@/components/form/LiveEntriesBadge";
import { PageSpinner } from "@/components/form/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeEntries } from "@/hooks/useRealtimeEntries";
import { categoryById } from "@/lib/categories";
import { supabase } from "@/lib/supabase";
import type { Entry } from "@/lib/types";

/**
 * useSearchParams() erzwingt eine <Suspense>-Boundary — sonst schlägt der
 * statische Export (`output: "export"`) beim Prerendern fehl.
 */
export default function EintragenPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <EintragenView />
    </Suspense>
  );
}

/** Einheitlicher Seitenrahmen — das Formular selbst ist max-w-2xl. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {children}
    </div>
  );
}

type LoadState = "idle" | "loading" | "ready" | "missing" | "foreign" | "error";

/**
 * Das eigene Speichern kommt als Broadcast zurück. Ein Update am bearbeiteten
 * Eintrag innerhalb dieses Fensters gilt deshalb als eigenes Echo — sonst
 * meldete die Seite „jemand anderes hat geändert“ für die eigene Änderung.
 * Der Broadcast-Weg (Nachricht abwarten, Zeile RLS-geprüft nachladen) braucht
 * immer länger als die Antwort auf den eigenen Schreibvorgang.
 */
const SELF_ECHO_MS = 5000;

function EintragenView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  /**
   * Kommt man über „Auch meine Erinnerung dazuschreiben“ aus dem Detail-Fenster,
   * steht hier die id des Themas — dann wird kein neuer Eintrag angeboten,
   * sondern gleich die eigene Stimme dazu.
   */
  const voiceId = searchParams.get("ergaenzen");
  const { session, loading, isAdmin, isContributor, signOut } = useAuth();
  const userId = session?.user.id ?? null;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Zählt die „Neu laden“-Klicks — lädt den Eintrag und baut das Formular neu. */
  const [reloadNonce, setReloadNonce] = useState(0);

  /** Live: Einträge anderer Leute, die seit dem Öffnen dieser Seite dazukamen. */
  const [liveCount, setLiveCount] = useState(0);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  /** Live: Konflikt am gerade bearbeiteten Eintrag. */
  const [conflict, setConflict] = useState<EditConflict | null>(null);

  /** Zeitpunkt des letzten eigenen Schreibvorgangs — siehe SELF_ECHO_MS. */
  const lastSelfWriteRef = useRef(0);

  // Guard: ohne Session zurück zur Anmeldung.
  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [loading, session, router]);

  /*
   * Bearbeiten-Modus: vorhandenen Eintrag laden (auch erneut nach „Neu laden“).
   *
   * Das dürfen seit Neuestem BEIDE Rollen — ein Eintrag-Konto allerdings nur
   * für seine eigenen Beiträge (Policy entries_update_own_editor). Geprüft
   * wird das hier trotzdem, obwohl die Datenbank es ohnehin durchsetzt: Ein
   * Formular, das sich öffnen lässt und erst beim Speichern „keine
   * Berechtigung“ sagt, hat einem Menschen gerade seine Arbeit gekostet.
   */
  useEffect(() => {
    if (!editId || !userId) return;
    let active = true;
    setLoadState("loading");
    setLoadError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (!active) return;

      if (error) {
        setLoadError(
          `Der Eintrag konnte nicht geladen werden: ${error.message}`
        );
        setLoadState("error");
        return;
      }
      if (!data) {
        setLoadState("missing");
        return;
      }
      if (!isAdmin && data.created_by !== userId) {
        setLoadState("foreign");
        return;
      }
      setEntry({ ...data, category: categoryById(data.category).id });
      setLoadState("ready");
    })();

    return () => {
      active = false;
    };
  }, [editId, userId, isAdmin, reloadNonce]);

  /*
   * Das Thema, zu dem jemand dazuschreiben will. Anders als beim Bearbeiten
   * darf das JEDES Konto — deshalb hängt das Laden nicht an `isAdmin`.
   */
  const [voiceEntry, setVoiceEntry] = useState<Entry | null>(null);
  useEffect(() => {
    if (!voiceId || !userId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("entries")
        .select("*")
        .eq("id", voiceId)
        .maybeSingle();
      if (!active || !data) return;
      setVoiceEntry({ ...data, category: categoryById(data.category).id });
    })();
    return () => {
      active = false;
    };
  }, [voiceId, userId]);

  /*
   * Live-Aktualisierung. Der Zeitstrahl-State liegt auf der Startseite — hier
   * wird nichts gespiegelt: gezählt wird über onInserted, Konflikte am eigenen
   * Eintrag laufen über onUpdated (geändert) und onRemove (gelöscht).
   */
  const handleUpsert = useCallback(() => {}, []);

  const handleInserted = useCallback(
    (fresh: Entry) => {
      // Der eigene, gerade gespeicherte Eintrag zählt nicht mit.
      if (userId && fresh.created_by === userId) return;
      setLiveCount((current) => current + 1);
      setLiveTitle(fresh.title);
    },
    [userId]
  );

  const handleUpdated = useCallback(
    (fresh: Entry) => {
      if (!editId || fresh.id !== editId) return;
      if (Date.now() - lastSelfWriteRef.current < SELF_ECHO_MS) return;
      // „gelöscht“ ist endgültig und bleibt stehen.
      setConflict((current) => (current === "deleted" ? current : "changed"));
    },
    [editId]
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (!editId || id !== editId) return;
      setConflict("deleted");
    },
    [editId]
  );

  useRealtimeEntries({
    onUpsert: handleUpsert,
    onRemove: handleRemove,
    onInserted: handleInserted,
    onUpdated: handleUpdated,
  });

  /**
   * Merkt sich den eigenen Schreibvorgang, damit das Echo stumm bleibt.
   *
   * Nachgeladen werden muss hier nichts mehr: Die Liste der eigenen Beiträge
   * hängt jetzt am Stift in der Kopfzeile und liest bei jedem Öffnen frisch.
   */
  const handleSaved = useCallback((kind: "created" | "updated") => {
    lastSelfWriteRef.current = Date.now();
    if (kind === "updated") {
      setConflict((current) => (current === "changed" ? null : current));
    }
  }, []);

  /** Bewusster Klick auf „Neu laden“: fremde Fassung holen, Formular neu bauen. */
  const handleReload = useCallback(() => {
    setConflict(null);
    setReloadNonce((current) => current + 1);
  }, []);

  const dismissLive = useCallback(() => {
    setLiveCount(0);
    setLiveTitle(null);
  }, []);

  const dismissConflict = useCallback(() => setConflict(null), []);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (loading) return <PageSpinner label="Anmeldung wird geprüft …" />;
  if (!session) return <PageSpinner label="Weiter zur Anmeldung …" />;

  const email = session.user.email ?? "unbekannt";

  if (!isContributor) {
    return (
      <Shell>
        <div className="card animate-fade-up p-6 shadow-(--shadow-card-lg) sm:p-7">
          <h1 className="text-lg font-bold tracking-tight text-coal">
            Dieses Konto hat keine Schreibrechte für den Zeitstrahl.
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-coal-soft">
            Zum Eintragen braucht es ein Konto mit der Rolle „Eintrag“ oder
            „Admin“. Bitte beim Schul-Team melden.
          </p>
          <p className="hint mt-3">Angemeldet als {email}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              className="btn-primary min-h-12"
              onClick={() => void handleSignOut()}
            >
              Abmelden
            </button>
            <Link href="/" className="btn-ghost min-h-12">
              Zum Zeitstrahl
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (editId && (loadState === "idle" || loadState === "loading")) {
    return <PageSpinner label="Eintrag wird geladen …" />;
  }

  // Fremder Beitrag: Ändern darf man nur, was man selbst geschrieben hat.
  if (editId && loadState === "foreign") {
    return (
      <Shell>
        <div className="card animate-fade-up p-6 shadow-(--shadow-card-lg) sm:p-7">
          <h1 className="text-lg font-bold tracking-tight text-coal">
            Das ist nicht dein Eintrag.
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-coal-soft">
            Ändern kannst du deine eigenen Beiträge — sie stehen oben in der
            Kopfzeile hinter dem Stift. Fremde Erinnerungen bearbeitet nur das
            Schul-Team.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/eintragen/" className="btn-accent min-h-12">
              Zu meinen Einträgen
            </Link>
            <Link href="/" className="btn-ghost min-h-12">
              Zum Zeitstrahl
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (editId && (loadState === "missing" || loadState === "error")) {
    return (
      <Shell>
        <div className="card animate-fade-up p-6 shadow-(--shadow-card-lg) sm:p-7">
          <h1 className="text-lg font-bold tracking-tight text-coal">
            {loadState === "missing"
              ? "Diesen Eintrag gibt es nicht (mehr)."
              : "Der Eintrag konnte nicht geladen werden."}
          </h1>
          {loadError && (
            <p
              role="alert"
              className="mt-2 max-w-prose text-sm leading-relaxed text-coal-soft"
            >
              {loadError}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/eintragen/" className="btn-accent min-h-12">
              Neuen Eintrag anlegen
            </Link>
            <Link href="/" className="btn-ghost min-h-12">
              Zum Zeitstrahl
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const editing = Boolean(editId) && entry !== null;

  return (
    <Shell>
      {/*
        Der Seitenkopf trägt genau drei Dinge, in dieser Reihenfolge: wo man
        ist (Kicker), was man tut (Überschrift), und wer man dabei ist (die
        leise Zeile darunter). Das „Abmelden“ steht bewusst am Rand — es ist
        der Ausgang, nicht das Angebot.
      */}
      <header className="animate-fade-up mb-7 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.14em] text-coal-faint uppercase">
            Gedächtnis der Zeit
          </p>
          <h1 className="mt-1.5 text-2xl leading-tight font-bold tracking-tight text-coal sm:text-3xl">
            {editing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
          </h1>
          <p className="hint mt-2 leading-relaxed">
            Angemeldet als <span className="font-semibold">{email}</span>
            <span className="text-coal-faint"> · </span>
            Rolle: {isAdmin ? "Admin" : "Eintrag"}
          </p>
        </div>
        <button
          type="button"
          /* Bricht die Zeile um (schmaler Schirm), bleibt der Ausgang rechts
             außen stehen — dort, wo man ihn sucht, und nicht am Textanfang. */
          className="btn-ghost ml-auto min-h-11 shrink-0 text-xs"
          onClick={() => void handleSignOut()}
        >
          Abmelden
        </button>
      </header>

      {editing && conflict && (
        <EditConflictNotice
          kind={conflict}
          onReload={handleReload}
          onDismiss={dismissConflict}
        />
      )}

      <EntryForm
        key={
          editing && entry
            ? `${entry.id}:${reloadNonce}`
            : voiceEntry
              ? `stimme:${voiceEntry.id}`
              : "neu"
        }
        session={session}
        isAdmin={isAdmin}
        entry={editing ? entry : null}
        removed={editing && conflict === "deleted"}
        onSaved={handleSaved}
        voiceFor={editing ? null : voiceEntry}
      />

      <LiveEntriesBadge
        count={liveCount}
        latestTitle={liveTitle}
        onDismiss={dismissLive}
      />
    </Shell>
  );
}
