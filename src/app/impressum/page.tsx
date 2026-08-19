import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Impressum des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf: Angaben nach § 5 DDG, Kontakt, Schulträger und Aufsichtsbehörde.",
};

/** Einheitliches Aussehen aller Verweise im Rechtstext. */
const linkClass =
  "text-petrol underline decoration-petrol/30 underline-offset-2 transition-colors duration-150 hover:decoration-petrol";

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

/** Externe Ziele sowie mailto:/tel: — interne Seiten laufen über next/link. */
function A({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={href} className={linkClass} {...rest}>
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

        <Section title="Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)">
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
          <p>Die Schulleitung: Jörg Berthold (Schulleiter)</p>
        </Section>

        <Section title="Technische Umsetzung">
          <p>Umsetzung: Thorge Mrowinski (Thorge Tech Solutions)</p>
        </Section>

        <Section title="Schulträger">
          <p>
            Landkreis Harburg
            <br />
            Der Landrat
            <br />
            Schloßplatz 6
            <br />
            21423 Winsen (Luhe)
            <br />
            Telefon: 04171 693-0
            <br />
            E-Mail:{" "}
            <A href="mailto:buergerservice@lkharburg.de">
              buergerservice@lkharburg.de
            </A>
          </p>
        </Section>

        <Section title="Zuständige Aufsichtsbehörde">
          <p>Regionales Landesamt für Schule und Bildung (RLSB) Lüneburg</p>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>
            Jörg Berthold, Schulleiter
            <br />
            Gymnasium Neu Wulmstorf, Ernst-Moritz-Arndt-Straße 20, 21629 Neu
            Wulmstorf
          </p>
        </Section>

        <Section title="Rechtsform">
          <p>
            Das Gymnasium Neu Wulmstorf ist eine öffentliche Schule in der
            Trägerschaft des Landkreises Harburg. Öffentliche Schulen in
            Niedersachsen besitzen keine eigene Rechtspersönlichkeit; sie sind
            rechtlich unselbstständige Einrichtungen des Schulträgers bzw. des
            Landes Niedersachsen.
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Die Inhalte dieser Website — insbesondere die von Schülerinnen und
            Schülern, Lehrkräften und Ehemaligen beigetragenen Erinnerungen —
            werden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine
            Gewähr übernehmen. Beiträge werden ausschließlich über wenige
            berechtigte Schul-Accounts eingetragen und von der Schule
            redaktionell betreut (siehe auch unsere{" "}
            <Link href="/nutzungsbedingungen/" className={linkClass}>
              Nutzungsbedingungen
            </Link>
            ). Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene
            Inhalte nach den allgemeinen Gesetzen verantwortlich; zu einer
            Überwachung übermittelter oder gespeicherter fremder Informationen
            sind wir nach §§ 8–10 DDG nicht verpflichtet. Sollten Ihnen Inhalte
            auffallen, die Rechte Dritter verletzen oder unzutreffend sind,
            bitten wir um eine kurze Nachricht an{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A> —
            wir prüfen den Hinweis und entfernen oder korrigieren betroffene
            Inhalte umgehend.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot kann Links zu externen Websites Dritter enthalten, auf
            deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte
            können wir keine Gewähr übernehmen; verantwortlich ist stets der
            jeweilige Anbieter oder Betreiber der verlinkten Seiten. Die
            verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
            Rechtsverstöße überprüft. Eine permanente inhaltliche Kontrolle ist
            ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
            Bei bekannt werdenden Rechtsverletzungen entfernen wir entsprechende
            Links umgehend.
          </p>
        </Section>

        <Section title="Urheberrecht">
          <p>
            Die von der Schule erstellten Texte, Layouts und Grafiken dieser
            Website unterliegen dem deutschen Urheberrecht. Fotos,
            Audioaufnahmen und Erinnerungstexte, die von Schülerinnen und
            Schülern, Lehrkräften oder Ehemaligen beigetragen werden, verbleiben
            im Urheberrecht der jeweiligen Person; mit dem Einreichen räumen die
            Beitragenden dem Gymnasium Neu Wulmstorf ein einfaches, zeitlich auf
            die Dauer des Projekts beschränktes Nutzungsrecht zur
            Veröffentlichung auf dieser Website ein (Details siehe{" "}
            <Link href="/nutzungsbedingungen/" className={linkClass}>
              Nutzungsbedingungen
            </Link>
            ). Eine Verwendung außerhalb dieser Website — insbesondere
            Vervielfältigung oder Weiterverbreitung von Fotos und
            Audio-Interviews — bedarf der vorherigen schriftlichen Zustimmung
            der Schule bzw. der jeweiligen Urheberin/des jeweiligen Urhebers.
          </p>
        </Section>

        <Section title="Datenschutz">
          <p>
            Informationen zur Verarbeitung personenbezogener Daten finden Sie in
            unserer{" "}
            <Link href="/datenschutz/" className={linkClass}>
              Datenschutzerklärung
            </Link>
            .
          </p>
        </Section>

        <p className="mt-8 max-w-prose border-t border-paper-line pt-7 text-sm text-coal-soft">
          Stand: August 2026
        </p>
      </div>
    </div>
  );
}
