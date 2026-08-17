"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EntryForm } from "@/components/form/EntryForm";
import { PageSpinner } from "@/components/form/Spinner";
import { useAuth } from "@/hooks/useAuth";
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

type LoadState = "idle" | "loading" | "ready" | "missing" | "error";

function EintragenView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { session, loading, isAdmin, isContributor, signOut } = useAuth();
  const userId = session?.user.id ?? null;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Guard: ohne Session zurück zur Anmeldung.
  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [loading, session, router]);

  // Bearbeiten-Modus: vorhandenen Eintrag laden.
  useEffect(() => {
    if (!editId || !userId || !isAdmin) return;
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
      setEntry({ ...data, category: categoryById(data.category).id });
      setLoadState("ready");
    })();

    return () => {
      active = false;
    };
  }, [editId, userId, isAdmin]);

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
        <div className="card animate-fade-up p-6">
          <h1 className="text-lg font-bold text-coal">
            Dieses Konto hat keine Schreibrechte für den Zeitstrahl.
          </h1>
          <p className="mt-2 text-sm text-coal-soft">
            Zum Eintragen braucht es ein Konto mit der Rolle „Eintrag“ oder
            „Admin“. Bitte beim Schul-Team melden.
          </p>
          <p className="hint mt-3">Angemeldet als {email}</p>
          <div className="mt-5 flex flex-wrap gap-2">
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

  if (editId && !isAdmin) {
    return (
      <Shell>
        <div className="card animate-fade-up p-6">
          <h1 className="text-lg font-bold text-coal">
            Bearbeiten ist nur mit dem Admin-Konto möglich.
          </h1>
          <p className="mt-2 text-sm text-coal-soft">
            Mit diesem Konto lassen sich neue Erinnerungen anlegen — Änderungen
            an bestehenden Einträgen macht das Admin-Konto.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
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

  if (editId && (loadState === "idle" || loadState === "loading")) {
    return <PageSpinner label="Eintrag wird geladen …" />;
  }

  if (editId && (loadState === "missing" || loadState === "error")) {
    return (
      <Shell>
        <div className="card animate-fade-up p-6">
          <h1 className="text-lg font-bold text-coal">
            {loadState === "missing"
              ? "Diesen Eintrag gibt es nicht (mehr)."
              : "Der Eintrag konnte nicht geladen werden."}
          </h1>
          {loadError && (
            <p role="alert" className="mt-2 text-sm text-coal-soft">
              {loadError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-coal">
            {editing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
          </h1>
          <p className="hint mt-1.5">
            Angemeldet als {email} · Rolle: {isAdmin ? "Admin" : "Eintrag"}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() => void handleSignOut()}
        >
          Abmelden
        </button>
      </header>

      <EntryForm
        key={editing && entry ? entry.id : "neu"}
        session={session}
        isAdmin={isAdmin}
        entry={editing ? entry : null}
      />
    </Shell>
  );
}
