import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Datenschutzerklärung des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf: verarbeitete Daten, Rechtsgrundlagen und Ihre Rechte.",
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

export default function DatenschutzPage() {
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
          Datenschutzerklärung
        </h1>

        <p className="mt-6 max-w-prose text-sm leading-relaxed text-coal-soft">
          Diese Website wurde bewusst datensparsam konzipiert: Es gibt keine
          Registrierung für Besucherinnen und Besucher, keine Werbung, keine
          Tracking-Cookies und keine Analyse-Werkzeuge. Im Folgenden informieren
          wir Sie darüber, welche personenbezogenen Daten dennoch verarbeitet
          werden.
        </p>

        <Section title="1. Verantwortlicher">
          <p>
            Gymnasium Neu Wulmstorf
            <br />
            Ernst-Moritz-Arndt-Straße 20
            <br />
            21629 Neu Wulmstorf
            <br />
            Telefon: <A href="tel:+494064539190">040 6453919-0</A>
            <br />
            E-Mail:{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>
            <br />
            vertreten durch die Schulleitung (siehe{" "}
            <Link href="/impressum/" className={linkClass}>
              Impressum
            </Link>
            )
          </p>
        </Section>

        <Section title="2. Datenschutzbeauftragte(r)">
          <p>
            Haben Sie Fragen zum Datenschutz? Dann richten Sie diese an{" "}
            <A href="mailto:datenschutzfragen@gym-nw.de">
              datenschutzfragen@gym-nw.de
            </A>
            . Ihre Anfrage wird an den behördlichen Datenschutzbeauftragten
            weitergeleitet.
          </p>
          <p>Ansprechpartner: Herr Schröder-Schroedter</p>
        </Section>

        <Section title="3. Rechtsgrundlagen">
          <p>
            Als öffentliche Schule verarbeiten wir personenbezogene Daten zur
            Erfüllung unserer öffentlichen Aufgabe (Dokumentation der
            Schulgeschichte) auf Grundlage von{" "}
            <strong className="font-semibold text-coal">
              Art. 6 Abs. 1 lit. e DSGVO i. V. m. § 3 NDSG
            </strong>{" "}
            (Niedersächsisches Datenschutzgesetz). Für die Veröffentlichung von
            Namen, Fotos und persönlichen Erinnerungen holen wir
            zusätzlich eine{" "}
            <strong className="font-semibold text-coal">
              ausdrückliche Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO
            </strong>{" "}
            ein, die jederzeit mit Wirkung für die Zukunft widerrufen werden
            kann.
          </p>
          <p className="italic">
            (Hinweis: Öffentliche Stellen können sich anders als private
            Anbieter nicht auf ein „berechtigtes Interesse“ nach Art. 6 Abs. 1
            lit. f DSGVO berufen — daher die Kombination aus öffentlicher
            Aufgabe und Einwilligung.)
          </p>
        </Section>

        <Section title="4. Hosting (Cloudflare)">
          <p>
            Diese Website wird über{" "}
            <strong className="font-semibold text-coal">Cloudflare</strong>{" "}
            (Cloudflare, Inc., USA, bzw. Cloudflare International B.V.,
            Niederlande) bereitgestellt. Beim Aufruf der Website verarbeitet
            Cloudflare automatisch technische Zugriffsdaten (z. B. IP-Adresse,
            Datum und Uhrzeit des Zugriffs, aufgerufene Seite, verwendeter
            Browser), um die Website performant und sicher auszuliefern.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. e DSGVO i. V. m. § 3 NDSG
            (Betrieb einer sicheren und funktionsfähigen Website als öffentliche
            Aufgabe).
          </p>
          <p>
            Da Cloudflare-Server auch außerhalb der EU (insbesondere in den USA)
            stehen können, findet eine Datenübermittlung in ein Drittland statt.
            Cloudflare ist unter dem{" "}
            <strong className="font-semibold text-coal">
              EU-U.S. Data Privacy Framework (DPF)
            </strong>{" "}
            zertifiziert und setzt ergänzend EU-Standardvertragsklauseln (SCC)
            ein — die Übermittlung ist damit auf Basis eines
            Angemessenheitsbeschlusses der EU-Kommission bzw. geeigneter
            Garantien nach Art. 44 ff. DSGVO zulässig. Mit der Nutzung von
            Cloudflare gilt das von Cloudflare bereitgestellte
            Standard-Auftragsverarbeitungsaddendum (Cloudflare Customer DPA)
            nach Art. 28 DSGVO.
          </p>
        </Section>

        <Section title="5. Datenbank/Backend (Supabase)">
          <p>
            Die Inhalte des Zeitstrahls sowie die Zugangsdaten der berechtigten
            Schul-Accounts werden über{" "}
            <strong className="font-semibold text-coal">Supabase</strong>{" "}
            verarbeitet und gespeichert, mit Serverstandort{" "}
            <strong className="font-semibold text-coal">
              Frankfurt am Main (EU-Central-1)
            </strong>
            . Eine Datenübermittlung in Drittländer außerhalb der EU/des EWR
            findet dadurch grundsätzlich nicht statt. Gespeichert werden
            insbesondere:
          </p>
          <List>
            <li>
              je Zeitstrahl-Eintrag: Vorname, Klasse, Erinnerungstext, Kategorie
              und Datum, sowie bei manchen Einträgen ein vom Projektteam
              ergänztes Foto,
            </li>
            <li>
              Zugangsdaten der Schul-Accounts (Benutzername/E-Mail, Passwort
              ausschließlich verschlüsselt/gehasht gespeichert).
            </li>
          </List>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. e DSGVO i. V. m. § 3 NDSG für
            den Betrieb der Website; Art. 6 Abs. 1 lit. a DSGVO für die von
            Nutzenden freiwillig eingereichten Erinnerungsinhalte. Mit der
            Nutzung von Supabase gilt das von Supabase bereitgestellte
            Standard-Auftragsverarbeitungsaddendum (Supabase DPA,
            supabase.com/legal/dpa) nach Art. 28 DSGVO.
          </p>
        </Section>

        <Section title="6. Login-Bereich für Schul-Accounts">
          <p>
            Nur wenige berechtigte Schul-Accounts können sich anmelden und
            Einträge bearbeiten. Für die Anmeldung wird das Anmeldesystem von
            Supabase (Supabase Auth) genutzt, das den Sitzungsstatus
            standardmäßig als Token im lokalen Speicher (localStorage) des
            Browsers ablegt; je nach technischer Umsetzung kann stattdessen auch
            ein Session-Cookie zum Einsatz kommen. In beiden Fällen dient der
            Mechanismus ausschließlich der Erkennung des angemeldeten Zustands
            und <strong className="font-semibold text-coal">nicht</strong> der
            Analyse oder Nachverfolgung von Besucherinnen und Besuchern.
            Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG (technisch notwendig) i. V.
            m. Art. 6 Abs. 1 lit. e DSGVO.
          </p>
        </Section>

        <Section title="7. Eingereichte Inhalte (Vorname, Klasse, Erinnerung)">
          <p>
            Über das Eingabeformular können Schul-Accounts ausschließlich Text
            einreichen: Vorname, Klasse und einen Erinnerungstext. Ein
            Foto-Upload ist über das Formular nicht möglich. Vor dem Absenden
            bestätigt die einreichende Person per Checkbox „Ich stimme zu“, dass
            sie mit der Speicherung und der weltweiten öffentlichen Anzeige
            dieser Angaben einverstanden ist und die Nutzungsbedingungen
            akzeptiert (Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO). Für
            Vorname, Klasse und Erinnerungstext reicht diese
            eigene Bestätigung aus; eine gesonderte Einwilligung der
            Erziehungsberechtigten ist dafür nicht erforderlich.
          </p>
          <p>
            Werden dem Zeitstrahl Fotos hinzugefügt, geschieht dies durch das
            Projektteam außerhalb des öffentlichen Formulars. Die verwendeten
            Fotos stammen aus bereits öffentlich zugänglichen Quellen (z. B. der
            Schul-Homepage gym-nw.de) und werden auf Grundlage von Art. 6 Abs. 1
            lit. e DSGVO i. V. m. § 3 NDSG übernommen. Wer mit der Verwendung
            eines Fotos nicht einverstanden ist, kann jederzeit Widerspruch
            einlegen (siehe Ziffer 12); das Foto wird dann entfernt.
          </p>
          <p>
            Alle veröffentlichten Einträge sind{" "}
            <strong className="font-semibold text-coal">
              für jede Besucherin und jeden Besucher weltweit öffentlich
              einsehbar
            </strong>
            . Die Einwilligung kann jederzeit formlos gegenüber{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>{" "}
            widerrufen werden; der betreffende Inhalt wird danach zeitnah
            entfernt.
          </p>
        </Section>

        <Section title="8. Cookies und Tracking">
          <p>
            Diese Website setzt{" "}
            <strong className="font-semibold text-coal">
              keine Tracking- oder Marketing-Cookies
            </strong>{" "}
            und verwendet{" "}
            <strong className="font-semibold text-coal">
              keine Analyse- oder Statistik-Werkzeuge
            </strong>{" "}
            (z. B. Google Analytics, Matomo). Es werden ausschließlich technisch
            notwendige Cookies/Speichermechanismen für den Login-Bereich
            verwendet (siehe Ziffer 6).
          </p>
        </Section>

        <Section title="9. Eingebundene Schriftarten">
          <p>
            Die Schriftart „Open Sans“ wird lokal vom eigenen Server
            ausgeliefert. Es findet{" "}
            <strong className="font-semibold text-coal">keine</strong>{" "}
            Verbindung zu externen Font-Anbietern (z. B. Google Fonts) statt; es
            werden dabei keine Daten an Dritte übermittelt.
          </p>
        </Section>

        <Section title="10. Speicherdauer">
          <p>
            Die Inhalte des Zeitstrahls sind als dauerhaftes digitales Gedächtnis
            der Schule angelegt und werden grundsätzlich unbefristet vorgehalten,
            solange der Zweck (Dokumentation der Schulgeschichte) fortbesteht und
            keine Einwilligung widerrufen wurde. Technische Zugriffsdaten, die im
            Rahmen der Auslieferung über Cloudflare anfallen, werden nur
            kurzzeitig zur Sicherstellung von Betrieb und Sicherheit vorgehalten
            und nicht dauerhaft gespeichert. Nach Widerruf einer Einwilligung
            werden die betroffenen Inhalte unverzüglich, spätestens innerhalb von
            14 Tagen gelöscht.
          </p>
        </Section>

        <Section title="11. Ihre Rechte als betroffene Person">
          <p>
            Sie haben nach Maßgabe der gesetzlichen Bestimmungen das Recht auf:
          </p>
          <List>
            <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO),</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
            <li>Löschung Ihrer Daten (Art. 17 DSGVO),</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO),</li>
            <li>
              Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft
              (Art. 7 Abs. 3 DSGVO).
            </li>
          </List>
          <p>
            Wenden Sie sich dazu formlos an{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>{" "}
            oder{" "}
            <A href="mailto:datenschutzfragen@gym-nw.de">
              datenschutzfragen@gym-nw.de
            </A>
            .
          </p>
        </Section>

        <Section title="12. Widerspruchsrecht">
          <p>
            Soweit Daten auf Grundlage einer öffentlichen Aufgabe (Art. 6 Abs. 1
            lit. e DSGVO) verarbeitet werden, können Sie aus Gründen, die sich
            aus Ihrer besonderen Situation ergeben, gemäß Art. 21 DSGVO
            Widerspruch einlegen. Genügt hierfür eine E-Mail an{" "}
            <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>.
          </p>
        </Section>

        <Section title="13. Beschwerderecht bei einer Aufsichtsbehörde">
          <p>
            Sie haben unbeschadet anderweitiger Rechtsbehelfe das Recht auf
            Beschwerde bei einer Datenschutz-Aufsichtsbehörde, insbesondere:
          </p>
          <p>
            Die Landesbeauftragte für den Datenschutz Niedersachsen
            <br />
            Prinzenstraße 5
            <br />
            30159 Hannover
            <br />
            Telefon: 0511 120 45 00
            <br />
            E-Mail:{" "}
            <A href="mailto:poststelle@lfd.niedersachsen.de">
              poststelle@lfd.niedersachsen.de
            </A>
          </p>
        </Section>

        <Section title="14. Datensicherheit">
          <p>
            Die Übertragung erfolgt verschlüsselt über HTTPS/TLS. Der Zugriff auf
            die Datenbank ist über Row-Level-Security (RLS) so eingeschränkt,
            dass Schreibzugriffe ausschließlich über authentifizierte
            Schul-Accounts möglich sind. Passwörter werden ausschließlich in
            gehashter Form gespeichert.
          </p>
        </Section>

        <Section title="15. Änderungen dieser Datenschutzerklärung">
          <p>
            Wir passen diese Datenschutzerklärung an, sobald sich die Website,
            die eingesetzten Dienste oder die rechtlichen Vorgaben ändern.
          </p>
        </Section>

        <p className="mt-8 max-w-prose border-t border-paper-line pt-7 text-sm text-coal-soft">
          Stand: August 2026
        </p>
      </div>
    </div>
  );
}
