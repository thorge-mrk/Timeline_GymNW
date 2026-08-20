import Link from "next/link";
import EntriesMenu from "@/components/EntriesMenu";
import SchoolMark from "@/components/SchoolMark";
import SettingsMenu from "@/components/SettingsMenu";
import "./site.css";

/**
 * Kopfzeile der Seite. Bleibt bewusst eine Server-Komponente — sie kennt keinen
 * Zustand. Nur die beiden Menüs daneben laufen im Browser und wandern als
 * einzige Stücke dieser Zeile ins Client-Bündel.
 *
 * Auch im Vollbildmodus bleibt diese Zeile stehen: der Weg zurück (Zahnrad,
 * Startseite, Eintragen) darf nie verschwinden.
 */
export default function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-navy-line bg-navy text-paper shadow-(--shadow-card)">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="brand-link flex min-w-0 items-center gap-2.5 rounded-lg"
        >
          {/* Das Schul-Signet ist hier Dekoration — der Wortlaut daneben
              trägt bereits den Namen. */}
          <span aria-hidden className="flex shrink-0 items-center">
            <SchoolMark className="brand-mark h-7 w-auto text-fox" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-bold tracking-tight">
              Zeitstrahl
            </span>
            <span className="hidden truncate text-[11px] text-paper/60 sm:block">
              Gymnasium Neu Wulmstorf
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5">
          <Link href="/eintragen/" className="btn-accent min-h-11">
            Eintragen
          </Link>
          {/* Der Stift führt zu den eigenen (bzw. allen) Beiträgen. Er zeigt
              sich nur angemeldeten Konten mit Schreibrecht und entscheidet das
              selbst — deshalb steht hier keine Bedingung. */}
          <EntriesMenu />
          <SettingsMenu />
        </nav>
      </div>
    </header>
  );
}
