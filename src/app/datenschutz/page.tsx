import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Datenschutzerklärung des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf.",
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

const linkClass =
  "text-petrol underline decoration-petrol/30 underline-offset-2 transition-colors duration-150 hover:decoration-petrol";

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

        <p className="mt-6 max-w-prose text-sm leading-relaxed text-coal-soft">
          Diese Website („Gedächtnis der Zeit“ – der Zeitstrahl des Gymnasiums
          Neu Wulmstorf) ist bewusst datensparsam gebaut: Es gibt keine
          Registrierung für Besucherinnen und Besucher, keine Werbung, keine
          Tracking-Cookies und keine Analyse-Werkzeuge. Nachfolgend erläutern
          wir, welche Daten dennoch anfallen und warum.
        </p>

        <Section title="1. Verantwortlicher">
          <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
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
          </p>
          <p>
            Weitere Angaben finden Sie im{" "}
            <Link href="/impressum/" className={linkClass}>
              Impressum
            </Link>
            .
          </p>
        </Section>

        <Section title="2. Datenschutzbeauftragte(r)">
          <p>
            Als Schule in der Trägerschaft des Landkreises Harburg wird die
            Schule von der/dem behördlichen Datenschutzbeauftragten des
            Schulträgers bzw. der Landesschulbehörde betreut. Kontaktdaten:{" "}
            <Marker /> (Name, Anschrift und E-Mail-Adresse der/des zuständigen
            Datenschutzbeauftragten ergänzen)
          </p>
        </Section>

        <Section title="3. Hosting (Cloudflare Pages)">
          <p>
            Diese Website wird als statische Seite bei Cloudflare Pages gehostet
            (Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA).
            Beim Aufruf der Seite werden automatisch technische Zugriffsdaten in
            Server-Logdateien verarbeitet, insbesondere IP-Adresse, Datum und
            Uhrzeit des Zugriffs, aufgerufene Adresse, übertragene Datenmenge
            sowie Browsertyp und Betriebssystem. Diese Daten sind technisch
            erforderlich, um die Seite auszuliefern und den Betrieb sicher und
            stabil zu halten (Abwehr von Angriffen). Rechtsgrundlage ist Art. 6
            Abs. 1 lit. e DSGVO in Verbindung mit dem öffentlichen
            Bildungsauftrag der Schule bzw. Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an einem sicheren Betrieb). <Marker />
          </p>
          <p>
            Dabei kann es zu einer Übermittlung von Daten in die USA kommen. Die
            Übermittlung stützt sich auf den EU-US Data Privacy Framework bzw.
            auf die von der EU-Kommission erlassenen Standardvertragsklauseln,
            die Cloudflare mit seinen Kundinnen und Kunden abschließt. Mit
            Cloudflare besteht ein Vertrag zur Auftragsverarbeitung. <Marker />
          </p>
        </Section>

        <Section title="4. Backend und Datenbank (Supabase)">
          <p>
            Die Inhalte des Zeitstrahls werden in einer Datenbank des Anbieters
            Supabase gespeichert. Das Projekt ist in der Region Frankfurt am
            Main (AWS eu-central-1) angelegt, die Daten liegen also innerhalb
            der Europäischen Union. Gespeichert werden dort:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              die Inhalte des Zeitstrahls (Titel, Beschreibungstexte, Kategorie,
              Klasse, Datum, optional angegebene Namen sowie hochgeladene Bilder
              und Audio-Aufnahmen),
            </li>
            <li>
              die Zugangsdaten der wenigen Schul-Accounts, die Einträge anlegen
              dürfen (E-Mail-Adresse und ein verschlüsselt gespeichertes
              Passwort), sowie Zeitpunkte der Anmeldung.
            </li>
          </ul>
          <p>
            Rechtsgrundlage für die Speicherung der Inhalte ist Art. 6 Abs. 1
            lit. e DSGVO (Wahrnehmung einer Aufgabe im öffentlichen Interesse –
            Dokumentation der Schulgeschichte) sowie, soweit Personen abgebildet
            oder namentlich genannt werden, deren Einwilligung nach Art. 6
            Abs. 1 lit. a DSGVO. Mit Supabase besteht ein Vertrag zur
            Auftragsverarbeitung. <Marker />
          </p>
        </Section>

        <Section title="5. Cookies, localStorage und Reichweitenmessung">
          <p>
            Diese Website setzt <strong>keine Tracking-Cookies</strong> und
            verwendet{" "}
            <strong>keine Analyse- oder Statistik-Werkzeuge</strong> (kein
            Google Analytics o. Ä.). Es findet keine Profilbildung und keine
            automatisierte Entscheidungsfindung statt. Ein Cookie-Banner ist
            daher nicht erforderlich.
          </p>
          <p>
            Ausschließlich für die Anmeldung der wenigen Schul-Accounts wird der
            technisch notwendige Speicher des Browsers („localStorage“) genutzt,
            um die Sitzung nach dem Login aufrechtzuerhalten. Diese Information
            verbleibt auf dem Gerät der angemeldeten Person und kann durch
            Abmelden oder Löschen der Browserdaten entfernt werden. Wer die
            Seite nur liest, hat keinen solchen Eintrag.
          </p>
        </Section>

        <Section title="6. Öffentliche Inhalte: Erinnerungen, Fotos und Audio-Interviews">
          <p>
            Alle auf dem Zeitstrahl eingetragenen Erinnerungen sind{" "}
            <strong>öffentlich sichtbar</strong> – also für jede Besucherin und
            jeden Besucher der Website weltweit abrufbar. Das betrifft Titel und
            Beschreibungstexte, optional angegebene Namen (z. B. „Anna, 8a“ oder
            „Abi 1996“), hochgeladene Fotos und Audio-Interviews.
          </p>
          <p>
            Einträge können nicht von beliebigen Personen erstellt werden: Es
            gibt keine öffentliche Registrierung. Beiträge werden ausschließlich
            über wenige von der Schule eingerichtete Accounts angelegt und von
            der Schule betreut.
          </p>
          <p>
            Fotos und Audio-Aufnahmen werden nur mit ausdrücklicher Einwilligung
            der abgebildeten bzw. hörbaren Personen veröffentlicht; bei
            minderjährigen Schülerinnen und Schülern ist zusätzlich die
            Einwilligung der Erziehungsberechtigten erforderlich. Die
            Einwilligung ist freiwillig und kann jederzeit mit Wirkung für die
            Zukunft widerrufen werden (Art. 7 Abs. 3 DSGVO) – wir entfernen den
            betreffenden Inhalt dann zeitnah.{" "}
            <Marker text="[BITTE PROZESS PRÜFEN]" /> (Wie und wo werden die
            Einwilligungen eingeholt und dokumentiert?)
          </p>
        </Section>

        <Section title="7. Schriftarten">
          <p>
            Die verwendete Schriftart („Open Sans“) wird zusammen mit der
            Website von unserem eigenen Server ausgeliefert. Es werden{" "}
            <strong>keine Anfragen an Google Fonts</strong> oder andere externe
            Anbieter gestellt; Ihre IP-Adresse wird dabei also nicht an Dritte
            übertragen.
          </p>
        </Section>

        <Section title="8. Speicherdauer">
          <p>
            Die Inhalte des Zeitstrahls sind auf Dauer angelegt, da sie die
            Geschichte der Schule dokumentieren. Sie werden gelöscht, wenn eine
            betroffene Person dies verlangt oder eine erteilte Einwilligung
            widerrufen wird. Technische Zugriffsdaten in den Server-Logs des
            Hosters werden nach kurzer Zeit automatisch gelöscht bzw.
            anonymisiert. <Marker />
          </p>
        </Section>

        <Section title="9. Ihre Rechte">
          <p>
            Sie haben das Recht auf Auskunft über die zu Ihrer Person
            gespeicherten Daten (Art. 15 DSGVO), auf Berichtigung unrichtiger
            Daten (Art. 16 DSGVO), auf Löschung (Art. 17 DSGVO), auf
            Einschränkung der Verarbeitung (Art. 18 DSGVO), auf
            Datenübertragbarkeit (Art. 20 DSGVO) sowie das Recht, einer
            Verarbeitung zu widersprechen (Art. 21 DSGVO). Eine erteilte
            Einwilligung können Sie jederzeit für die Zukunft widerrufen.
          </p>
          <p>
            <strong>Löschwünsche und Fragen</strong> richten Sie bitte formlos
            an <A href="mailto:sekretariat@gym-nw.de">sekretariat@gym-nw.de</A>.
            Nennen Sie dabei möglichst den Titel des betreffenden Eintrags,
            damit wir ihn schnell finden.
          </p>
        </Section>

        <Section title="10. Beschwerderecht bei der Aufsichtsbehörde">
          <p>
            Unabhängig davon haben Sie das Recht, sich bei einer
            Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).
            Zuständig ist:
          </p>
          <p>
            Die Landesbeauftragte für den Datenschutz Niedersachsen
            <br />
            Prinzenstraße 5, 30159 Hannover
            <br />
            <A href="https://www.lfd.niedersachsen.de" rel="noopener noreferrer">
              www.lfd.niedersachsen.de
            </A>
            <br />
            <Marker /> (Anschrift und Zuständigkeit vor Veröffentlichung
            bestätigen)
          </p>
        </Section>

        <Section title="11. Datensicherheit">
          <p>
            Die Website wird ausschließlich verschlüsselt über HTTPS
            ausgeliefert. Schreibende Zugriffe auf die Datenbank sind
            serverseitig auf die berechtigten Schul-Accounts beschränkt (Row
            Level Security); ohne gültige Anmeldung kann niemand Inhalte
            anlegen, ändern oder löschen.
          </p>
        </Section>

        <p className="mt-8 max-w-prose border-t border-paper-line pt-7 text-sm leading-relaxed text-coal-soft">
          Stand dieser Datenschutzerklärung: <Marker text="[BITTE EINTRAGEN]" />
        </p>
      </div>
    </div>
  );
}
