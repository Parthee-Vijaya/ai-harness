# Gør designgrundpakken obligatorisk og indlæs den før første byggeopgave

En model kunne tidligere springe designskillen over, og et gemt fravalg kunne fjerne den fra nye byggeopgaver. Denne ændring holder design og tilgængelighed i grundpakken og indlæser den validerede hovedmetode før første modelkald i Planlæg, Byg og Arbejd direkte. Med #23 medfølger den fulde Aura-design-metode og webapp-byggevejledning.

## Adfærd

- `alwaysOn` i kataloget håndhæves i fælles kode for desktop og CLI. Gamle globale fravalg og projektundtagelser kan ikke slå design fra; øvrige tilvalg ændres ikke.
- Projekttilpasninger supplerer den originale designkerne. De sletter den ikke. Manglende eller ugyldig obligatorisk skill stopper afsendelsen.
- Den nøjagtige gennemgåede kerne kontrolleres igen omkring motorstart. En ændring kræver ny gennemgang.
- Almindelig Samtale får ikke byggeinstruktionerne. Idéhjælp kan bruge samme metode uden værktøjer eller filændringer; #44 anvender dette interface.
- Indstillinger viser design under “Altid slået til”; første opsætning viser fem valgfrie funktioner. Originalens øvrige UI og onboarding bevares.
- Ingen ekstra data-, fil- eller værktøjstilladelser. Plan- og værktøjsgodkendelser, Stop og historik bevares.

## Før og efter — den faktiske Electron-app

| Før denne opdatering | Efter denne opdatering |
|---|---|
| ![Tidligere grundpakke](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/activate-primary-build-skill/docs/images/design-baseline/before-detail.png) | ![Design er altid med](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/activate-primary-build-skill/docs/images/design-baseline/always-on-design-detail.png) |

Billederne er taget i separate testprofiler. `verify-design-baseline.cjs` gengiver forløbet og kontrollerer indstillingerne gennem rigtig IPC.

## Validering 25. oktober 2026

- **22/22** fokuserede tests: obligatorisk kerne, gamle fravalg, projekttilpasning, ugyldig metode og katalogregler.
- **10 native kontroller**: opsætning, ingen designkontakt, IPC-fravalg, bevarede øvrige valg, genstart og ingen rendererfejl.
- **7 transportforløb** gennem rigtig Workbench → OpenCode 1.18.33 → Mistral-/Corti-adapter → kontrolleret lokal HTTP-server. Første udgående kald indeholder den nøjagtige gennemgåede kerne. Plan/Byg/CLI, gammelt fravalg og almindelig chat er dækket.
- Samme **7 transportforløb med hele skillen fra #23** består; det er den komplette metode, ikke den lille fixture.
- Fuld desktop-suite: **520/522**. Samlet #23 + #43: **527/529** og **27/27 CLI-tests**. Begge har kun de samme to fejl i `approvals.test.cjs` (47 og 74), som er reproduceret på originalens uændrede `main` (**514/516**). Ingen tests er sprunget over.

Dette er lokale tests på macOS Apple Silicon / Node 22.23.3. Transportprøverne bruger kontrollerede svar og dokumenterer indholdet af forespørgslen; de dokumenterer ikke en ekstern models visuelle kvalitet eller grøn GitHub CI.

[Evidens, testlog og transportresultater](https://github.com/Parthee-Vijaya/ai-harness/tree/feat/activate-primary-build-skill/docs/contributions/primary-design) · [Native resultater](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/activate-primary-build-skill/docs/images/design-baseline/native.json)

## Integration

Integrér #23 først. Uden den installerede metode deklarerer biblioteket dens fravær, så originalens selvstændige app fortsat virker; med metoden installeret er den obligatorisk. Den lokale samlingsprøve genbygger alle 23 eksportpakker og tilpasser de to skill-antal i den eksisterende fixture. Ingen udgivelsesidentitet eller modelversion ændres.

Ved integration med F08/#36 skal hovedskillen fortsat indgå i den gennemgåede appkontekst. Denne PR erstatter ikke F08’s bindinger. Ældre testfiler i mappen beskriver tidligere revisioner; filerne med `always-on-` er denne opdaterings resultater.

```sh
node --test desktop/tests/build-design.test.cjs desktop/tests/features.test.cjs desktop/tests/library.test.cjs
node desktop/scripts/verify-primary-build-skill.cjs
AURA_PR_EVIDENCE=/tmp/design-proof node desktop/scripts/verify-design-baseline.cjs
node --test --test-concurrency=1 desktop/tests/*.test.cjs
```
