"use client";

import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import "./site.css";

/** Trennpunkt zwischen den Fußzeilen-Links. */
function Dot() {
  return (
    <span aria-hidden className="select-none text-coal-faint/45">
      ·
    </span>
  );
}

/**
 * Fußzeile. Einzige Client-Komponente am Seitenrahmen, weil sie im
 * Vollbildmodus verschwinden muss — dann bekommt der Zeitstrahl ihre Höhe.
 *
 * Das Jahr kommt als Eigenschaft aus layout.tsx: Beim statischen Export steht
 * es schon im vorgerenderten HTML; würde die Komponente es selbst berechnen,
 * könnten HTML und erste Darstellung um den Jahreswechsel auseinanderlaufen.
 */
export default function SiteFooter({ year }: { year: number }) {
  const { settings } = useSettings();

  if (settings.fullscreen) return null;

  return (
    <footer className="border-t border-paper-line bg-paper-card">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 px-4 py-1 text-xs text-coal-soft sm:px-6">
        <p>
          © {year} Gymnasium Neu Wulmstorf
          <span className="hidden sm:inline"> · Das Gedächtnis der Zeit</span>
        </p>
        <nav className="-mx-1.5 flex flex-wrap items-center gap-x-1">
          <Link href="/impressum/" className="link-quiet">
            Impressum
          </Link>
          <Dot />
          <Link href="/datenschutz/" className="link-quiet">
            Datenschutz
          </Link>
          <Dot />
          <Link href="/login/" className="link-quiet">
            Anmelden
          </Link>
        </nav>
      </div>
    </footer>
  );
}
