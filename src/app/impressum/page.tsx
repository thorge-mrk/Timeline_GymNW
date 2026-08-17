import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Impressum des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf.",
};

/** Auffälliger Marker für alles, was die Schule noch prüfen/eintragen muss. */
function Marker({ text = "[BITTE PRÜFEN]" }: { text?: string }) {
  return <span className="font-semibold text-fox">{text}</span>;
}

export default function ImpressumPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-coal mb-6">Impressum</h1>

        <p className="rounded-xl border border-fox bg-fox/10 p-3 text-sm text-coal">
          <strong className="font-semibold">Entwurf</strong> — vor
          Veröffentlichung von der Schule prüfen und vervollständigen.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Angaben gemäß § 5 DDG
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Gymnasium Neu Wulmstorf
          <br />
          Ernst-Moritz-Arndt-Straße 20
          <br />
          21629 Neu Wulmstorf
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">Kontakt</h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Telefon:{" "}
          <a href="tel:+494064539190" className="text-petrol hover:underline">
            040 6453919-0
          </a>
          <br />
          E-Mail:{" "}
          <a
            href="mailto:sekretariat@gym-nw.de"
            className="text-petrol hover:underline"
          >
            sekretariat@gym-nw.de
          </a>
          <br />
          Website:{" "}
          <a
            href="https://www.gym-nw.de"
            className="text-petrol hover:underline"
            rel="noopener noreferrer"
          >
            www.gym-nw.de
          </a>
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Vertreten durch
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die Schulleitung: <Marker text="[BITTE VON DER SCHULE EINTRAGEN]" />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Schulträger
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Landkreis Harburg <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Zuständige Aufsichtsbehörde
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Regionales Landesamt für Schule und Bildung <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          <Marker text="[BITTE EINTRAGEN]" /> (Name und Anschrift der
          verantwortlichen Person; in der Regel ein Mitglied der Schulleitung
          oder die betreuende Lehrkraft des Projekts)
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Rechtsform
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Das Gymnasium Neu Wulmstorf ist eine öffentliche Schule in der
          Trägerschaft des Landkreises Harburg und damit eine Einrichtung ohne
          eigene Rechtspersönlichkeit. <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Haftung für Inhalte
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die Inhalte dieser Website – insbesondere die von Schülerinnen und
          Schülern, Lehrkräften und Ehemaligen beigetragenen Erinnerungen –
          werden mit größter Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine
          Gewähr übernehmen. Beiträge werden ausschließlich über wenige
          berechtigte Schul-Accounts eingetragen und von der Schule redaktionell
          betreut. Sollten Ihnen Inhalte auffallen, die Rechte Dritter verletzen
          oder unzutreffend sind, bitten wir um eine kurze Nachricht an{" "}
          <a
            href="mailto:sekretariat@gym-nw.de"
            className="text-petrol hover:underline"
          >
            sekretariat@gym-nw.de
          </a>{" "}
          – wir entfernen oder korrigieren solche Inhalte umgehend.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Haftung für Links
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Unser Angebot kann Links zu externen Websites Dritter enthalten, auf
          deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
          können wir keine Gewähr übernehmen; verantwortlich ist stets der
          jeweilige Anbieter oder Betreiber der verlinkten Seiten. Bei bekannt
          werdenden Rechtsverletzungen entfernen wir entsprechende Links
          umgehend.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Urheberrecht
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die auf dieser Website veröffentlichten Texte, Bilder und
          Audioaufnahmen unterliegen dem deutschen Urheberrecht. Eine
          Verwendung außerhalb dieser Website – insbesondere die
          Vervielfältigung oder Weiterverbreitung von Fotos und
          Audio-Interviews – bedarf der vorherigen schriftlichen Zustimmung der
          Schule bzw. der jeweiligen Urheberinnen und Urheber. <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          Datenschutz
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Informationen zur Verarbeitung personenbezogener Daten finden Sie in
          unserer{" "}
          <Link href="/datenschutz/" className="text-petrol hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
