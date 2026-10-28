# Lokale tools i Aura Harness

De fire tools er integreret i desktopmotoren. Der er ikke åbnet for eksterne
MCP-servere, projekttilføjede plugins eller en rå Apyhub-proxy. Ingen UI-filer er
ændret.

## Den betroede pluginvej

`desktop/core/local-tools.cjs` kontrollerer hash og kopierer den faste plugin til
motorens private tilstand. `engine.cjs` registrerer pluginen og bekræfter dens
identitet/status gennem den rigtige OpenCode 2.1.4 API før første prompt.
Pluginen indeholder CSV-, diff-, IBAN- og schemabiblioteker i én bundlet fil;
der hentes ingen biblioteker ved appstart. Licenser følger med i pakken.

`desktop-plugin-entry.mjs` og `local-tools.mjs` er den vedligeholdte kilde.
`build-desktop-plugin.mjs` bygger den selvstændige appfil, licensnoter og
`local-tools-integrity.json`. `manifest.json` beskriver den separate MCP-pakkes
fulde kontrakter; desktopadapteren validerer de samme argumenter før native
schemafortolkning og før udførelse.

## Godkendelser

Hvert tool har sin egen eksplicitte `ask`-regel, også i Samtale og Planlæg.
Kaldet følger motorens eksisterende permission-flow og Auras eksisterende kort.
En hash af de konkrete argumenter og toolversionen indgår i godkendelsens match
og fingeraftryk. Afvigende input eller version afvises. Argumenterne kopieres
før ventetiden og kontrolleres igen efter godkendelsen.

De nye tilladelser kan kun gives én gang. Projektregler og YOLO giver dem ikke
automatisk adgang. Stop og afsluttede forespørgsler kan ikke genafspilles.
Toolene har ingen filindgang, shell, netværksklient eller credentials.
Filindhold skal stadig komme gennem Auras eksisterende filadgang.

## Privacy Gate

Toolresultatet returneres i den samme isolerede motorsession. Næste modelkald
passerer den eksisterende gateway og Privacy Gate. En toolgodkendelse giver
ikke en delingstilladelse og nedklassificerer ikke resultatet.

Den native prøve bekræfter:

- Alle fire tools og de fem fælles testcases virker med den dokumenterede lokale
  loopback-testmodel under Privacy Gates lokale tilstand.
- En cloud-prøve viser og sender præcis de gennemgåede offentlige modelkald,
  inklusive det lokale CSV-tools resultat.
- Et lokalt tool må gerne behandle syntetisk maildata, men den efterfølgende
  cloudforespørgsel bliver blokeret. Datareglerne svækkes ikke for at få testen igennem.
- Afvis og Stop giver ingen færdig toolhandling eller efterfølgende modelkald;
  genafspilning af svaret afvises i den rigtige IPC.

Den eksisterende isolerede motor kan vise Afvis som en kontrolleret afbrudt/fejlet
opgave. Prøven kontrollerer, at handlingen ikke udføres; den ændrer ikke appens
eksisterende fejlklassifikation eller UI i denne integration.

## Kvalifikation

`desktop/scripts/verify-local-tools.cjs` starter den rigtige app i en separat
syntetisk profil og bruger de eksisterende godkendelses- og delingsknapper.
Den virker også mod en eksplicit `HARNESS_TEST_PACKAGE`; pakkekontrollen må
ikke falde tilbage til kildeappen. Prøven bruger ingen brugercredentials eller
betalte modelkald. `desktop/tests/local-tools.test.cjs` dækker bindingsregler,
betroet pluginoprettelse og opt-in native tilladelse, afvisning og Stop.

Kør fra repositoryets rod:

```sh
AURA_ENGINE_NATIVE=1 desktop/.runtime/darwin-arm64/node/bin/node --test desktop/tests/local-tools.test.cjs
desktop/.runtime/darwin-arm64/node/bin/node desktop/scripts/verify-local-tools.cjs
```

En installeret brugerapp, en publiceret release eller en test mod en ekstern AI
kræver sit eget konkrete leverancebevis; native loopback-afprøvning er ikke bevis
for en bestemt betalt models værktøjsvalg.
