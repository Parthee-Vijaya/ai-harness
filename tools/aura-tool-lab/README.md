# Aura Tool Lab

Afprøvning af Apyhub og fire lokale tools til Aura Harness. De lokale tools er nu
integreret i desktopmotoren gennem Auras egne godkendelser og Privacy Gate.
UI-filerne er uændrede.

## Verificeret 28. oktober 2026

- EU-forbindelse til `https://mcp.eu.apyhub.com` gennem browserlogin med OAuth/PKCE.
- Faktisk MCP-katalog: `curated_apis`, `search_apis`, `get_api_spec`, `call_api`.
- Fem udførende API-kald: gyldigt og ugyldigt IBAN, dansk tekstdiff, JSON til CSV
  og CSV til JSON. Alle fem optagede svar består schema- og indholdskontrol.
- Fire lokale implementeringer består de samme fem cases gennem en rigtig
  MCP-proces. De bruger åbne biblioteker og ingen Apyhub-kode eller adgangsnøgle.
- 18 automatiske tests bestået under Auras Node 22.23.3. De otte tests af lokale
  tools består desuden under macOS-sandbox med netværk og filskrivning afvist.
- Afhængigheder er låst; `npm audit --omit=dev` viste nul kendte sårbarheder.

Dette er en afgrænset toolpakke. Fem cases dokumenterer disse eksempler, ikke
fuld funktionel lighed, en generel ydelsesmåling eller produktionskvalifikation.
Desktopintegrationen har sin egen native afprøvning. En lokal installationspakke
kvalificeres separat; denne opgave offentliggør ikke en GitHub-release.

## Lokale tools

| Tool | Funktion | Begrænsning |
|---|---|---|
| `aura_json_to_csv` | Flade JSON-rækker til CSV | Formellignende tekst beskyttes som standard; ændringer tælles |
| `aura_csv_to_json` | CSV til JSON | Celler bevares som tekst; dublerede og reserverede kolonnenavne afvises |
| `aura_text_diff` | Tegn-, ord- og linjediff | Ordstatistik tæller også mellemrum og tegn; ikke samme tællemetode som alle leverandører |
| `aura_validate_iban` | Struktur og kontrolcifre | Bekræfter ikke kontoens eksistens, ejer eller betalingsmulighed |

Alle fire arbejder i hukommelsen. De accepterer hverken filstier, vilkårlige URL'er
eller leverandørcredentials. Standardgrænser: 256 KiB samlet serialiseret input,
10.000 rækker, 200 kolonner og højst 250 ms til diffberegning. JSON-nøglerne
`__proto__`, `constructor` og `prototype` afvises for at undgå tavst datatab ved
schemafortolkning. JSON-null og manglende celler bliver tomme CSV-celler.

Maskinlæsbare input/output-kontrakter og datadelingsmetadata findes i
[`manifest.json`](manifest.json). Lokal funktionalitet kan importeres direkte fra
[`local-tools.mjs`](local-tools.mjs) eller tilgås via stdio-MCP i
[`server.mjs`](server.mjs). `aura_lab_list_candidates` viser metadata.

## Kørsel

Brug Node 22.12 eller nyere, helst Auras låste runtime. Kør fra denne mappe:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run verify:local
npm run mcp
```

`mcp` venter på en MCP-klient på stdin og skriver kun protokol til stdout.
En generisk MCP-klient kan starte `node` med denne pakkes absolutte `server.mjs`
som argument. Brug Auras medfølgende Node-sti i en senere desktopintegration.
Dette er ikke en instruktion om at slå globale MCP-indstillinger til i Aura.

## Apyhub-afprøvning

```sh
node cli.mjs probe
node cli.mjs login
node cli.mjs discover
node cli.mjs catalog
node cli.mjs search 'json to csv'
node cli.mjs inspect json-to-csv convert-raw-json-body-to-csv-inline-resp
node cli.mjs evaluate all
node cli.mjs summarize
```

`login` åbner en kortlivet callback på `127.0.0.1` og lægger en browseradresse i
den private `login-handoff.json`. Åbn den gennem browseren, log ind, og godkend
forbindelsen. Callback kontrollerer host, sti, tilfældig state og PKCE.

Credentials og kvotetæller ligger uden for repositoryet i
`~/Library/Application Support/AuraToolLab/`: mappe `0700`, filer `0600`, og
symlinks afvises. De er adgangsbegrænsede lokale filer, ikke krypteret nøglering.
En færdig desktopintegration skal benytte appens credentialmekanisme. Revokér
adgangen hos Apyhub under **My MCP → Connected agents** ved behov.

`evaluate` udfører kun de fem faste cases i `cases.mjs`; der er ingen fri
`call_api`-proxy. Pakken reserverer kvote før afsendelse, låser på tværs af
processer og tillader højst fem kald / 200 oplyste atoms pr. dansk kalenderdag.
Det er pakkens egen begrænsning, ikke en påstand om kontoens resterende kvote.
Timeout og leverandørfejl giver ingen automatisk gentagelse. Hvis en proces
afbrydes og efterlader `evaluation.lock`, skal ejerskab og aktive processer
kontrolleres før en manuel oprydning; pakken ophæver ikke selv låsen.

Søgning og specifikationshentning er katalogkald. Første runde udførte præcis fem
`call_api`-kald med samlet oplyst pris 110 atoms. Den faktiske kontofakturering er
ikke kontrolleret. Der er kun sendt syntetiske tekster/rækker og Apyhubs offentlige
IBAN-eksempel. Kontakter, kommunale filer og andre brugerdata er ikke anvendt.

## Resultater og en rettelse i testpakken

`reports/` er udeladt fra Git. Den indeholder rå caseobservationer, hentede
specifikationer, `evaluation-reviewed.json`, `evaluation.csv`,
`local-comparison.json` og `local-comparison.csv`.

Første JSON-til-CSV-kontrol fejlede i vores recorder: rå MCP-tekst blev pakket ind
som et objekt, og testen antog samme kolonnerækkefølge som input. Apyhub returnerede
kolonnerne i en anden rækkefølge. Begge antagelser er rettet. Originalrapporten er
bevaret; `summarize` genvaliderer det gemte svar med den rettede kontrol, uden et
nyt leverandørkald. Den gennemgåede rapport markerer denne korrektion eksplicit.

Den konkrete prioritering står i [`candidates.csv`](candidates.csv). PDF/OCR,
billeder, kalenderfiler og eksterne registre er endnu ikke afprøvet i denne runde.

## Aura-integration

Aura indlæser de fire tools som en fast, bundlet plugin gennem sin betroede
motorvej. Eksterne MCP-servere forbliver slået fra. Hvert kald kræver en konkret
enkeltgodkendelse bundet til inputhash og toolversion. Ingen globale toolregler
eller nye UI-kontroller er indført. Se [desktop-integration.md](desktop-integration.md).

Native afprøvning bruger rigtig Electron, preload, IPC, OpenCode 2.1.4 og
Privacy Gate i en separat syntetisk profil. Den kontrollerede model kører på
loopback; prøven dokumenterer appintegrationen og kræver ingen betalt model.

I lokal tilstand forbliver følsomme tooldata hos den dokumenterede lokale model.
Ved en cloudmodel skal resultat og toolhistorik gennem Privacy Gate før næste
modelkald. Strukturdata med fx IBAN eller mailadresse kan kræve lokal behandling;
Godkend én gang ophæver ikke denne grænse.

Genbyg den faste desktopplugin med `node build-desktop-plugin.mjs` fra denne
mappe. Den er selvstændigt bundlet, har en SHA-256-kontrol og medfølgende
bibliotekslicenser. Appen downloader eller installerer ingen toolpakker ved start.

## Afhængigheder og kilder

Versioner og integritetsværdier er låst i `package-lock.json`.

| Bibliotek | Licens | Brug |
|---|---|---|
| `@modelcontextprotocol/sdk` | MIT | MCP-klient, OAuth og stdio-server |
| `csv-parse`, `csv-stringify` | MIT | Lokal CSV-behandling |
| `diff` | BSD-3-Clause | Lokal tekstsammenligning |
| `ibantools` | MIT-alternativet i dobbeltlicensen | IBAN-kontrol og landemetadata |
| `zod` | MIT | Input/output-kontrakter |

Leverandørens bibliotekslicenser følger de installerede pakker. Bevar dem ved
senere pakning og distribution.

- [Apyhub MCP](https://apyhub.com/mcp)
- [Apyhub-vilkår](https://apyhub.com/terms): egne produkter og egne implementeringer;
  denne pakke genudbyder ikke deres rå API som sit eget.
- [Officiel MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [CSV Parse](https://csv.js.org/parse/api/sync/)
- [CSV Stringify](https://csv.js.org/stringify/api/sync/)
- [jsdiff](https://github.com/kpdecker/jsdiff)
- [IBAN Tools](https://github.com/Simplify/ibantools)
