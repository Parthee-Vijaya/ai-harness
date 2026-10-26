# Unparalleled i Aura-design: kontrolleret Mistral-prøve

## Formål og afgrænsning

Brugeren har bedt om et gennemarbejdet første fundament, som gerne må kræve flere interne arbejdstrin. Modellen skal fortsat designe gennem skills. Ændringen tilpasser udvalgte principper fra [Unparalleled](https://github.com/Phantom-Con-Artist/unparalleled-skillset) til Auras eksisterende hovedskill. Den låste kilde er revision `8558a27e9a3668326f2f6b48dd475a3920d10194`, MIT, Subhradeep Sarkar. Fuld licens og kildeproveniens følger med.

Opgavens formål styrer kompositionen. Modellen beskriver et konkret indholdshierarki, bygger ét sammenhængende brugerforløb og afprøver det, før mønstret gentages. Visuel gennemgang skal bygge på faktisk sete billeder og have et fast stop. Kort, fonte, farver og layout vælges stadig af modellen efter opgaven og verificerede brandkilder. Ingen fast palette, kommuneskabelon, installer eller browserpakke tilføjes.

Auras UI, onboarding B, motor, planer, godkendelser, YOLO og dataregler er uændrede. Brugerens oprindelige `webapp-craft.md` er byte-identisk. Skillens metode indfører ikke en automatisk billedpipeline i produktet. Prøvens billedrunde bruger den eksisterende vedhæftnings- og godkendelsesvej og omfatter kun de syntetiske prøveapps.

## Fastlagt sammenligning

Begge arme bruger samme Aura-kode fra `96a91cb`, OpenCode 2.1.4 og rigtig `mistral-large-4-0` gennem Electron → Workbench → Privacy Gate → gateway → OpenCode. Før-armens bibliotek er hentet fra kildecommittet; efter-armen bruger det frosne, tilpassede bibliotek. Kun fem filer i Aura-designskillen adskiller bibliotekerne.

Den ordrette opgave er:

> lav en landingpage til kalundborg kommunes aktivtets kalender for familier

Begge får samme ramme: en lokal demo med fiktive aktiviteter, søgning, kategori-/aldersfiltre, detaljer, lokal tilmelding, liste og afmelding. Ingen reel booking, betaling, login eller kommunal integration. Brandresearch må bruge de samme officielle Kalundborg-adresser. Der leveres ikke en facitpalette, et layout eller menneskeskrevet kritik af den konkrete side.

- Separate nye projekter, profiler og samtaler, kørt efter hinanden.
- Samme grænse på **45 faktiske modelanmodninger inklusive genforsøg** og **1.200 sekunder pr. tur**. Det er et kaldsloft, ikke et identisk tokenforbrug eller dollarloft.
- Plan først, konkret plangodkendelse før filændringer. Ingen ændringer under planlægning.
- Samme begrænsede engangsgodkendelser; kommandoer, Git og uvedkommende filer afvises.
- Samme mulighed for én billedgennemgang og én rettelsesrunde, hvis bygningen afsluttes normalt og højst 40 kald er brugt. De samme 45 kald dækker hele forløbet.
- Billedgennemgangen beder samme Mistral-model om højst tre problemer i forhold til dens egen godkendte retning. Den kræver en ny konkret plan før rettelse.

Modellen bestemmer data og detaljer inden for samme opgave. Derfor har før-versionen tilmelding med ét klik, mens efter-versionen selv valgte en formular. Funktionstestens krav var fastlagt før generering; selectors er tilpasset den faktiske DOM bagefter. Der er én kørsel pr. arm, ingen statistisk sikkerhed og ingen manuel rettelse af genereret appkode.

### Hvilken designhjælp modellen faktisk fik

Efter-armens systemkontekst indeholder den ændrede hovedskill samt de fuldt indlæste referencer `design-brief.md`, `brand-discovery.md` og `component-inspiration.md`. Den tilpassede korte Unparalleled-metode er dermed medleveret. Den længere `unparalleled-method.md` er tilgængelig som reference, men ikke automatisk indlæst. Et read-only opslag i den isolerede OpenCode-sessions værktøjsmetadata viser ingen skill-kald eller læsning af denne reference under første udkast. Det er ikke en prøve af fuld indlæsning af Unparalleled-pakken. At instruktioner er leveret, dokumenterer heller ikke, at modellen efterlever dem.

## Første udkast: målte resultater

| Måling | Før | Med Unparalleled-tilpasning |
| --- | ---: | ---: |
| Plan | 69,102 s | 69,623 s |
| Bygning inkl. produktets lokale kontrol | 282,803 s | 246,816 s |
| Plan + bygning | 5 min 52 s | 5 min 16 s |
| Faktiske modelanmodninger | 36 | 25 |
| Anslået samlet pris | 0,90893 USD | 0,77993 USD |
| Inputtokens | 223.376 | 242.091 |
| Outputtokens | 35.764 | 29.537 |
| Cachelæste tokens | 3.254.576 | 2.337.292 |
| Browserkontroller | 10 bestået, 1 fejl, 1 ikke relevant | 10 bestået, 2 fejl |

Forbruget i faserne er kumulativt og er ikke lagt sammen igen. Prisgrundlaget fra det faktiske modelkatalog er pr. million tokens: input 1,36 USD, output 4,18 USD og cachelæsning 0,14 USD. Prisen er Auras estimat, ikke en faktura. Opstart/afslutning ligger ud over tabellens plan- og byggetid; de oprindelige samlede kørsler tog henholdsvis 6 min 04 s og 5 min 18 s.

### Funktion og udseende før

Søgning, kombinerede filtre, nulstilling, detaljer, lokal tilmelding, genindlæsning, oversigt og afmelding virker. Der er ingen formular, og opgaven kræver ikke personfelter; feltvalidering er derfor ikke relevant og tælles ikke som bestået.

Mobilheaderen er 543 px bred ved en 390 px skærm. Navigationen bliver afskåret. Auras lokale kontrol afslutter opgaven med en kvalitetsfejl. En tidligere afvist kommando gør, at den eksisterende vagt mod automatisk fortsættelse efter afvisning stopper reparationen. Den vagt er bevaret. Før-armen når derfor ikke den valgfrie billedrunde.

Screenshots viser en stor orange introduktion, gentagne emojiillustrationer og en tung top, der skubber aktiviteterne ned. Dette er ikke et poleret designresultat, selv om hovedfunktionerne virker.

### Funktion og udseende efter, før billedgennemgang

Mobilbredden fungerer. Detaljedialogen understøtter Escape og returnerer fokus. Formularen validerer manglende oplysninger, og tilmeldinger bevares efter genindlæsning.

Der er to reelle fejl: Afmelding bruger `window.confirm()`, som Auras eksisterende preview-sandbox blokerer, og logo/header/footer/favicon afhænger af eksterne ressourcer, som previewets politik blokerer. Ingen ekstern browsertrafik slipper ud. Der er CSP-fejl, men ingen JavaScript-undtagelser i de afprøvede forløb.

Produktets egen kontrol registrerer tre kontrastfund og blokerede eksterne ressourcer. Den markerer kontrollen som utilstrækkelig (`unsupported`); en normalt afsluttet modeltur er derfor ikke et bevis for et fejlfrit resultat. Screenshots viser fortsat en stor orange introduktion og gentagne gradient-/emojikort. Første udkast dokumenterer **ikke et overbevisende designløft**.

## Billedgennemgang og efterfølgende rettelse

Den første billedgennemgang stoppede før modelafsendelse ved den eksisterende kontrol af ændrede filer. Lokal reproduktion viser, at PNG-filernes `ctime` ændres få sekunder efter kopiering, mens indholdshash og `mtime` er uændrede. Den præcise baggrundsproces er ikke fastslået. Filkontrollen er ikke lempet. Oprindelige fejlbeviser og første udkast er bevaret; en særskilt genoptagelse må kun genvælge/gennemgå de samme billeder og fortsætte den eksisterende samtale inden for det oprindelige budget.

Genoptagelsen gennemgik og vedhæftede billederne igen gennem den normale kontrol. Den brugte samme projekt, samtale, OpenCode-session og oprindelige kaldstæller. Ingen første plan eller bygning blev gentaget. Request 26 fik HTTP 200 og indeholdt præcis de to normaliserede billedhashes fra gennemgangen. De følgende billedbærende kald indeholdt de samme billeder. Modellen så altså faktisk screenshots; dette er ikke alene en instruktion om at forestille sig siden.

Mistral udpegede selv det manglende logo, den høje introduktion og den ubalancerede mobilnavigation. Dens nye konkrete plan blev godkendt før rettelse. Produktets lokale kontrol fandt efter rettelserne stadig lav kontrast. Forløbet stoppede under videre arbejde ved det oprindelige loft på **45 faktiske modelkald**. Der blev ikke afsendt et 46. kald, nulstillet budget eller skiftet model. Den sidste projekttilstand og alle førsteudkastbeviser er bevaret.

| Efter-armens samlede forløb | Måling |
| --- | ---: |
| Første plan + bygning | 316,439 s |
| Billedgennemgang og ny plan | 36,634 s |
| Rettelse inklusive lokal kontrol frem til budgetstop | 370,202 s |
| Samlet tid i modelarbejdstrin | 12 min 03 s |
| Samlede faktiske modelkald | 45 |
| Samlet anslået pris | 1,94446 USD |
| Heraf merpris for billedrunde og rettelse | 1,16453 USD |
| Samlede input-/outputtokens | 767.434 / 76.379 |
| Samlede cachelæste tokens | 4.153.468 |
| Afslutning | Ufuldstændig: kaldsbudget opbrugt |

Afprøvningens pause til lokal fejlsøgning af vedhæftninger indgår ikke i de 12 min 03 s. Rapporten viser den særskilt. Pris og tokens er det sidste kumulative resultat; faserne er ikke talt dobbelt.

Browserprøven af den stoppede revision giver **10 bestået og 2 fejl af 12 kontroller**. Logoerne vises nu fra lokale filer, mobilnavigationen har læsbare tekster, og introduktionen er lidt kortere. Afmelding fejler fortsat, fordi `window.confirm()` blokeres i previewets sandbox. Samme årsag får kontrollen for fejlfri konsol til at fejle; det er to fejlede kontroller med én fælles årsag. Der er ingen eksterne billedkald eller JavaScript-undtagelser. Appens JavaScript er byte-identisk med første efter-udkast. Browserprøven ændrer ingen kildefiler.

En særskilt afsluttende kørsel af Auras eksisterende lokale kvalitetskontrol mod det frosne slutresultat finder stadig tre kontrastproblemer på desktop og mobil. De sidste CSS-rettelser fjernede dem altså ikke. Kontrollen ændrede ingen kildefiler, brugte nul modelkald og er dokumenteret separat i `browser-evidence/after-final-local-quality/result.json`; den ændrer ikke optællingen af de 12 funktionstests.

Screenshots viser små forbedringer i logo og betjening, men stadig store orange flader, gentagne gradientkort og emoji som billedindhold. Det ønskede polerede fundament er **ikke opnået i denne prøve**. Den supplerende slutprøve må ikke forveksles med den sammenlignelige førsteudkaststabel: før-armen nåede ikke billedrunden. En enkelt prøve kan hverken bevise en generel kvalitetsforbedring eller måle den isolerede virkning af billedgennemgang.

## Vurdering

Tilpasningen giver modellen en konkret arbejdsmetode med et afgrænset review, og billedprøven viser, at Mistral kan udpege og rette nogle synlige problemer. Den dokumenterer samtidig, at flere instruktioner og én billedrunde ikke var tilstrækkelige til det ønskede resultat her. Modellen fik fx instruktionen om ikke at bruge emoji som primært billedindhold, men gjorde det alligevel. Afmeldingens funktionsfejl indgik ikke i modellens tre visuelle fund og blev ikke rettet.

Et næste sammenligneligt forsøg bør undersøge, om præcise resultater fra funktionstesten sammen med den visuelle gennemgang giver et bedre færdigt fundament inden for samme budget. Det er et forslag, ikke en implementeret automatisk funktion. Der bør fortsat skelnes mellem modelkvalitet, referenceadgang, faktisk efterlevelse og Auras lokale kontroller.

## Kildekontrol og bevaring

Den samlede lokale kontrol på macOS/Node 22.23.3: **2.057 bestået, 32 eksplicit sprunget over, 0 fejl** af 2.089 tests. De fokuserede designreference-/billedtests består 23/23. Pilotens seks kontroller omfatter faktisk kaldsloft, frosne biblioteker, billedstier, ny planidentitet og indholdsfrie netværksbeviser. De betalte modelkørsler er særskilte fra disse deterministiske tests.

Den første fulde kontrol fandt en for lang kilde-URL i den nye provenancefil. Linket blev ændret til repository-roden, mens den fulde låste revision står separat. Privacy Gate og dens tilladelsesliste blev ikke ændret. Efter-snapshottet blev genfrosset før dets første modelkald; den tidligere klargøringskopi er bevaret.

Alle 23 regenererede skillpakker er kontrolleret: ingen slettede entries, kildematch og korrekte manifesthashes samt fuld MIT-notice i hver pakke. Der er ingen nye afhængigheder. Hele den leverede designvejledning er 30.749 UTF-8-bytes mod 30.896 før, målt med samme `primaryBuildGuidance(context, 'build')`-valg. De tre medleverede korte referencer fylder 11.235 bytes, under loftet på 12 KiB.

Den oprindelige Aura-profils indstillinger er hashkontrolleret uændrede i begge kørsler og genoptagelsen. Funktionstestene ændrer ikke genererede kildefiler; de lokale prøveoplysninger ligger kun i testbrowserens lager. Ingen GitHub CI, Windowsprøve, DMG eller opdatering af den installerede Aura-app indgår i denne leverance.

Rå beviser, scripts, frosne inputs og screenshots ligger lokalt under `Diagnostics/unparalleled-ab-20261026/`: `METODE.md`, `ACCEPTANCE.md`, `before-run/`, `after-run/`, `browser-evidence/` og den klikbare `comparison.html`. Billeder og prøveprofiler lægges ikke i Git. Lokal kode, rapporter og prøveapps bevares.

Tilbagerulning er en revert af skillændringen og genopbygning af skillpakkerne. Der er ingen datamigrering eller ændrede gemte tilladelser.
