# Vælg YOLO under Byg for den aktuelle samtale

Aura spørger normalt om værktøjshandlinger. Brugeren kan nu slå YOLO til under **Byg**, allerede før første opgave, eller vælge det på en ventende godkendelse. En konkret advarsel og et aktivt afkrydsningsfelt skal bekræftes først. Derefter fortsætter tilladte værktøjshandlinger uden gentagne spørgsmål i netop denne samtale.

## Hvad tilladelsen omfatter

- Tilladte filændringer, konkrete almindelige filer/mapper uden for projektet, almindelige webopslag samt kommandoer inden for Auras håndhævede afgrænsning.
- Tilladelsen gemmes kun i hukommelsen. Andre samtaler og en ny appstart har ingen YOLO-tilladelse. En synlig status med “Slå fra” gør valget tilbagekaldeligt.
- Gennemgangen bindes til samtalen, motoren, generationen og en eventuel ventende anmodning; udløb, genbrug og ændret anmodning afvises. Aktivering starter ikke en AI-opgave.
- Samtale og Planlæg får ingen ekstra rettigheder. YOLO godkender ikke en plan eller ny datadeling og omgår ikke faste projekt-/dataregler.
- Hemmeligheder, beskyttede referencer, brede mapper, tvetydige stier og ukendte værktøjer får ikke en generel tilladelse. Beskyttelsen omfatter også bl.a. `.ssh`, `.aws`, `.npmrc`, `.env`, `.pem` og symlink-omveje.
- Kommandoer kræver fungerende isolation. Kommandoformidleren pakkes fortsat uden for asar, så den låste Node-runtime kan starte den. Ingen ny systemomfattende tilladelse tilføjes.

Eksisterende enkelttilladelser og projekttilladelser bevares. Denne opdatering erstatter ikke den særskilte planproces, data-gennemgang, historik eller Stop.

## Før og efter — rigtig Electron-app

| Tidligere revision af #45: Byg uden en forudgående kontakt | Nu: YOLO kan vælges under Byg |
|---|---|
| ![Byg før](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/conversation-lifetime-permission/docs/images/yolo-update/build-before.png) | ![Byg med YOLO](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/conversation-lifetime-permission/docs/images/yolo-update/build-yolo.png) |

### Advarsel før aktivering

![YOLO-advarsel med aktiv accept og bevarede grænser](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/conversation-lifetime-permission/docs/images/yolo-update/yolo-warning.png)

Billederne er optaget i en separat testprofil. Originalens øvrige UI, onboarding og navn bevares.

## Test 25. oktober 2026

- **35/35** fokuserede tests: policy, isolation, beskyttede læsninger, gamle/udløbne gennemgange, skift af samtale, read-only-tilstande, tilbagekaldelse og aktivering uden en ventende handling.
- **16 native kontroller** gennem rigtig Electron/IPC: knappen findes kun under Byg, advarsel kræver accept, Annuller virker, aktivering starter ingen opgave, ny samtale er uden tilladelse, skift tilbage bevarer den, tilbagekaldelse og genstart rydder den.
- **Rigtig Electron → OpenCode → macOS-sandbox → kontrolleret lokal HTTP-server:** 6 modelkald; den beskyttede fil uden for projektet nåede ikke modtageren, tilladte write/bash-handlinger blev udført, og tilbagekaldelse krævede ny godkendelse. Ingen rendererfejl.
- Fuld desktop-suite: **523/525**. De to fejl i `approvals.test.cjs` (47 og 74) er også reproduceret på uændret upstream `main` (**514/516**). Ingen nye fejl og ingen oversprungne tests.

Prøverne bruger syntetiske filer og kontrollerede modelsvar uden credentials. Native isolationsbevis er fra macOS Apple Silicon / Node 22.23.3; der påstås hverken en fysisk Windows-prøve, ekstern AI-afprøvning eller grøn GitHub CI.

[Evidens og testlog](https://github.com/Parthee-Vijaya/ai-harness/tree/feat/conversation-lifetime-permission/docs/contributions/conversation-permission) · [Native kontroller](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/conversation-lifetime-permission/docs/images/yolo-update/native.json) · [Motor- og isolationsprøve](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/conversation-lifetime-permission/docs/images/yolo-update/engine/permission-result.json)

## Integration

Bevar R01/#19, R02/#20, F08/#36 og F31/#35 ved sammenfletning: deres ejerskabsbindinger, datagennemgang og diffgennemgang erstattes ikke. Sammen med #43 skal “Altid slået til” både indeholde designgrundpakken og forklaringen om den frivillige YOLO-undtagelse. Denne PR kræver ikke designændringerne for at fungere selvstændigt.

Filer med `yolo-` og `docs/images/yolo-update/` er den aktuelle opdaterings evidens. Ældre logfiler i mappen tilhører tidligere revisioner.

```sh
node --test desktop/tests/conversation-permission.test.cjs desktop/tests/engine-read-guard.test.cjs desktop/tests/command-sandbox.test.cjs desktop/tests/approvals-policy.test.cjs
AURA_PR_EVIDENCE=/tmp/yolo-ui node desktop/scripts/verify-yolo.cjs
AURA_FLOW_EVIDENCE=/tmp/yolo-engine node desktop/scripts/verify-conversation-permission.cjs
node --test --test-concurrency=1 desktop/tests/*.test.cjs
```
