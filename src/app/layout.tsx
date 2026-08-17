import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import Link from "next/link";
import SchoolMark from "@/components/SchoolMark";
import "./globals.css";
// Ergänzende Klassen (eigene Kurven, gestapelte Hinweiszustände, Zeiger-Hover).
import "@/components/form/form.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zeitstrahl-gymnw.de"),
  title: {
    default: "Zeitstrahl · Gymnasium Neu Wulmstorf",
    template: "%s · Zeitstrahl GymNW",
  },
  description:
    "Das Gedächtnis der Zeit: Meilensteine und Erinnerungen des Gymnasiums Neu Wulmstorf seit 1971 – von Schülern, Lehrkräften und Ehemaligen.",
  openGraph: {
    title: "Zeitstrahl · Gymnasium Neu Wulmstorf",
    description:
      "Meilensteine und Erinnerungen des Gymnasiums Neu Wulmstorf seit 1971.",
    locale: "de_DE",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060b28",
};

/** Trennpunkt zwischen den Fußzeilen-Links. */
function Dot() {
  return (
    <span aria-hidden className="select-none text-coal-faint/45">
      ·
    </span>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={openSans.variable}>
      <body className="flex min-h-dvh flex-col">
        <header className="z-40 border-b border-navy-line bg-navy text-paper shadow-(--shadow-card)">
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

            <nav className="flex shrink-0 items-center">
              <Link href="/eintragen/" className="btn-accent min-h-11">
                Eintragen
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>

        <footer className="border-t border-paper-line bg-paper-card">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 px-4 py-1 text-xs text-coal-soft sm:px-6">
            <p>
              © {new Date().getFullYear()} Gymnasium Neu Wulmstorf
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
      </body>
    </html>
  );
}
