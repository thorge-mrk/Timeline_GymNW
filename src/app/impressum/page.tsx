import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Impressum des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf.",
};

/** Auffälliger Marker für alles, was die Schule noch prüfen/eintragen muss. */
function Marker({ text = "[BITTE PRÜFEN]" }: { text?: string }) {
  return (
    <mark className="mx-0.5 inline-block rounded-md bg-fox px-1.5 py-0.5 align-baseline text-[11px] font-bold tracking-wide text-navy">
      {text}
    </mark>
  );
}

/** Abschnitt mit klarer Hierarchie und ruhiger Zeilenführung. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-paper-line pt-7">
      <h2 className="text-base font-bold tracking-tight text-coal">{title}</h2>
      <div className="mt-2.5 max-w-prose space-y-3 text-sm leading-relaxed text-coal-soft">
        {children}
      </div>
    </section>
  );
}

function A({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      className="text-petrol underline decoration-petrol/30 underline-offset-2 transition-colors duration-150 hover:decoration-petrol"
      {...rest}
    >
      {children}
    </a>
  );
}

export default function ImpressumPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-4">
        <Link href="/" className="hint link-quiet -ml-1.5">
          ← Zurück zum Zeitstrahl
        </Link>
      </p>

      <div className="card animate-fade-up p-6 shadow-(--shadow-card-lg) sm:p-9">
        <p className="text-[11px] font-bold tracking-wider text-coal-faint uppercase">
          Gymnasium Neu Wulmstorf
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-coal">
          Impressum
        </h1>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-fox/35 bg-fox-soft p-4">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            className="mt-px h-5 w-5 shrink-0 text-fox-deep"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11.2v5" />
            <path d="M12 7.9h.01" />
          </svg>
          <p className="text-sm leading-relaxed text-coal">
            <strong className="font-bold">Entwurf</strong> — vor
            Veröffentlichung von der Schule prüfen und vervollständigen. Alle
            orange markierten Stellen brauchen noch eine Angabe.
          </p>
        </div>

        <Section title="Angaben gemäß § 5 DDG">
          <p>
            Gymnasium Neu Wulmstorf
            <br />
            Ernst-Moritz-Arndt-Straße 20
            <br />
            21629 Neu Wulmstorf
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Telefon: <A href="tel:+494064539190">040 6453919-0</A>
            <br />
            E-Mail:{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>
            <br />
            Website:{" "}
            <A href="https://www.gym-nw.de" rel="noopener noreferrer">
              www.gym-nw.de
            </A>
          </p>
        </Section>

        <Section title="Vertreten durch">
          <p>
            Die Schulleitung: <Marker text="[BITTE VON DER SCHULE EINTRAGEN]" />
          </p>
        </Section>

        <Section title="Schulträger">
          <p>
            Landkreis Harburg <Marker />
          </p>
        </Section>

        <Section title="Zuständige Aufsichtsbehörde">
          <p>
            Regionales Landesamt für Schule und Bildung <Marker />
          </p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>
            <Marker text="[BITTE EINTRAGEN]" /> (Name und Anschrift der
            verantwortlichen Person; in der Regel ein Mitglied der Schulleitung
            oder die betreuende Lehrkraft des Projekts)
          </p>
        </Section>

        <Section title="Rechtsform">
          <p>
            Das Gymnasium Neu Wulmstorf ist eine öffentliche Schule in der
            Trägerschaft des Landkreises Harburg und damit eine Einrichtung ohne
            eigene Rechtspersönlichkeit. <Marker />
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Die Inhalte dieser Website – insbesondere die von Schülerinnen und
            Schülern, Lehrkräften und Ehemaligen beigetragenen Erinnerungen –
            werden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine
            Gewähr übernehmen. Beiträge werden ausschließlich über wenige
            berechtigte Schul-Accounts eingetragen und von der Schule
            redaktionell betreut. Sollten Ihnen Inhalte auffallen, die Rechte
            Dritter verletzen oder unzutreffend sind, bitten wir um eine kurze
            Nachricht an{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A> –
            wir entfernen oder korrigieren solche Inhalte umgehend.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot kann Links zu externen Websites Dritter enthalten, auf
            deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
            können wir keine Gewähr übernehmen; verantwortlich ist stets der
            jeweilige Anbieter oder Betreiber der verlinkten Seiten. Bei bekannt
            werdenden Rechtsverletzungen entfernen wir entsprechende Links
            umgehend.
          </p>
        </Section>

        <Section title="Urheberrecht">
          <p>
            Die auf dieser Website veröffentlichten Texte, Bilder und
            Audioaufnahmen unterliegen dem deutschen Urheberrecht. Eine
            Verwendung außerhalb dieser Website – insbesondere die
            Vervielfältigung oder Weiterverbreitung von Fotos und
            Audio-Interviews – bedarf der vorherigen schriftlichen Zustimmung
            der Schule bzw. der jeweiligen Urheberinnen und Urheber. <Marker />
          </p>
        </Section>

        <Section title="Datenschutz">
          <p>
            Informationen zur Verarbeitung personenbezogener Daten finden Sie in
            unserer{" "}
            <Link
              href="/datenschutz/"
              className="text-petrol underline decoration-petrol/30 underline-offset-2 transition-colors duration-150 hover:decoration-petrol"
            >
              Datenschutzerklärung
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
