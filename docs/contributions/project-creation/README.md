Når Aura genåbner det seneste projekt, kan indlæsning af opstartsvalg frigive “Opret projekt” for tidligt. Et første klik kan derfor ramme en igangværende handling og vise “Denne handling er allerede i gang”. Gentagne indsendelser kan tilsvarende overlappe en langsom oprettelse.

Rettelsen samler knappens tilstand for opstart og projektoprettelse, afviser overlappende indsendelser og frigiver formularen ved både succes og fejl. Kladder bevares, og første samtale klargøres efter, at projektoprettelsen er afsluttet.

## Før / efter

Samme kontrollerede forsinkelse af den native genåbning, samme formular og samme indsendelse. Billederne kommer fra rigtig Electron; HTML/CSS og fejltekster er ikke udskiftet til dokumentationen.

| Før: originalens main | Efter: rettet gren |
|---|---|
| ![Fejl ved første indsendelse](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/fix/serialize-project-creation/docs/images/project-creation/before.png) | ![Formularen forbliver korrekt optaget og kladden bevares](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/fix/serialize-project-creation/docs/images/project-creation/after-pending.png) |

Efter afslutning eller fejl bliver formularen brugbar igen. [Projektet åbnet efter genforsøg](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/fix/serialize-project-creation/docs/images/project-creation/project-create-after.png).

## Verifikation

- 15/15 native kontroller: rigtig Electron, IPC, projektmapper og lokal Git-historik i en separat syntetisk profil.
- Fejlen reproduceret mod uændret original `dce68ea`.
- Genåbning, fejlet genåbning, overlappende opstartsindlæsning, gentagne indsendelser, én oprettelse/én initial commit, bevaret kladde, valideringsfejl og efterfølgende genforsøg afprøvet.
- Ingen automatisk AI-kørsel eller plangodkendelse; ingen rendererfejl.
- Fuld desktop-suite: **514/516 består**. De to fejl i `approvals.test.cjs` findes også på originalens uændrede main (3/5 i den isolerede baselineprøve). Ingen nye fejl. Den samlede suite kaldes derfor ikke grøn.
- Syntax og `git diff --check` består. Lokal macOS Apple Silicon / Node 22.23.3 / låste desktopafhængigheder. Hosted CI og fysisk Windows/Intel-Mac er ikke dokumenteret af disse prøver.

Genkør: `node desktop/scripts/verify-project-creation.cjs`. Sæt `AURA_PR_EVIDENCE` for screenshots/JSON. Scriptet bevarer syntetisk projektkilde og fjerner kun den separate testprofil.

## Afgrænsning og integration

Kun oprettelses-/opstartslåsen i `desktop/ui/app.js` ændres; UI, styling, planer, godkendelser, modelvalg og baggrundsprojekter bevares. Ingen nye tilladelser, migrationer eller udgivelsesændringer.

Bygger direkte på originalens main. Idéhjælpen er et selvstændigt forslag i #44. Ved fælles integration skal dens eksisterende busy-tilstand indgå i samme `syncCreateAvailability`, og idéhjælpens gennemgåede forslag skal bevares, før modelkataloget indlæses. Denne kombination findes allerede i forkens 0.3.1; den separate PR trækker ikke hele #44 ind.

[Testlog og baseline](https://github.com/Parthee-Vijaya/ai-harness/tree/fix/serialize-project-creation/docs/contributions/project-creation) · [Native resultat](https://github.com/Parthee-Vijaya/ai-harness/blob/fix/serialize-project-creation/docs/images/project-creation/project-create-result.json)
