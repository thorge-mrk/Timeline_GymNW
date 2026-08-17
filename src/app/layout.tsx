import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  themeColor: "#0b1338",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={openSans.variable}>
      <body className="flex min-h-dvh flex-col">
        <header className="z-40 bg-navy text-paper shadow-md">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-fox text-sm font-extrabold text-navy"
              >
                Z
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold tracking-wide">
                  Zeitstrahl
                </span>
                <span className="block text-[11px] text-paper/70">
                  Gymnasium Neu Wulmstorf
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/eintragen/"
                className="rounded-xl bg-fox px-3.5 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-[#ffa63a]"
              >
                Eintragen
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">{children}</main>

        <footer className="border-t border-paper-line bg-paper-card">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-coal-soft sm:px-6">
            <span>
              © {new Date().getFullYear()} Gymnasium Neu Wulmstorf · Das
              Gedächtnis der Zeit
            </span>
            <span className="flex gap-4">
              <Link href="/impressum/" className="hover:text-coal">
                Impressum
              </Link>
              <Link href="/datenschutz/" className="hover:text-coal">
                Datenschutz
              </Link>
              <Link href="/login/" className="hover:text-coal">
                Anmelden
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
