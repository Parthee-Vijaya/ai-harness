# Hovedskill til bygning · 24. oktober 2026

Tidligere var Aura-design tilgængelig for agenten, men modellen skulle selv vælge at hente den. Nu følger den effektive hovedfils instruktioner direkte med ved første modelkald i idéhjælp, planlægning og bygning. Lang vejledning, brandmetode, tokens og eksempler er fortsat referencer efter behov.

## Hvad en kort idé skal føre til

Brugeren skal kunne skrive “En app til at melde sig til borgermøder i Nyborg Kommune”. Modellen får en metode til at foreslå og bygge et sammenhængende forløb: oversigt, filtrering, detaljer, tilmelding og afmelding. Den vælger reversible designdetaljer og stiller kun spørgsmål, som ændrer løsningen væsentligt. Delt lagring og reelle tilmeldinger skal afklares; fiktive møder mærkes som eksempler. En selvtegnet identitet må ikke præsenteres som kommunens officielle logo.

Skillen kræver også funktionelle tilstande, responsive visninger, tastaturbetjening og en ærlig afleveringsrapport. Eksemplets grønne palette er ikke en universel skabelon. Andre opgaver får deres egen begrundede retning.

## Før og efter

| Situation | Før | Nu |
|---|---|---|
| Første byggeanmodning | Modellen kan hente designskillen | Kernen er allerede med i modelkaldet |
| Model med svag skilludvælgelse | Kan springe metoden over | Behøver ikke foretage et skillkald for at modtage kernen |
| Idéhjælp | Kort generel idéinstruktion | Samme designmetode, begrænset til beskrivelse og plan |
| Projekttilpasning | Læses via skill-værktøjet | Den faktisk tilpassede hovedfil indlæses direkte |
| Design fravalgt | Ingen designskill | Stadig ingen designskill eller ekstra kerne |
| Eksport til kodeværktøjer | Generel liste over skills | Eksplicit henvisning til hovedskillen ved byggeopgaver |

Dette ændrer modelinstruktioner, ikke Auras layout. Der er derfor ingen før/efterbilleder af værtsappen. Brugerens Promte-screenshot er en kvalitetsreference; det er ikke et resultat genereret af denne ændring. Der er ikke kopieret privat workspacehistorik eller screenshot ind i biblioteket.

## Bevarede grænser

- UI, onboarding, værktøjstilladelser, planer, modelvalg og dataregler bevares.
- Almindelig samtaletilstand tvinges ikke over i bygning.
- Globalt/projektvist fravalg og eksisterende skilltilpasninger gælder stadig. Idéhjælpen læser kun globalt valg, aldrig et andet projekts tilpasninger.
- Det præcise tekstfragment indgår i den eksisterende kontekstgennemgang og dens kontrolsum. Ændringer efter gennemgang afvises før afsendelse.
- Eksportfiler bevarer brugerens egne instruktioner og den eksisterende kontrollerede installationsmetode.
- Instruktioner kan forbedre arbejdsmetoden; de er ikke adgangskontrol eller en kvalitetsgaranti.

## Verifikation

`desktop/tests/build-design.test.cjs` kontrollerer aktivering, fravalg, projekttilpasninger, isoleret kontekst før projektoprettelse, ugyldig hovedfil og eksportpakker. `app-context.test.cjs` kontrollerer præcise gennemgåede/afsendte instruktioner i plan/build/free for begge udbydere og afvisning af ændrede valg. `idea-refinement.test.cjs` kontrollerer idéhjælp mod en lokal HTTP-server, genbrug af historik, afbrudte kald, ændrede instruktioner og alle understøttede API-formater uden værktøjer.

`desktop/scripts/verify-primary-build-skill.cjs` kører rigtig Workbench → OpenCode 1.18.33 → Mistral-/Corti-adapter → gateway → kontrolleret lokal HTTP-server. Den undersøger første faktiske modelanmodning, før noget skill-værktøj er kaldt. Seks scenarier dækker begge udbydere, planlægning, direkte bygning, fravalg og Auras CLI. Alle bruger syntetiske svar og sletter deres egne midlertidige profiler bagefter.

De konkrete resultater står i [primary-build-skill-validation.json](primary-build-skill-validation.json). Dette er lokal verifikation; der er ingen ny hosted CI-kørsel, DMG eller release.

## Prøvegrundlag for rigtig modelkvalitet

En senere prøve med de rigtige modelkonti skal bruge samme korte opgave, kendte modelversioner, ens featurevalg og de normale godkendelser. Gem det faktisk sendte materiale, forbrug og tilladte screenshots lokalt. Prøv mindst:

1. **Borgermøder:** søg/filter, tomt resultat, mødedetaljer, tilmeldingsvalidering, egne tilmeldinger/afmelding og tydelig demogrænse. Ingen officielt logo uden leveret kilde.
2. **Intern lokaleoversigt:** tilgængelighed, reservation, konflikt og aflysning. Delt datalagring skal afklares; en lokal demo må ikke foregive koordinering mellem kolleger.
3. **En eksisterende hjemmeside:** ret én funktion uden at udskifte godkendt design, navigation eller øvrige funktioner.

Vurder faktisk funktion, visuelt hierarki, produktpassende udtryk, tekst og tilstande, mobil/tablet/desktop, tastatur, fejl og ærlig afrapportering. Se renderingen og afprøv handlingerne; modelbeskrivelsen er ikke bevis. Sammenlign gerne før/efter med samme opgave og model, men gentag ved store variationer. Transportprøverne ovenfor dokumenterer ikke kvaliteten fra en live Mistral- eller Corti-model. Ingen sådanne betalte modelkald er udført i denne ændring.
