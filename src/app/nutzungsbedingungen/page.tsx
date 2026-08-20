import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen",
  description:
    "Nutzungsbedingungen des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf: erlaubte Inhalte, Einverständnis und Nutzungsrechte.",
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

/** Aufzählung im Fließtext — gleiche Zeilenführung wie die Absätze. */
function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
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

export default function NutzungsbedingungenPage() {
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
          Nutzungsbedingungen
        </h1>

        <p className="mt-6 max-w-prose text-sm leading-relaxed text-coal-soft">
          Diese Nutzungsbedingungen gelten für die Website „Zeitstrahl Gymnasium
          Neu Wulmstorf“ (zeitstrahl-gymnw.de) und den dortigen Login-Bereich
          für berechtigte Schul-Accounts.
        </p>

        <Section title="1. Zweck des Angebots">
          <p>
            Der Zeitstrahl dokumentiert die Geschichte des Gymnasiums Neu
            Wulmstorf seit 1971 anhand von Beiträgen aus den Kategorien Schule,
            Schüler, Lehrkräfte, Ehemalige und Sonstiges. Beiträge werden
            ausschließlich über wenige berechtigte Schul-Accounts eingetragen
            und von der Schule redaktionell betreut.
          </p>
        </Section>

        <Section title="2. Wer darf Beiträge einstellen">
          <p>
            Zugang zum Eintragen von Inhalten erhalten ausschließlich von der
            Schule autorisierte Accounts, insbesondere Mitglieder des
            Projektteams sowie die das Projekt betreuende Lehrkraft.
            Zugangsdaten dürfen nicht an unberechtigte Dritte weitergegeben
            werden.
          </p>
        </Section>

        <Section title="3. Erlaubte Inhalte">
          <p>Eingestellte Beiträge müssen:</p>
          <List>
            <li>
              inhaltlich wahrheitsgemäß und nach bestem Wissen zutreffend sein,
            </li>
            <li>einen erkennbaren Bezug zur Geschichte der Schule haben,</li>
            <li>
              die Persönlichkeitsrechte aller abgebildeten oder genannten
              Personen wahren.
            </li>
          </List>
        </Section>

        <Section title="4. Nicht erlaubte Inhalte">
          <p>Nicht gestattet sind insbesondere Inhalte, die:</p>
          <List>
            <li>
              gegen geltendes Recht verstoßen (z. B. Beleidigung, Verleumdung,
              Volksverhetzung, Urheberrechtsverletzung),
            </li>
            <li>
              Personen ohne deren Einwilligung namentlich nennen, abbilden oder
              in Ton aufnehmen,
            </li>
            <li>
              Fotos aus nicht-öffentlichen Quellen ohne Zustimmung der
              abgebildeten Person veröffentlichen,
            </li>
            <li>
              diskriminierend, gewaltverherrlichend, sexualisiert oder in
              anderer Weise jugendgefährdend sind,
            </li>
            <li>
              Werbung, Spam oder schulfremde kommerzielle Inhalte darstellen,
            </li>
            <li>bewusst falsche Angaben zur Schulgeschichte enthalten.</li>
          </List>
          <p>
            Die Schule behält sich vor, Beiträge, die gegen diese Bedingungen
            verstoßen, vor Veröffentlichung abzulehnen oder nachträglich zu
            entfernen.
          </p>
        </Section>

        <Section title="5. Einverständnis bei der Eintragung">
          <p>
            Über das Eingabeformular können nur Texteinträge (Vorname, Klasse,
            Erinnerungstext) eingereicht werden; ein Foto-Upload ist darüber
            nicht möglich. Vor dem Absenden bestätigt die einreichende Person
            per Checkbox, dass sie mit der Speicherung und der weltweiten
            öffentlichen Anzeige dieser Angaben einverstanden ist und diese
            Nutzungsbedingungen akzeptiert. Für Vorname, Klasse und
            Erinnerungstext reicht dieses eigene Einverständnis aus; eine
            gesonderte Einwilligung der Erziehungsberechtigten ist dafür nicht
            nötig.
          </p>
          <p>
            Fotos werden dem Zeitstrahl vom Projektteam hinzugefügt, nicht über
            das öffentliche Formular, und stammen aus bereits öffentlich
            zugänglichen Quellen (z. B. der Schul-Homepage gym-nw.de). Wer mit
            der Verwendung eines Fotos von sich nicht einverstanden ist, kann
            jederzeit Widerspruch einlegen; das Foto wird dann entfernt.
          </p>
          <p>
            Die Einwilligung kann jederzeit formlos gegenüber{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>{" "}
            widerrufen werden (siehe{" "}
            <Link href="/datenschutz/" className={linkClass}>
              Datenschutzerklärung
            </Link>
            ).
          </p>
        </Section>

        <Section title="6. Nutzungsrechte an eingereichten Inhalten">
          <p>
            Eingereichte Texte und Fotos verbleiben im Eigentum
            bzw. Urheberrecht der einreichenden bzw. abgebildeten Person. Mit
            dem Einreichen räumt die einreichende Person dem Gymnasium Neu
            Wulmstorf ein einfaches, unentgeltliches Nutzungsrecht ein, den
            Beitrag auf dieser Website zeitlich unbefristet — bis zu einem
            etwaigen Widerruf — öffentlich zugänglich zu machen. Eine Nutzung
            außerhalb dieser Website (z. B. Druck, Weitergabe an Dritte) bedarf
            einer gesonderten Zustimmung.
          </p>
        </Section>

        <Section title="7. Öffentliche Sichtbarkeit">
          <p>
            Alle veröffentlichten Beiträge sind für jede Besucherin und jeden
            Besucher der Website weltweit frei einsehbar; es gibt keinen
            zugangsbeschränkten Bereich für Betrachtende. Einreichende sollten
            dies bei der Formulierung ihrer Beiträge berücksichtigen.
          </p>
        </Section>

        <Section title="8. Haftung">
          <p>
            Für die inhaltliche Richtigkeit eingereichter Erinnerungen und
            Beiträge kann trotz redaktioneller Prüfung keine Gewähr übernommen
            werden (siehe{" "}
            <Link href="/impressum/" className={linkClass}>
              Impressum
            </Link>
            , Abschnitt „Haftung für Inhalte“). Hinweise auf fehlerhafte oder
            rechtsverletzende Inhalte bitte an{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>.
          </p>
        </Section>

        <Section title="9. Änderungen">
          <p>
            Die Schule kann diese Nutzungsbedingungen bei Bedarf anpassen,
            insbesondere bei Änderungen der Funktionsweise der Website.
          </p>
        </Section>

        <p className="mt-8 max-w-prose border-t border-paper-line pt-7 text-sm text-coal-soft">
          Stand: August 2026
        </p>
      </div>
    </div>
  );
}
