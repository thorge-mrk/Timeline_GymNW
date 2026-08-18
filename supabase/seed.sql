-- =============================================================================
-- BEISPIELDATEN für den Zeitstrahl (NUR für Entwicklung/Tests).
--
-- ⚠️  ACHTUNG: Diese Einträge sind ERFUNDEN. Titel, Texte, Datumsangaben und
--     Zahlen (z. B. „42 Schülerinnen und Schüler“) sind frei ausgedacht und
--     klingen absichtlich plausibel — sie sind KEINE historischen Daten des
--     Gymnasiums Neu Wulmstorf und dürfen NICHT in die öffentliche Datenbank
--     gelangen. Vor dem Go-Live restlos entfernen (Befehl unten).
--
--     Vor der Veröffentlichung gilt: Jeder Eintrag auf dem Zeitstrahl sollte
--     entweder von einer Person der Schule stammen oder belegbar sein.
--
-- created_by zeigt auf den Dev-Admin-Account (dev-admin@zeitstrahl-gymnw.de,
-- uid b68a0806-c95d-4ca8-ab19-bda47600ff78). Falls dieser Account nicht
-- existiert, die uuid unten anpassen oder created_by auf null setzen.
--
-- Alle Beispieldaten wieder löschen:
--   delete from public.entries
--   where created_by = 'b68a0806-c95d-4ca8-ab19-bda47600ff78';
-- (oder komplett: truncate table public.entries;)
-- =============================================================================

insert into public.entries
  (title, description, category, class_name, author_name, year, month, day, is_milestone, created_by)
values
  -- ---- Meilensteine (category='schule', is_milestone=true) -----------------
  ('Gründung des Gymnasiums',
   'Das Gymnasium Neu Wulmstorf nimmt mit vier fünften Klassen und zwölf Lehrkräften den Unterricht auf. Unterrichtet wird zunächst in Pavillons.',
   'schule', null, null, 1971, null, null, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Einweihung des Hauptgebäudes',
   'Nach zwei Jahren Bauzeit wird das Hauptgebäude feierlich eingeweiht. Endlich haben alle Klassen Platz unter einem Dach.',
   'schule', null, null, 1974, 9, null, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Erster Abiturjahrgang verabschiedet',
   '42 Schülerinnen und Schüler erhalten als erster Jahrgang ihr Abiturzeugnis am Gymnasium Neu Wulmstorf.',
   'schule', null, null, 1979, 5, 26, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('25-jähriges Jubiläum',
   'Festwoche mit Projekttagen, Ehemaligentreffen und großem Schulfest zum 25-jährigen Bestehen der Schule.',
   'schule', null, null, 1996, 6, 14, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('50 Jahre GymNW',
   'Das Gymnasium feiert sein 50-jähriges Bestehen — pandemiebedingt mit einem Festakt im Livestream und einer digitalen Ausstellung.',
   'schule', null, null, 2021, null, null, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Neues Fuchs-Logo',
   'Die Schulgemeinschaft wählt das neue Fuchs-Logo. Der Siegerentwurf stammt aus dem Kunstkurs des 12. Jahrgangs.',
   'schule', null, null, 2023, 12, null, true,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  -- ---- Normale Einträge ----------------------------------------------------
  ('Frau Dr. Hansen wird Schulleiterin',
   'Als erste Frau übernimmt Dr. Ingrid Hansen die Leitung des Gymnasiums. Sie prägt die Schule über 15 Jahre.',
   'lehrer', null, null, 1985, null, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Erste Ausgabe der Schülerzeitung „Fuchsbau"',
   'Die 10b bringt die erste Ausgabe der Schülerzeitung heraus — getippt, kopiert und für 50 Pfennig auf dem Pausenhof verkauft.',
   'schueler', '10b', 'Redaktion Fuchsbau', 1997, 11, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Schulchor gewinnt Regionalwettbewerb',
   'Unter der Leitung von Musiklehrer Herrn Petersen singt sich der Schulchor beim Regionalwettbewerb in Lüneburg auf den ersten Platz.',
   'lehrer', null, 'J. Petersen', 2004, 3, 13, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Zirkusprojekt der 9a begeistert beim Schulfest',
   'Eine Woche lang trainiert die 9a Akrobatik, Jonglage und Clownerie — die Aufführung in der Turnhalle ist restlos ausverkauft.',
   'schueler', '9a', null, 2009, null, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Neue Mensa eröffnet',
   'Zum Schuljahresbeginn öffnet die neue Mensa mit 180 Plätzen. Zum ersten Mal gibt es täglich warmes Mittagessen.',
   'sonstiges', null, null, 2013, 8, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Herr Meyer nach 35 Jahren verabschiedet',
   'Mathe- und Physiklehrer Herr Meyer geht in den Ruhestand. Sein legendärer Satz: „Das ist trivial!" — Generationen von Schülern erinnern sich.',
   'lehrer', null, 'M. Schröder', 2015, 7, 17, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Abistreich: Foyer wird zur Strandbar',
   'Der Abiturjahrgang verwandelt das Foyer über Nacht in eine Strandlandschaft — inklusive drei Tonnen Sand und Liegestühlen für das Lehrerzimmer.',
   'schueler', 'Abi 2018', null, 2018, 6, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Klassentreffen nach 25 Jahren',
   'Der Abiturjahrgang 1998 trifft sich in der alten Aula. Höhepunkt: die Original-Diashow der Abschlussfahrt nach Rom.',
   'ehemalige', 'Abi 1998', 'S. Brandt', 2023, 9, 23, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('Abiball unter dem Motto „Casino Royale"',
   'Mit Smoking, Abendkleid und viel Konfetti feiert der Jahrgang seinen Abschluss im Festsaal — bis tief in die Nacht.',
   'schueler', 'Abi 2024', null, 2024, 6, 21, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78'),

  ('40 Jahre nach dem Abi: Spende für die Schulbibliothek',
   'Der Jahrgang von 1985 sammelt bei seinem Jubiläumstreffen für neue Bücher und einen Lesesessel in der Schulbibliothek.',
   'ehemalige', 'Abi 1985', null, 2025, 3, null, false,
   'b68a0806-c95d-4ca8-ab19-bda47600ff78');
