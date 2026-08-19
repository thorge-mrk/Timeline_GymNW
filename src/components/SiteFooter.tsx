"use client";

import Link from "next/link";
import { useSettings } from "@/hooks/useSettings";
import "./site.css";

/**
 * Trennpunkt zwischen den Fußzeilen-Links. Auf dem Handy ist für vier Links
 * plus Punkte kein Platz — dort trennt allein der Abstand.
 */
function Dot() {
  return (
    <span
      aria-hidden
      className="hidden select-none text-coal-faint/45 sm:inline"
    >
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
 *
 * Die vier Links passen auf dem Handy (390 px) nur dann in eine Zeile, wenn
 * Schrift, Punkte und Abstände dort etwas knapper sitzen — deshalb der
 * kleinere Schriftgrad und die ausgeblendeten Trennpunkte unterhalb von `sm`.
 * Jeder Link behält seine 44 px hohe Tippfläche (.link-quiet).
 */
export default function SiteFooter({ year }: { year: number }) {
  const { settings } = useSettings();

  if (settings.fullscreen) return null;

  return (
    <footer className="border-t border-paper-line bg-paper-card">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 px-4 py-1 text-[11px] text-coal-soft sm:px-6 sm:text-xs">
        <p>
          © {year} Gymnasium Neu Wulmstorf
          <span className="hidden sm:inline"> · Das Gedächtnis der Zeit</span>
        </p>
        <nav className="-mx-1.5 flex flex-wrap items-center gap-x-0.5 sm:gap-x-1">
          <Link href="/impressum/" className="link-quiet whitespace-nowrap">
            Impressum
          </Link>
          <Dot />
          <Link href="/datenschutz/" className="link-quiet whitespace-nowrap">
            Datenschutz
          </Link>
          <Dot />
          <Link
            href="/nutzungsbedingungen/"
            className="link-quiet whitespace-nowrap"
          >
            Nutzungsbedingungen
          </Link>
          <Dot />
          <Link href="/login/" className="link-quiet whitespace-nowrap">
            Anmelden
          </Link>
        </nav>
      </div>
    </footer>
  );
}
