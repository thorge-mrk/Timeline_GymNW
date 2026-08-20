/*
 * Reihenfolge der Stilblätter: zuerst das Design-System, dann die Ergänzungen.
 * So liegen die eigenen Regeln (auch die aus components/site.css, die über die
 * Komponenten unten dazukommen) im Bündel hinter den Tailwind-Utilities.
 */
import "./globals.css";
// Ergänzende Klassen (eigene Kurven, gestapelte Hinweiszustände, Zeiger-Hover).
import "@/components/form/form.css";

import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

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

/**
 * Diese Datei bleibt eine Server-Komponente: Metadaten, Schrift-Einbindung und
 * das Grundgerüst laufen ohne Browser-Code. Nur die beiden Teile, die
 * Einstellungen kennen müssen, sind eigene Client-Komponenten — das
 * Einstellungsmenü in der Kopfzeile und die Fußzeile, die im Vollbildmodus
 * verschwindet. Der Inhalt (`children`) bleibt davon unberührt.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={openSans.variable}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />

        {/*
          Normalerweise wächst die Seite mit ihrem Inhalt und der Browser
          scrollt sie — so, wie man es überall kennt. Nur der Zeitstrahl macht
          es anders: Er ist eine Tafel, die den Bildschirm füllt und in sich
          selbst geschoben wird. Das schaltet er über `data-view` am Body
          selbst ein (siehe globals.css); ein Formular in einem Rahmen mit
          eigenem Rollbalken wäre auf dem Handy eine Zumutung.
        */}
        <main className="flex flex-1 flex-col">{children}</main>

        {/* Beim statischen Export wird das Jahr einmal beim Bauen bestimmt. */}
        <SiteFooter year={new Date().getFullYear()} />
      </body>
    </html>
  );
}
