# Idéhjælp og lokal netværksrapport

Godkendt af ejeren 26. oktober 2026 via prøven `aura-ui/idea-network-20261026/`. Ændringen er implementeret i kildekoden, men endnu ikke udgivet i en DMG.

## Det brugeren ser

- Idéhjælpen viser forberedelse, kontrol af forbindelse og dataregler, afsendelse, ventetid, modtagelse og klargøring. Modtager, model og eventuel rute står ved status. Detaljer viser målte tider og faktiske modelkald. Der vises ingen private modeltanker eller gættet køplacering.
- En formatrettelse vises som højst ét ekstra kald til samme valgte AI. Den kræver samme kontroller som det oprindelige kald. Stop bevarer brugerens tekst og afviser sene hændelser. Terminalmålinger returneres også med resultatet, så hændelser og IPC-svar ikke kan efterlade en færdig opgave med en gammel ventestatus.
- **Tilføj forbindelse** åbner den eksisterende sikre formular. Gem og Annuller returnerer til idéen med kladde, forslag og modelvalg bevaret. Den nye forbindelse vælges ikke automatisk. Hvis idéhjælp og kommende projekt bruger forskellige forbindelser, står det udtrykkeligt.
- **Aktivitet → Dan rapport** viser registrerede Aura-kald med periode-, type- og statusfilter. CSV og JSON gemmes lokalt via systemets Gem-dialog. Eksporten indeholder filter, dækning og målebegrænsninger.

## Hvad rapporten kan dokumentere

Journalen registrerer ved det konkrete transportkald, efter eventuelle dataregler har tilladt afsendelse. En handling, der blokeres før transporten, tælles derfor ikke som et sendt netværkskald. Registreringen giver ingen nye tilladelser og ændrer ikke model, rute, genforsøg eller godkendelsesregler.

| Vej | Dækning |
|---|---|
| Modelgateway | HTTP-forsøg, status, genforsøg, observerede body-bytes og målte tider |
| Idéhjælp | Første kald og særskilt formatrettelse, status, Stop og målte tider |
| Model-/rutekatalog | Kald gennem Auras katalogfunktion; automatisk lokal opdagelse er ikke fuldt dækket |
| ExternalEgress | Konkret afsendelse og svarheaders; komplet body og svartid er ukendte uden læsermåling |
| Preview, Git, opdateringer og underprocesser | Endnu ikke fuldt registreret; vises som ukendt dækning |

Det er ikke en log over hele computerens trafik. Redirects, DNS, UDP og uregistrerede processer kan ikke tælles fuldstændigt. En loopbackadresse beviser kun lokal transport, ikke hvor en modelserver senere behandler data.

Målinger er forskelligartede: `headersMs` er tid til HTTP-svar, `firstBodyMs` er første observerede indholdsbytes og `totalMs` er det målte transports afslutning. Første bytes er ikke nødvendigvis et teksttoken. `sentBytes` er kendt request-body-størrelse, ikke bevis for modtagelse eller krypterede netværksbytes. Ukendte målinger forbliver `null`; nul vises kun når det er målt.

Journalen gemmer højst 2.000 poster i den aktuelle Aura-profils `harness/network-journal/requests.json`. Den indeholder værtsnavne, klassifikation, status, tider og størrelser; ingen beskeder, nøgler, headers, URL-stier, query-parametre, filindhold eller rå fejl. Metadata skrives privat og atomisk. Lagringsfejl stopper ikke opgaven og vises i rapporten. Denne appkørsels start er adskilt fra journalens historiske start.

## Afprøvning

Kørt med den pakkede Node 22.23.3-runtime på macOS, baseret på `7d6bc72` med de lokale ændringer:

- Samlet `scripts/check.cjs`: **2.033 bestået, 32 eksplicitte spring over, 0 fejl** i den sidste fulde kontrol før commit. Stop-timeren og timeout-klassifikationen er med i denne kørsel. TAP-log er bevaret lokalt.
- Backend: timeout registreres som fejl, mens eksplicit Stop registreres som afbrudt. Regressioner dækker både timeout før headers og under modtagelse. Original Response/stream bevares, ingen ekstra await mellem Privacy Gate og transport, intet kald ved blokering, særskilt formatkald, 429/5xx og retries, Stop, bounds, privat lagring, genstart og whitelist ved journalimport.
- UI: produktscripts med kontrolleret DOM/IPC tester sene hændelser, korrekt terminalstatus, annullering, bevaret kladde/modtager, luk/genåbn, filtrering og eksport uden HTML- eller formelinjektion.
- Faktisk Electron-app i separat profil, med en lokal HTTP-prøveserver: 15 sekunders forsinkelse, et bevidst fejlformateret svar, ét formatkald, korrekt afsluttet status og særskilt Stop. Gem/Annuller af forbindelse bevarer idéen. Et isoleret prøveprojekt åbnes, og rapporten filtreres samt eksporteres gennem native Gem-dialoger.
- Eksportkontrol: CSV indeholder præcis de tre valgte idékald, inklusive formatrettelse og afbrydelse. JSON og journal har korrekte optællinger, ukendte målinger og dækningsoplysninger. Ingen testbeskrivelse eller modelsvar findes i journalen. Filerne oprettes med private rettigheder på Mac.

Prøveserveren er syntetisk; dette er ikke en ny test mod Mistrals eller Cortis produktionstjenester. Den eksisterende Mistral-samtale er undersøgt separat via lokale tids- og forbrugsfelter, uden nye AI-opgaver eller nøglelæsning. Ændringen gør ventetid synlig; den gør ikke i sig selv modellen hurtigere. Idéhjælpen afventer fortsat et samlet svar. Et katalogkald, der allerede er startet, kan ikke afbrydes via idéhjælpens Stop; resultatet ignoreres, og der startes ingen efterfølgende trin.

Skærmbilleder, TAP-logs, native prøvefiler og Mistral-analysen ligger lokalt under Auras Diagnostics-mappe for `idea-network-20261026`. Brugerens installerede app og rigtige projekter er ikke ændret. Ændringen afleveres som kildekode til ejerens fork efter lokal kontrol. Afprøvningen omfatter ingen GitHub Actions eller ny DMG/release; den installerede app opdateres derfor ikke af dette push.
