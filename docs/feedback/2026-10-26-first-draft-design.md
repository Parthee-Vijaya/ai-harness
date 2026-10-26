# Design fra første udkast — skills og rigtig Mistral

## Problem og ændring

Den undersøgte aktivitetskalender modtog allerede Aura-design-skillens hovedtekst. Modellen hentede imidlertid ikke dens konkrete designreferencer før første udkast. Den lokale kvalitetskontrol målte tekniske fejl, men gav ingen konkret feedback om de gentagne dekorative flader og den uleverede typografi. Eksisterende genereret HTML blev desuden beskrevet som et allerede godkendt design.

Denne ændring giver modellen mere brugbart materiale og konkrete observationer. Modellen vælger stadig selv palette, layout, typografi og komponenter gennem skills. Aura installerer ikke et fælles tema eller en fast kommuneskabelon.

- Tre komplette, korte referencer følger med før første idé-, plan- og byggeforsøg: designbrief, brandkilder og komponentinspiration. Deres præcise indhold indgår i den eksisterende kontekstgennemgang og dens fingeraftryk. Aktuelt fylder pakken 10.199 UTF-8-bytes; loftet er 12 KiB samlet og 8 KiB pr. fil. Store eller manglende referencer markeres og udelades helt, frem for at blive klippet midt i en instruktion. Hovedskillen og projekttilpasninger bevares.
- Brandvejledningen kræver faktisk undersøgte kilder og leverede logo-/fontfiler eller ærligt angivne erstatninger. Et fontnavn i CSS er ikke en installeret font, og et bogstav i en farvet kasse er ikke et officielt logo.
- Genererede filer bliver ikke automatisk kaldt brugergodkendt design. Brugerens konkrete designvalg og godkendte retning har fortsat forrang. Eksisterende projekter må kun ændres inden for brugerens opgave.
- Den isolerede lokale browser måler tre afgrænsede signaler: mulig fontfallback, gentagne store gradientflader med meget lidt indhold og manglende synlig hovedoverskrift. Almindelige kort og lister er tilladt. Målingerne foreskriver intet bestemt design.
- Kun den første byggeopgave fra Auras uændrede startside kan få ét ekstra designgennemsyn. Det bruger den samme model, opgave, session, plan og eksisterende værktøjsgodkendelser. Gennemsynet tæller med i det eksisterende loft på to samlede rettelsesforsøg. Stop, afvisninger og ændringer i plan, regler eller filer stopper automatisk fortsættelse.

## Hvad der fortsat bevares

Auras UI, onboarding B og YOLO er uændret. Ingen nye netværksrettigheder, leverandørskift, automatiske downloads eller værktøjstilladelser indføres. Nøglen forbliver i main-processen. Den nye model-feedback består alene af faste beskrivelser og begrænsede tal; den sender ikke sidetekst, fontnavne, vilkårlige fejlmeddelelser eller screenshots. Privacy Gate og eksisterende isolationskrav gælder fortsat.

Der er ingen ny afhængighed. Desktopappens installationspakke og versionsnummer ændres ikke i denne kildeleverance. De eksisterende downloadbare skillpakker er regenereret fra kilderne.

## Afprøvning

Den samlede lokale `scripts/check.cjs` består med 2.089 tests: **2.057 bestået, 32 eksplicit sprunget over, 0 fejl** på macOS med Node 22.23.3. GitHub CI, Windows og en ny DMG er ikke afprøvet i denne kildeleverance.

Enhedstests dækker referencebudgetter og Unicode, obligatorisk skillgrundlag, præcis kontekstbinding, generation kontra godkendelse samt én designrunde med bevarede Stop-/plan-/afvisningsgrænser. Rigtige lokale Electron-prøver dækker renderede fonte og gradientflader, almindelige kort, blokerede eksterne ressourcer og de eksisterende tekniske appkontroller. De lokale fixtures er syntetiske og bruger ingen model.

Den faktiske tidligere Kalundborg-app blev også kontrolleret uden ændringer i originalen. De eksisterende tekniske fund var tomme; de nye målinger fandt **2 fontfallback-indikationer og 12 sparsomme gradientpaneler**, mens hovedoverskriften korrekt blev fundet. Fire public-filer på 60.009 bytes havde identisk samlet hash før og efter.

Den samlede test fandt først en manglende læsetilladelse til den nye betroede målefil i udviklingsversionens isolerede renderer. Den præcise fil blev tilføjet til den eksisterende liste; der blev ikke givet adgang til hele kodemappen. Alle seks native isolationsprøver består derefter, inklusive netværksblokering, beskyttelse af originalfiler og Stop. Skillpakkerne er regenereret fra de opdaterede kilder, og reproducerbarhedstesten består.

En særskilt rigtig Mistral-prøve anvender native Workbench → gateway → OpenCode med `mistral-large-4-0`. Den oprindelige opgave er:

> lav en landingpage til kalundborg kommunes aktivtets kalender for familier

Prøven tilføjer en eksplicit ramme for en lokal demo, søgning/filtrering, detaljer og lokale tilmeldinger samt en officiel brandreference. Den tilfører ingen hånddesignet palette, komponentkode eller layout. Planen skal være konkret og godkendes før bygning. Ingen reserveudbyder anvendes. Tidligere produktforsøg havde ikke præcis samme prøveinstruktioner; dette er derfor en funktionel regression og visuel sammenligning, ikke et kontrolleret A/B-bevis for hver ændrings isolerede effekt.

### Første reelle forsøg

Prøven nåede grænsen på 25 samlede modelkald, før modellen afsluttede byggeopgaven. Det er **en fejlet modelgennemførelse**, selv om appen var skrevet. Planen tog 59,5 sekunder og byggeforsøget 404,7 sekunder. Samlet rapporteret forbrug var 196.407 inputtokens, 47.572 outputtokens, 2.147.892 cachelæste tokens og cirka 0,77 USD. Der var ingen automatisk leverandørreserve og ingen manuelle kode-/designrettelser.

Det bevarede resultat består 11 efterfølgende browserchecks: blandt andet søgning, tomt søgeresultat, kombinerede filtre, detaljer, lokal tilmelding, bevarelse efter genindlæsning, tilmeldingsoversigt, afmelding og mobilforløb. Selectors blev tilpasset den faktiske DOM efter generering; brugerforløbene var angivet på forhånd. Denne browserafprøvning gør ikke den afbrudte modelkørsel bestået.

Visuelt er farverne mere afdæmpede og gradientblokkene væk. Det er fortsat ikke færdig polering: en datomarkering overlapper kategoriteksten, og tilmeldingsknappen bliver meget sparsom på mobil. Produktets automatiske kvalitetsrunde blev ikke nået. Screenshots fra dette forsøg må derfor ikke kaldes resultat efter Auras kvalitetsloop.

Prøvens tilladelser var strammere end almindelig gennemgang: projektrodens læsning, en afkortet webfetch-returfil og CDN-kilden blev afvist. Et andet separat forsøg fik et loft på 45 samlede kald/20 minutter pr. trin, læsning af sit eget syntetiske projekt og verificerede egne tool-output samt `cdn.kalundborg.dk`, som [kommunens officielle hjemmeside](https://www.kalundborg.dk/) selv linker til. Disse ændringer gælder prøven; produktets grænser og godkendelser ændres ikke. Værktøjets startadresse godkendes, men prøven dokumenterer ikke selvstændig kontrol af hele redirectkæden. OpenCodes særskilte krav om ekstern mappeadgang blev fortsat afvist; adgang til afkortet webfetch-output blev derfor ikke opnået alene med den snævre læseregel.

### Andet forsøg med rigtig Mistral

Mistral afsluttede normalt med **35 rapporterede modelkald**, heraf én afsluttet komprimering. Første plantrin tog 16,6 sekunder og krævede ét præciseringstrin på 83,1 sekunder før en konkret plan kunne godkendes. Bygningen tog 1.011,0 sekunder, cirka 16 minutter og 51 sekunder. Samlet rapporteret forbrug var 573.614 inputtokens, 120.038 outputtokens, 3.047.276 cachelæste tokens og anslået **1,71 USD**. Oprindelige brugerindstillinger var uændrede. Ingen kode eller design blev rettet manuelt, og modellen blev ikke udskiftet.

Modellen valgte selv en kalender i rækker, cremefarvet introduktion, serifoverskrifter, systemfont til brødtekst og tydelig demomarkering. Den hentede et officielt SVG-logo og beskrev ærligt, at den officielle font ikke var verificeret. Aura leverede metoden og kilderammen; denne palette og komposition var ikke indsat som skabelon.

Produktets egen isolerede kvalitetskontrol kørte én gang på desktop og mobil. Den fandt ingen tekniske fejl og ingen af de tre nye designindikationer. Der var fortsat **3 fund af lille tekst og 3 fund af små betjeningsfelter**. Disse fund udløser ikke automatisk reparation, og der blev ikke sendt en modelrettelse. Prøven havde også afvist kommando-/ekstern mappeadgang; vagten mod automatisk fortsættelse efter en afvist handling er bevaret. Kontrollen kalder fortsat ikke designet æstetisk godkendt.

Ventetiden er en væsentlig begrænsning. Et stort buildkald tog cirka 250 sekunder, og modellen komprimerede samtalen undervejs. Kommunens stylesheet var 4.782.255 bytes og blev hentet to gange; modellen fik kun en afkortningshenvisning på 341 bytes pr. gang. Forsiden blev afkortet fra 112.786 til 15.192 bytes. SVG-svarene var cirka 16,5 kB. Disse observationer viser lange modelkald og ekstra arbejde med kildemateriale; de beviser ikke, at den nye referencepakke alene forårsagede ventetiden.

Alle **12 særskilte browserkontroller består**: de samme 11 aftalte forløb samt tom formular med fejlbeskeder. Søgning, kombinerede filtre, detaljer, lokal tilmelding, genindlæsning, tilmeldingsoversigt, afmelding og mobilforløb virker. Der var ingen konsolfejl eller -advarsler under denne afprøvning. Selectors blev tilpasset den genererede DOM; forventede brugerforløb var angivet før generering. Alle fem appfiler havde samme hash ved produktkontrollen og efter den afsluttende browserprøve.

De native topbilleder er gemt som `mistral-reviewed-run-2/quality/0b7a1931-c069-4f46-bef4-241d4a289667/desktop.png` og `mobile.png`. `browser-evidence/desktop-activity-list.jpg` og `mobile-activity-list.jpg` viser den faktiske aktivitetsliste. Billeder og rå prøvebeviser ligger lokalt under opgavens `design-first-draft-implementation-20261026`-diagnostik sammen med `design-comparison.html`; de er ikke lagt i Git. Den visuelle gennemgang finder fortsat en konkret restfejl: metadata-labels og værdier mangler mellemrum, fx “Tidspunkt15.00–16.30”. Det beståede brugerflow er dermed ikke en godkendelse af fuld designpolering.

## Begrænsninger og risiko

De tre målinger er ikke en æstetisk dommer. Rapporten beholder `visualDesign: not-reviewed`, og et tomt sæt observationer betyder ikke, at designet er flot eller alle funktioner virker. Fontmålingen er et tegn på fallback, ikke et bevis for en bestemt fontfil. Målingerne gælder den eksisterende isolerede statiske `public/`-kontrol; eksterne, manglende ressourcer gør resultatet utilstrækkeligt frem for at udløse en blind designrettelse.

Referencepakken øger promptens størrelse, og et faktisk designfund kan udløse ét yderligere modelkald med pris og ventetid. To forsøg med samme model på én opgave kan ikke dokumentere ens kvalitet på tværs af modeller eller gentagne kørsler. Den første prøves overlap mellem datomarkering og kategoritekst blev ikke fanget af de tre nye signaler; sådanne fund kræver fortsat en konkret visuel gennemgang.

Tilbagerulning: revert denne afgrænsede kildeændring. Der er ingen datamigrering, nye gemte tilladelser eller brugerdata, der skal tilbageføres. Genererede projekter og deres filer bevares.
