import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Datenschutzerklärung des Zeitstrahls „Gedächtnis der Zeit“ des Gymnasiums Neu Wulmstorf.",
};

/** Auffälliger Marker für alles, was die Schule noch prüfen/eintragen muss. */
function Marker({ text = "[BITTE PRÜFEN]" }: { text?: string }) {
  return <span className="font-semibold text-fox">{text}</span>;
}

export default function DatenschutzPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-coal mb-6">
          Datenschutzerklärung
        </h1>

        <p className="rounded-xl border border-fox bg-fox/10 p-3 text-sm text-coal">
          <strong className="font-semibold">Entwurf</strong> — vor
          Veröffentlichung von der Schule prüfen und vervollständigen.
        </p>

        <p className="text-coal-soft text-sm leading-relaxed mt-6">
          Diese Website („Gedächtnis der Zeit“ – der Zeitstrahl des Gymnasiums
          Neu Wulmstorf) ist bewusst datensparsam gebaut: Es gibt keine
          Registrierung für Besucherinnen und Besucher, keine Werbung, keine
          Tracking-Cookies und keine Analyse-Werkzeuge. Nachfolgend erläutern
          wir, welche Daten dennoch anfallen und warum.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          1. Verantwortlicher
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Verantwortlich für die Datenverarbeitung auf dieser Website ist:
          <br />
          <br />
          Gymnasium Neu Wulmstorf
          <br />
          Ernst-Moritz-Arndt-Straße 20
          <br />
          21629 Neu Wulmstorf
          <br />
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
          <br />
          Weitere Angaben finden Sie im{" "}
          <Link href="/impressum/" className="text-petrol hover:underline">
            Impressum
          </Link>
          .
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          2. Datenschutzbeauftragte(r)
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Als Schule in der Trägerschaft des Landkreises Harburg wird die
          Schule von der/dem behördlichen Datenschutzbeauftragten des
          Schulträgers bzw. der Landesschulbehörde betreut. Kontaktdaten:{" "}
          <Marker /> (Name, Anschrift und E-Mail-Adresse der/des zuständigen
          Datenschutzbeauftragten ergänzen)
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          3. Hosting (Cloudflare Pages)
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
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
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          Dabei kann es zu einer Übermittlung von Daten in die USA kommen. Die
          Übermittlung stützt sich auf den EU-US Data Privacy Framework bzw. auf
          die von der EU-Kommission erlassenen Standardvertragsklauseln, die
          Cloudflare mit seinen Kundinnen und Kunden abschließt. Mit Cloudflare
          besteht ein Vertrag zur Auftragsverarbeitung. <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          4. Backend und Datenbank (Supabase)
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die Inhalte des Zeitstrahls werden in einer Datenbank des Anbieters
          Supabase gespeichert. Das Projekt ist in der Region Frankfurt am Main
          (AWS eu-central-1) angelegt, die Daten liegen also innerhalb der
          Europäischen Union. Gespeichert werden dort:
        </p>
        <ul className="text-coal-soft text-sm leading-relaxed mt-3 list-disc pl-5 space-y-1">
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
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          Rechtsgrundlage für die Speicherung der Inhalte ist Art. 6 Abs. 1
          lit. e DSGVO (Wahrnehmung einer Aufgabe im öffentlichen Interesse –
          Dokumentation der Schulgeschichte) sowie, soweit Personen abgebildet
          oder namentlich genannt werden, deren Einwilligung nach Art. 6 Abs. 1
          lit. a DSGVO. Mit Supabase besteht ein Vertrag zur
          Auftragsverarbeitung. <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          5. Cookies, localStorage und Reichweitenmessung
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Diese Website setzt <strong>keine Tracking-Cookies</strong> und
          verwendet <strong>keine Analyse- oder Statistik-Werkzeuge</strong>
          {" "}(kein Google Analytics o. Ä.). Es findet keine Profilbildung und
          keine automatisierte Entscheidungsfindung statt. Ein Cookie-Banner ist
          daher nicht erforderlich.
        </p>
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          Ausschließlich für die Anmeldung der wenigen Schul-Accounts wird der
          technisch notwendige Speicher des Browsers („localStorage“) genutzt,
          um die Sitzung nach dem Login aufrechtzuerhalten. Diese Information
          verbleibt auf dem Gerät der angemeldeten Person und kann durch
          Abmelden oder Löschen der Browserdaten entfernt werden. Wer die Seite
          nur liest, hat keinen solchen Eintrag.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          6. Öffentliche Inhalte: Erinnerungen, Fotos und Audio-Interviews
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Alle auf dem Zeitstrahl eingetragenen Erinnerungen sind{" "}
          <strong>öffentlich sichtbar</strong> – also für jede Besucherin und
          jeden Besucher der Website weltweit abrufbar. Das betrifft Titel und
          Beschreibungstexte, optional angegebene Namen (z. B. „Anna, 8a“ oder
          „Abi 1996“), hochgeladene Fotos und Audio-Interviews.
        </p>
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          Einträge können nicht von beliebigen Personen erstellt werden: Es gibt
          keine öffentliche Registrierung. Beiträge werden ausschließlich über
          wenige von der Schule eingerichtete Accounts angelegt und von der
          Schule betreut.
        </p>
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          Fotos und Audio-Aufnahmen werden nur mit ausdrücklicher Einwilligung
          der abgebildeten bzw. hörbaren Personen veröffentlicht; bei
          minderjährigen Schülerinnen und Schülern ist zusätzlich die
          Einwilligung der Erziehungsberechtigten erforderlich. Die Einwilligung
          ist freiwillig und kann jederzeit mit Wirkung für die Zukunft
          widerrufen werden (Art. 7 Abs. 3 DSGVO) – wir entfernen den
          betreffenden Inhalt dann zeitnah.{" "}
          <Marker text="[BITTE PROZESS PRÜFEN]" /> (Wie und wo werden die
          Einwilligungen eingeholt und dokumentiert?)
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          7. Schriftarten
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die verwendete Schriftart („Open Sans“) wird zusammen mit der Website
          von unserem eigenen Server ausgeliefert. Es werden{" "}
          <strong>keine Anfragen an Google Fonts</strong> oder andere externe
          Anbieter gestellt; Ihre IP-Adresse wird dabei also nicht an Dritte
          übertragen.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          8. Speicherdauer
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die Inhalte des Zeitstrahls sind auf Dauer angelegt, da sie die
          Geschichte der Schule dokumentieren. Sie werden gelöscht, wenn eine
          betroffene Person dies verlangt oder eine erteilte Einwilligung
          widerrufen wird. Technische Zugriffsdaten in den Server-Logs des
          Hosters werden nach kurzer Zeit automatisch gelöscht bzw.
          anonymisiert. <Marker />
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          9. Ihre Rechte
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Sie haben das Recht auf Auskunft über die zu Ihrer Person
          gespeicherten Daten (Art. 15 DSGVO), auf Berichtigung unrichtiger
          Daten (Art. 16 DSGVO), auf Löschung (Art. 17 DSGVO), auf
          Einschränkung der Verarbeitung (Art. 18 DSGVO), auf
          Datenübertragbarkeit (Art. 20 DSGVO) sowie das Recht, einer
          Verarbeitung zu widersprechen (Art. 21 DSGVO). Eine erteilte
          Einwilligung können Sie jederzeit für die Zukunft widerrufen.
        </p>
        <p className="text-coal-soft text-sm leading-relaxed mt-3">
          <strong>Löschwünsche und Fragen</strong> richten Sie bitte formlos an{" "}
          <a
            href="mailto:sekretariat@gym-nw.de"
            className="text-petrol hover:underline"
          >
            sekretariat@gym-nw.de
          </a>
          . Nennen Sie dabei möglichst den Titel des betreffenden Eintrags,
          damit wir ihn schnell finden.
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          10. Beschwerderecht bei der Aufsichtsbehörde
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Unabhängig davon haben Sie das Recht, sich bei einer
          Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).
          Zuständig ist:
          <br />
          <br />
          Die Landesbeauftragte für den Datenschutz Niedersachsen
          <br />
          Prinzenstraße 5, 30159 Hannover
          <br />
          <a
            href="https://www.lfd.niedersachsen.de"
            className="text-petrol hover:underline"
            rel="noopener noreferrer"
          >
            www.lfd.niedersachsen.de
          </a>
          <br />
          <Marker /> (Anschrift und Zuständigkeit vor Veröffentlichung
          bestätigen)
        </p>

        <h2 className="text-lg font-semibold text-coal mt-8 mb-2">
          11. Datensicherheit
        </h2>
        <p className="text-coal-soft text-sm leading-relaxed">
          Die Website wird ausschließlich verschlüsselt über HTTPS
          ausgeliefert. Schreibende Zugriffe auf die Datenbank sind
          serverseitig auf die berechtigten Schul-Accounts beschränkt
          (Row Level Security); ohne gültige Anmeldung kann niemand Inhalte
          anlegen, ändern oder löschen.
        </p>

        <p className="text-coal-soft text-sm leading-relaxed mt-8">
          Stand dieser Datenschutzerklärung: <Marker text="[BITTE EINTRAGEN]" />
        </p>
      </div>
    </div>
  );
}
