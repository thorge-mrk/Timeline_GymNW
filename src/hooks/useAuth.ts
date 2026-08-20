"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/types";

/**
 * Gemeinsamer Auth-Hook. Die Rolle kommt aus dem JWT-Claim
 * `app_metadata.app_role` (fälschungssicher, von Supabase signiert).
 * UI-Gating ist nur Komfort — durchgesetzt werden Rechte per RLS.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) {
        setSession(s);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const role = (session?.user.app_metadata?.app_role ?? null) as AppRole | null;

  return {
    session,
    loading,
    role,
    isAdmin: role === "admin",
    isContributor: role === "admin" || role === "editor",
    /**
     * `captchaToken` wird nur mitgeschickt, wenn es einen gibt. Ist der
     * Turnstile-Schutz in Supabase aus, ignoriert der Server das Feld — der
     * Aufruf funktioniert also in beiden Fällen unverändert.
     */
    signIn: (email: string, password: string, captchaToken?: string) =>
      supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      }),
    signOut: () => supabase.auth.signOut(),
  };
}
