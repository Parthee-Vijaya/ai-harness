# Vis den kørende appversion under Aura-logoet

Det er svært at se, hvilken appudgave der er åben, når man tester flere builds eller sender et fejlskærmbillede. Denne ændring viser den **faktiske kørende version** under Aura-navnet i introduktionen, opsætningen og sidepanelet.

Versionen læses fra den eksisterende lokale `updatesState`-kanal. Den er ikke en fast tekst, et nyt versionsnummer eller et netværksopslag. `0.6.0-beta.1` vises eksempelvis præcist, inklusive beta-nummeret; stabile og andre prerelease-versioner bevarer også hele nummeret.

## Før og efter — rigtig Electron-app

| Før | Efter |
|---|---|
| ![Aura uden versionsmærke](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/visible-runtime-version/docs/images/runtime-version/before-sidebar.png) | ![Aura med faktisk version](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/visible-runtime-version/docs/images/runtime-version/after-sidebar.png) |

| Introduktion før | Introduktion efter |
|---|---|
| ![Introduktion før](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/visible-runtime-version/docs/images/runtime-version/before-welcome.png) | ![Introduktion efter](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/visible-runtime-version/docs/images/runtime-version/after-welcome.png) |

Billederne er taget fra før- og efter-versionen i hver sin testprofil. De er ikke mockups.

## Adfærd og afgrænsning

- Det lille mærke følger den installerede app automatisk. Teksten har en læsbar versionsetiket til hjælpeteknologi og vises som ren tekst.
- Ved foldet sidepanel skjules mærket sammen med navnet. Opsætningens og introduktionens eksisterende placering bevares.
- Hvis metadata mangler eller opslaget fejler, fortsætter opstart og projektoprettelse. Et ventende opslag blokerer ikke andre opstartsscripts.
- Originalens **Aura**-navn, ikon, `package.json`, version, opdateringskilde og udgivelsesproces ændres ikke. Forkens “Aura 1 beta 0.3.1” og nulstilling af releases følger ikke med.
- Ingen ændringer i modelvalg, chat, funktioner, planer eller godkendelser. Ingen DMG eller release oprettes med denne PR.

## Validering 25. oktober 2026

- **9/9** fokuserede versions- og opdateringstests: præcis version, beta/RC/build-metadata, fejlet og forsinket IPC samt ugyldige værdier.
- **8 native kontroller** i rigtig Electron: tre versionsmærker, lokal IPC, opret projekt, ingen AI-start eller godkendelse, foldet sidepanel, mindre vindue, genindlæsning og ingen rendererfejl.
- Fuld desktop-suite: **517/519**. Kun de samme to fejl i `approvals.test.cjs` (47 og 74), som også fejler på uændret upstream `main` (**514/516**). Ingen oversprungne tests.
- Syntax og `git diff --check` består. macOS Apple Silicon, Node 22.23.3, Electron 44.4.4. Dette er lokal validering, ikke en påstand om grøn GitHub CI eller fysisk Windows-test.

[Testlog og dokumentation](https://github.com/Parthee-Vijaya/ai-harness/tree/feat/visible-runtime-version/docs/contributions/runtime-version) · [Native resultat](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/visible-runtime-version/docs/images/runtime-version/native.json)

```sh
node --test desktop/tests/app-version.test.cjs desktop/tests/updates.test.cjs
AURA_PR_EVIDENCE=/tmp/version-proof node desktop/scripts/verify-app-version.cjs
node --test --test-concurrency=1 desktop/tests/*.test.cjs
```

Ved sammenfletning med F20/#17 bevares onboarding B’s topbar og øvrige indhold; tilføj kun versionsmærket og scriptet. PR’en er baseret på originalens `dce68ea74a199ca214ab535a16ff22765d8ee8de` og kan vurderes selvstændigt.
