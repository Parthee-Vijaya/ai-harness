# Mønstre og tilstande

Konkrete mønstre til den app, du bygger. Tilgængelighedskravene står i tjeklisten, `tilgaengelighed.md`.

## Tilstande

- Hver visning har en tilstand for indlæser, tom, fejl og data. Tag også manglende adgang, data der kun delvist er tilgængelige, og en langsom forbindelse med.
- Indlæsning må ikke ligne et tomt resultat.
- Eksempeldata må ikke fremstå som rigtige data. Mærk dem "eksempel", og skriv fx "Intet sendes", når en formular kun er en demo.
- Vis forskel på gemt lokalt, sendt og modtaget eller godkendt af en modtager.
- `localStorage` er hverken delt lagring eller login. Lov ikke, at løsningen overholder GDPR.
- Vis ingen succesbesked, før handlingen er udført, og lad ingen knap være uden funktion.

## Formularer

- Brug den rigtige inputtype og `autocomplete`. En pladsholder er aldrig den eneste label.
- Spørg kun om nødvendige oplysninger, og forklar, hvad der sker efter indsendelse.
- Kobl hjælpetekst og fejl med `aria-describedby`, og sæt `aria-invalid` på felter med fejl.
- Validér ved indsendelse, flyt fokus til den første fejl, og fjern en fejl, så snart feltet er rettet. Brugerens indtastning bevares.
- Gruppér relaterede felter med `fieldset` og `legend`. Brug radioknapper frem for en rulleliste, når der er få korte valg.
- Nulstil fjerner også fejlmarkeringer.
- Vis tal og datoer med `Intl.NumberFormat` og `Intl.DateTimeFormat` og `da-DK`.
- CPR-numre står aldrig i adresser, fejltekster eller log.

## Søgning og filtre

- Filtre har tydelige labels og viser, når de er aktive.
- Vis antallet af resultater, når det hjælper, og giv mulighed for at nulstille.
- Et tomt resultat forklarer, hvorfor det er tomt, og hvad man kan gøre.

## Tabeller og grafer

- En tabel har de fire tilstande ovenfor og `aria-busy`, mens den indlæser.
- En bred tabel står i en rulningsregion, der kan få fokus og har et navn.
- En graf har et tekstalternativ med de vigtigste tal.

## Fejlbeskeder

En fejlbesked svarer på tre spørgsmål: Hvad gik galt? Er brugerens arbejde bevaret? Hvad kan brugeren gøre nu?

Undgå "Der opstod en fejl" uden næste skridt, at give brugeren skylden, overdreven begejstring ved almindelige handlinger og påstande, systemet ikke kan dokumentere. Tekniske koder står bag Se detaljer.

## Layout

- Brug grids med `minmax(0, 1fr)`, så indhold ikke presser kolonner ud. Navigationen bevares på små skærme.
- Billeder har `width` og `height`, så layoutet ikke hopper under indlæsning.
- Lange danske ord brydes med `overflow-wrap: anywhere`.
- Et gitter med felter i forskellige størrelser bevarer rækkefølgen i HTML og bruger hverken tæt pakning eller faste højder.

## AI-funktioner i den app, du bygger

- Vis, at indholdet er lavet af AI og kan være forkert.
- Behandlingsstedet kommer fra konfigurationen, ikke fra en antagelse.
- Status kommer fra det faktiske forløb og ikke fra en animation med fast tid: klar, i kø, kører med mulighed for stop, afventer godkendelse, færdig, fejl eller delvist færdig og stoppet. Forhindr dobbelte indsendelser. Et stop påstår ikke, at noget er rullet tilbage.
- Rul kun automatisk, når brugeren følger med i bunden, og vis ellers "Vis seneste".
- Vis et værktøjskald som et kort resumé og ikke som rå data.
- Brug `aria-live` med måde, og del aldrig automatisk med en skytjeneste.
- En kommandopalet må ikke være den eneste vej til en handling. Lukkede paneler fjernes fra fokus med `hidden` eller `inert`.

## Bevægelse

- Bevægelse forklarer en ændring. Brug `transform` og `opacity`, og hold den kort.
- Ved reduceret bevægelse bevares statusteksten. Sæt bevægelse på pause, når siden er skjult.
- Højst ét lag med vedvarende bevægelse. Bevægelse, der kører mere end fem sekunder af sig selv, kan sættes på pause, og intet blinker.
- Pynt får `aria-hidden="true"`, ingen `pointer-events` og intet tabulatorstop. Tekst og formularer står på faste flader.
- Ingen partikelscener eller lange introer i almindelige formularer.
- En fast flade på 1920 × 1080 bruges kun til slides og aldrig til et applayout. Slides kan skiftes med piletaster, knapper og nummer, og genveje overtager ikke input i formularer.

## Offentlige løsninger

- Lever skrifter, ikoner og scripts fra projektet. Eksterne ressourcer giver netværkskontakt til en tredjepart.
- Brug kun lokal lagring til fx tema og kladder. Et valg af tema giver ikke ret til sporing.
- En demo må ikke kunne forveksles med en myndigheds login, betaling eller MitID.
- Valg af AI-modtager og deling af data er særskilte valg, og en model i EU er ikke en databehandleraftale.
- Skærmbilleder og rapporter er også omfattet af reglerne for data. Brug syntetiske data.
- En scanning, der ikke er kørt, tæller ikke som bestået.
- Målgruppen ændrer kravene. Sundhed, økonomi og sagsbehandling har særlige regler.

Mønstrene bygger på Aura Design af Parthee Vijayamohan (bidrag #23 til Aura Harness, EUPL-1.2), omskrevet og forkortet 26. oktober 2026.
