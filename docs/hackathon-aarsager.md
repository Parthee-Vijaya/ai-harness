# Aura 0.6.0-beta.1 efter KL-hackathonen: grundårsager og retning

## Grundlag og forbehold

- Otte temaer fra feedbacken er undersøgt, og en skeptiker har efterprøvet hvert fund. Rapporten bruger kun fund, som skeptikeren bekræftede eller delvist bekræftede. Delvist bekræftede fund står i skeptikerens rettede form. Fund, som skeptikeren selv fandt og kørte, er også taget med. Uafklarede fund er markeret **uafklaret**.
- Fundene er samlet efter grundårsag på tværs af temaerne. De er ordnet efter, hvor hårdt og hvor bredt de rammer brugerne.
- Hvert bevis er mærket med sit niveau:
  - *læst*: kun læst i koden.
  - *kørt*: kørt med den rigtige Aura (HEAD `dce68ea`) og OpenCode 1.18.33 mod en falsk lokal model.
  - *qwen3:8b*: kørt med en lille lokal model og få gentagelser. Det viser en retning, men dækker ikke.
- Intet er kørt med GLM 5.3 (corti-s1) eller andre betalte modeller. Intet er afprøvet på Windows, og intet er kørt mod rigtige udbydere eller mod komplai i drift.
- Alle tider er målt på en maskine under meget høj belastning (load average 25–360). Sekundtallene er derfor øvre grænser. Antal kort, tokens, kald og genstarter afhænger ikke af belastningen.
- Alle fund er diagnoser. Ingen af rettelsesretningerne er skrevet eller afprøvet endnu.
- Repoet er kun læst. `git status` er tom, og der er ikke lavet nogen Git-handlinger.
- Filstier er relative til repoets rod. `core/` og `ui/` ligger under `desktop/`.

## Kort fortalt

- Det, der gør Aura langsom og spørgende, er hverken modellen, gatewayens gennemstrømning eller OpenCode som motor. Det er Auras opsætning ovenpå: godkendelsesreglerne, prompterne, arbejdsmåderne og forhåndsvisningen.
- Aura beder om lov til næsten alt og kan ikke huske de fleste svar. Den sender også selv AI'en ud i appdata, hvor dens egne regler ikke kan genkende OpenCodes forespørgsler.
- Planer forsvinder ved helt almindelige svar som "Ja tak". Hvert skift af arbejdsmåde eller model, og hver ændring i projektets tilstand, starter en ny AI-session, som ofte har glemt samtalen.
- Én forbigående fejl hos udbyderen, fx en grænse for antal kald, stopper hele opgaven og sletter planen. Det sker, fordi gatewayen slår OpenCodes genforsøg fra.
- React og servere når sjældent frem til forhåndsvisningen. AI'en starter selv serveren, Aura kigger det forkerte sted, og AI'en ser aldrig sit eget resultat.
- Store dele af 0.6.0-beta.1 blev tilføjet natten før hackathonen og udgivet om morgenen uden en ende-til-ende-prøve. Den eksisterende prøve for godkendelser kan ikke bestå på 0.6.

## Oversigt

| # | Grundårsag | Feedback | Hvem rammes |
|---|---|---|---|
| 1 | Aura spørger om næsten alt og kan ikke huske svarene | 3, 2 | Alle, i alle opgaver |
| 2 | Aura sender selv AI'en ud af projektmappen | 1, noten om appdata | Alle |
| 3 | Planer forsvinder, og arbejdsmåderne skifter forkert | 3 | Alle, der bruger Planlæg og Byg |
| 4 | Motoren genstartes, og AI'en glemmer samtalen | 2, 3, 4 | Alle, der skifter arbejdsmåde eller model eller bygger videre |
| 5 | Én fejl hos udbyderen stopper hele opgaven | 3 (AI'er svarer ikke) | Alle, når udbyderen har travlt |
| 6 | React og servere når ikke frem til forhåndsvisningen | Noten om React | Alt andet end ren HTML |
| 7 | AI'en bygger i blinde og uden de sædvanlige designmidler | 4, noten om design | Alle, der bygger brugerflader |
| 8 | Prompten er stor, gentager sig og skubber mod proces | 2, 4 | Hvert eneste kald |
| 9 | Kommandosandkassen: ét klik ændrer alt | 3, 4 | Dem, der har trykket "Tillad altid" på en kommando |
| 10 | API-nøgler bliver ikke renset, og fejlbeskederne peger forkert | 3, noten om Corti | Nye brugere |
| 11 | CLI'en | Noten om CLI'en | Alle CLI-brugere |
| 12 | komplai Run siger "Udgivet", før appen kan åbnes | 3 | Alle, der udgiver |
| 13 | Tværgående: ændringerne blev ikke prøvet ende til ende | 1 (mange fejl) | Forklarer, hvorfor fejlene nåede ud |

---

## 1. Aura spørger om næsten alt og kan ikke huske svarene

**Det oplevede brugerne:** Kort hele tiden, også når AI'en bare skulle søge i projektets egne filer. Lange Linux-kommandoer, som de ikke kunne vurdere. "Tillad altid" hjalp ikke på kommandoer.

**Årsagen:**
- I Byg kræver følgende et klik: filændringer, kommandoer, søgning (grep), webadgang og alt uden for projektet. Kun læsning og listning er fri. De to automatiske valg ("Filændringer i projektet" og "Byg og kontrollér automatisk") er slået fra og ligger bag ••• → Projektets indstillinger.
- Filkortene kan fjernes med ét klik på "Tillad altid i projektet", som slår automatik til for hele projektet. Det kan søgning og kommandoer ikke.
- Søgning spørger i alle arbejdsmåder, også i Samtale og Planlæg. OpenCode sender søgeordet (fx `useState`), og Aura tolker det som en sti. Derfor kan kortet sjældent huskes. Samtidig beder Auras egne regler AI'en om at søge med netop dette værktøj i stedet for med kommandoer.
- En husket kommando matcher kun, hvis tekst, mappe, AI'ens begrundelse og timeout er præcis de samme. Den virker desuden kun, når kommandosandkassen kører (afsnit 9). Windows har ingen sandkasse, så der kan kommandoer aldrig huskes eller køre automatisk.
- Kommandokortet viser selve kommandoen i første lag med teksten "Tillad kun, hvis du forstår, hvad den gør". Feltet "Hvorfor" mangler som regel, fordi OpenCode spørger, før AI'ens begrundelse er nået frem. Gættet på, hvad kommandoen gør, dækker kun nogle kommandoer.
- OpenCodes vagt mod gentagelser bliver i Byg til et kort med teksten "Gennemgå denne handling".
- "Afvis" stopper hele opgaven. Kun "Afvis med en besked" under "Flere valg" lader AI'en fortsætte.
- Mens et kort venter, står AI'en stille. Det kan ligne, at den ikke svarer.
- "Før du sender" kommer igen i hvert nyt projekt og ved hvert modelskift, også når modtageren er den samme.
- CLI'en viser hver forespørgsel som rå JSON med engelske navne og kan kun tillade én gang.

**Bevis:**
- `core/engine.cjs:55`, `:56`, `:59`: `grep: 'ask'` i alle arbejdsmåder. I Byg er `edit`, `bash`, `webfetch` og `external_directory` også sat til `'ask'`. *læst*
- `core/approvals-policy.cjs:118`: automatikken er slået fra som standard. `:247`: "Tillad altid" på en fil slår automatik til for hele projektet. *læst*
- `core/approvals-policy.cjs:102-105` og `:17`: uden sti bruges søgeordet som sti. Grep uden sti og med relativ sti gav `persistable=false` i alle arbejdsmåder. *kørt*
- `core/approvals-policy.cjs:155-157`, `:209`; `core/command-sandbox.cjs:23` (Windows). *læst*
- `ui/approvals.js:22`, `:27`, `:90`, `:98`. Målt: "Hvorfor" stod på 1 af 9 kommandokort. Da argumenterne blev streamet i bidder, havde 1 af 6 forespørgsler AI'ens input, da kortet kom. *kørt*
- `core/project-guidance.cjs:38`: "Brug værktøjerne til at læse, liste og søge i filer." *læst*
- `core/model-consent.cjs:11-15`, `:29-33`. *læst*
- `cli/app.cjs:78-82`. CLI'en har sit eget lager (`cli/storage.cjs:9`), så desktopappens automatik gælder ikke dér. *læst*
- Målt: et bevidst bredt byggeforløb på 30 trin gav 25 kort og 0 automatiske godkendelser. Efter "Tillad altid", hvor knappen fandtes, gav samme forløb 19 kort. I opgaven efter blev alle 9 kommandoer spurgt igen. Forløbet er konstrueret og ikke et målt typisk forløb. Et enklere forløb gav 4 kort på 6 værktøjskald, og et minimalt forløb med qwen3:8b gav 3 kommandokort. *kørt / qwen3:8b*

**Retning: "Projektmappen er grænsen"**
- Inde i projektmappen sker læsning, søgning og filændringer automatisk, og versioner og fortryd er sikkerhedsnettet. Søgning får samme beskyttelse som læsning (`.env`, nøglefiler, `.git` og `references`) og bindes til stien, ikke til søgeordet.
- Kommandoer i projektmappen kører automatisk i sandkassen, når sandkassen er rettet (afsnit 9).
- Kun reelle grænseoverskridelser giver et kort: handlinger uden for mappen, nye netdomæner, udgivelse, sletning af mange filer og globale installationer. Kortet siger på dansk, hvad der sker og hvorfor, ud fra en inddeling i kategorier ("Henter pakker fra npm", "Starter appen lokalt"). Selve kommandoen ligger under "Se detaljer". Tilladelser huskes pr. kategori eller præfiks, og AI'ens begrundelse indgår aldrig i nøglen.
- Gentagelsesvagten besvares automatisk over for modellen ("Du gentager samme kald; prøv en anden vej") og logges under Aktivitet.
- "Før du sender" gemmes pr. udbyder og model på tværs af projekter. Den vises igen, når modtager, vilkår eller delt materiale ændrer sig.
- CLI'en får samme tekster og samme politik som desktopappen.
- Windows får sin egen løsning (se beslutningerne nedenfor). Den markeres som uprøvet, indtil den er afprøvet.

## 2. Aura sender selv AI'en ud af projektmappen

**Det oplevede brugerne:** AI'en opretter filer i appdata og temp-mapper og beder så om lov "til at se" dem. Nogle skulle give lov til at se "OpenCode" eller Auras egne skills. Projektets ting ligger spredt i appdata.

**Årsagen:** Fire ting virker sammen.

1. **Aura peger selv ud af projektet.**
   - Systemprompten giver AI'en en midlertidig mappe i appdata for hver opgave og beder den bruge mappen. Det sker også i Samtale og Planlæg, hvor AI'en ikke må skrive.
   - AI'ens kommandoer arver systemets temp-mappe. På Windows ligger den i `AppData\Local\Temp` (*læst, ikke afprøvet*). OpenCode opdager ikke skrivning dertil via `> fil` eller `$TMPDIR`. Først når AI'en læser filen bagefter, kommer der et kort.
   - OpenCode gemmer lange værktøjsresultater i appdata under `…/opencode/tool-output/` og beder modellen "Use Grep". Søgning giver et kort med titlen "Må AI'en søge i projektets filer?", og stien indeholder `opencode`.
   - Skills ligger i appdata. Læsning er fri, men søgning samt `cat` og `ls` i skillmappen giver kort med lange appdata-stier.
   - Når to samtaler arbejder samtidigt i samme projekt, arbejder den ene i en kopi under appdata.
2. **Auras regler kan ikke genkende OpenCodes rigtige forespørgsler uden for projektet.** OpenCode 1.18.33 sender mappeadgang som `<mappe>/*` med `filepath` og `parentDir`. Filændringer i et Git-projekt sender den med en relativ sti (`../../..`). Aura afviser begge former, og kortet bliver til "Denne handling", som kun kan tillades én gang. Derfor kan ingen adgang uden for projektet huskes, undtagelsen for den midlertidige mappe slår aldrig til, og "Tillad en mappe fremover" bliver aldrig vist. Enhedstestene bruger andre former end dem, motoren sender. Ordet `parentDir` findes ingen steder i repoet. Desuden overskriver Auras `{'*': 'ask'}` for mappeadgang OpenCodes egne standardundtagelser for dens temp- og skillmapper.
3. **Teksterne forstærker det.** Mappekortet hedder altid "Må AI'en se en mappe uden for projektet?", også når AI'en vil skrive. Et filkort uden for projektet viser `../../../<appdata-sti>`. Kvitteringen lyder "1 handling godkendt: Denne handling.", og kortene bliver ikke samlet.
4. **Usynlige rester.** Hver motorstart efterlader et bibliotek på 4,8 MB i temp-mappen. npm-cache og npm-logs ligger pr. projekt i appdata. `opencode.db` gemmer hele samtalen, også indholdet af læste filer. Midlertidige mapper og sandkassemapper bliver aldrig ryddet op, og en samtalekopis motormappe bliver liggende, når kopien slettes. Alt er nøglet på projektets absolutte sti, så et flyttet eller omdøbt projekt mister historik, tilladelser og AI-sessioner. Resterne giver ikke selv kort, men de forklarer noten om, at Aura gemmer i appdata.

En lille model (qwen3:8b) skrev projektets `public/index.html` ét niveau uden for projektet i 2 af 3 kørsler. Det skete både med og uden sætningen om den midlertidige mappe, så sætningen er ikke årsagen. I Byg er skrivning uden for projektet sat til "spørg" og ikke "nej", og kortet siger "se en mappe". Brugeren kan derfor tillade en forkert placering uden at opdage det. Hvor ofte det sker med GLM 5.3, er ikke målt.

**Bevis:**
- `core/chat-session.cjs:286`, `:332`: den midlertidige mappe i appdata og instruktionen til AI'en. `core/engine.cjs:84`: TEMP, TMP og TMPDIR arves. `core/engine.cjs:47`: `external: {'*': 'ask'}`. *læst*
- `core/approvals-policy.cjs:54-55`, `:70`, `:165`, `:199-200`; `desktop/tests/approvals-policy.test.cjs:18-20`. *læst*
- Målt med motorens rigtige forespørgsler: skrivning i den midlertidige mappe gav 2 kort, læsning 1 kort og læsning af `$TMPDIR/build.log` 1 kort. Alle hed "Denne handling", og ingen kunne huskes. Samme mappe via en kommando blev godkendt automatisk. Et byggeforløb på 26 trin gav 28 godkendelser: 26 kort, heraf 13 med teksten "Denne handling". *kørt*
- Målt: et afkortet webresultat blev gemt i tool-output. Søgning i det gav et kort med stien `<runtime>/data/opencode/tool-output/…`, mens læsning af samme fil var fri. Søgning i skillmappen gav kort, og `cat` og `ls` dér gav kommandokort med appdata-stien. *kørt*
- `ui/approvals.js:17`, `:24`, `:25`; `ui/approval-view.js:56`, `:61`. *læst*
- Målt: 11 motorstarter efterlod 11 filer på hver 4.822.976 byte. Tekst fra en læst fil uden for projektet stod 11 gange i `opencode.db`. `core/store.cjs:39`: nøglen er sha256 af projektets sti. *kørt*
- `core/workbench.cjs:64-70`, `core/copies.cjs:37`, `:101`, `core/chat-session.cjs:315`. Projektfiler i en kopi vises med relativ sti på kortene (`ui/approvals.js:11`). Appdata-stien ses især i systemprompten og under de tekniske detaljer. *læst*

**Retning:**
- Flyt AI'ens arbejdsfiler ind i projektet, fx til `.aura/tmp/<opgave>`, og brug mappen som TMPDIR, TEMP og TMP for AI'ens kommandoer. Det samme gælder OpenCodes data og tool-output, npm-logs og eventuelt skills (med skrivning nægtet). Brug én delt npm-cache pr. bruger.
- Ignorér kun de nye undermapper i Git, ikke hele `.aura`. `.aura/publishing/<udbyder>.json` er beregnet til at blive versionsstyret (`core/deployment-configuration.cjs:10`). Udelad mapperne i `core/git.cjs:35`, `core/changes.cjs:3`, `core/copies.cjs:8`, `core/pages-publishing.cjs:103` og i komplai-buildet.
- AI'en må ikke kunne læse motorens data, fx `opencode.db`. Læsning er i dag sat til `'*': 'allow'` (`core/engine.cjs:41`), så det kræver regler både i OpenCode og i Auras læsebeskyttelse (`core/engine.cjs:152-155`).
- Uden for projektet bliver nøgler, sandkassens indstillinger, læsebeskyttelse og plugins (betroet kode), kopier til samtidige samtaler og globale designpakker.
- Ret godkendelsesreglerne, så de passer til OpenCodes rigtige former (`parentDir` og `filepath`). Lav en kontrakttest med optagne forespørgsler fra den låste OpenCode-version. Testen skal fejle på den nuværende kode.
- Fjern sætningen om appdata-mappen fra systemprompten. I Byg skal skrivning uden for projektet og `.aura/tmp` nægtes med en klar besked til AI'en.
- Ret korttitlerne, så de skelner mellem at skrive og at se, og kald aldrig en sti uden for projektet for "projektets filer". Kald kopien "samtalens kopi".
- Ryd op efter hver opgave og ved start. Nøgl projektdata på et id i `harness.json` i stedet for på stien, og migrér de nuværende appdata-mapper.

## 3. Planer forsvinder, og arbejdsmåderne skifter forkert

**Det oplevede brugerne:** "Planlæg-tilstand sker ikke." Samtale, Planlæg og Byg skifter ikke korrekt. AI'en svarer, men bygger ikke.

**Årsagen:**
- **En ny besked i Planlæg sletter en færdig plan, før AI'en svarer** (fundet af skeptikeren). Svarer brugeren "Ja tak, det ser godt ud", trækkes planen tilbage. Knappen "Byg planen" forsvinder, og det eneste tilbud er "Byg videre", som bygger uden plan, mens AI'en skriver "Tryk på Byg planen". Det er den mest direkte forklaring på, at Planlæg ikke sker.
- **En plan genkendes kun, hvis de fire overskrifter står helt ordret i AI'ens sidste besked.** Nummererede overskrifter, `**Det bygger vi**:`, emoji, "Teknik & data" og tekst på samme linje som overskriften giver alle "Ingen plan endnu". Det samme sker, hvis planen efterfølges af et værktøjskald.
- **Fejl eller Stop under Byg sletter planen og skifter til Planlæg.** "Prøv igen" sender derefter byggebeskeden i Planlæg, hvor AI'en kun må læse. Der findes ingen "Byg igen", kun "Lav en opdateret plan". Sammen med afsnit 5 betyder det, at én forbigående udbyderfejl ødelægger planen.
- **Efter en bygning står skrivefeltet stadig på Byg.** Spørgsmål sendes som "Byg efter denne plan". Er planen trukket tilbage, afvises næste besked med "Gennemgå og vælg den seneste plan først." uden noget modelkald. Både at bygge efter planen og at bygge direkte hedder "Byg" i brugerfladen.
- **Markøren `<!-- aura:stay -->` virker i alle arbejdsmåder.** Skriver modellen den, trækkes planen tilbage, og planforslag slås fra i samtalen for altid. Markørerne vises rå, når de ikke står helt sidst.
- **Byg genkendes kun ved bestemte, ordrette sætninger.** "Ja tak, byg den", "Byg den, tak", "Lav den", "Gør det" og "Implementér planen" bliver alle i Samtale, hvor AI'en ikke har skriveværktøjer. Valget af arbejdsmåde ligger i modeldialogen.
- **"Ret med AI" i forhåndsvisningens fejlboks lægger rettelsen i Planlæg,** hvor filer ikke kan ændres. *læst*
- **Byg uden plan får ikke at vide, at den er i Byg.** Den får i stedet planlægningsreglerne, Samtale-reglerne og en række regler, der strider mod hinanden (om commit-beskeder, Git-status, kommentarer og svarlængde), plus en regel om at spørge, når regler strider mod hinanden. Spørgeværktøjet er slået til i Byg. Det er ikke vist, at dette er hovedårsagen til spørgsmålene: OpenCodes grundprompt alene fik qwen3:8b til at spørge i 3 af 3 kørsler.
- **Samtale og Planlæg kører begge på OpenCodes indbyggede plan-agent,** som sætter en engelsk "Plan Mode – CRITICAL … supersedes any other instructions" ind i hver brugerbesked. Mekanismen er sikker, men virkningen er ikke vist: qwen3:8b svarede direkte i Samtale i 6 af 6 kørsler, både med og uden påmindelsen. Det er en risiko, ikke en påvist årsag.

**Bevis:**
- `core/chat-session.cjs:272-275`. Målt: plan klar → "Ja tak, det ser godt ud." → "Ingen gyldig plan" og kun "Byg videre". *kørt*
- `ui/conversation-mode.js:19`, `ui/plan-view.js:4-9`, `core/chat-session.cjs:33-41`. Mindst seks af de afprøvede varianter genkendes ikke. En plan i en tidligere besked i samme opgave ligger i konteksten, men bruges ikke. qwen3:8b: 1 af 4 planer blev ikke genkendt. *kørt / qwen3:8b*
- `core/chat-session.cjs:598`, `:636`; `ui/app.js:851`, `:1655`; `ui/planning.js:95-99`. Målt: HTTP 500 under Byg → "Prøv igen" → næste kald gik i Planlæg med kun læseværktøjer, og resultatet blev en ny plan. *kørt*
- `core/chat-session.cjs:171`; `ui/app.js:834`, `:1612`. Begge forløb er målt. *kørt*
- `core/chat-session.cjs:330`, `:605-608`; `ui/conversation-mode.js:7-9`. *kørt*
- `ui/conversation-mode.js:25`; `core/engine.cjs:55`. "Byg den, tak" blev i Samtale, og AI'ens skrivekald fik svaret "unavailable tool". *kørt*
- `ui/server.js:36` → `ui/app.js:1083`. *læst*
- `core/chat-session.cjs:329`, `core/project-guidance.cjs:46`; `profiles/grundregler.md:5`, `:24` og `:28` mod `core/project-guidance.cjs:38`, `:41` og `:42`; `core/engine.cjs:59`, `:93` (spørgeværktøjet). *læst / qwen3:8b*
- `core/engine.cjs:289` og OpenCode-binæren. *kørt*

**Retning:**
- Træk ikke en plan tilbage, fordi brugeren skriver en ny besked i Planlæg. Genkend godkendelse, eller behold planen, indtil en ny plan erstatter den.
- Gør genkendelsen tolerant over for små afvigelser, og saml tekst fra alle AI'ens beskeder i opgaven. Spørg "Skal jeg gemme dette som plan?", når tre af de fire afsnit findes. Vis kun "Byg videre", når svaret ligner en plan.
- Bevar arbejdsmåden og planen ved fejl og Stop, og tilbyd "Byg igen" og "Lav planen om". "Prøv igen" skal sende i samme arbejdsmåde som den opgave, der mislykkedes.
- Skift væk fra at bygge efter planen, når bygningen er færdig, eller spørg brugeren. Giv de to slags Byg hver sin etiket, og flyt valget af arbejdsmåde ud ved skrivefeltet.
- Markører må kun virke i Samtale og må aldrig trække en plan tilbage. Fjern kendte markører fra al vist tekst.
- Erstat listen over byggesætninger med en tydelig "Byg nu"-knap, som AI'en kan tilbyde.
- Lad "Ret med AI" sende i Byg.
- Brug egne Aura-agenter til Samtale og Planlæg, så OpenCodes påmindelse ikke indsættes. Giv Byg et kort, særskilt sæt regler ("Du er i Byg. Byg nu.") uden planlægningsregler og uden indbyrdes modsigelser. Begræns spørgeværktøjet i Byg.

## 4. Motoren genstartes, og AI'en glemmer samtalen

**Det oplevede brugerne:** AI'en mister tråden og svarer, som om samtalen ikke fandtes. Hvert skift giver ekstra ventetid.

**Årsagen:** Aura binder motoren og OpenCode-sessionen til et "fingeraftryk" af alt det, der vises i "Før du sender": forbindelse, model, arbejdsmåde, plan, referencer, skills og funktioner. Fingeraftrykket omfatter også projektets designstatus, som skifter, så snart AI'en har ændret startsiden. Når noget af det ændrer sig, lukkes motoren, og en ny session starter.
- Ved skift af arbejdsmåde følger de seneste 16 beskeder med som tekst. Værktøjsresultater og læste filer følger ikke med.
- Inden for samme arbejdsmåde får den nye session *ingen* historik. Det gælder fx anden besked efter første version, et modelskift og valg af en reference. Afkrydsningen "Medsend en ekstra kopi af tidligere samtale" er slået fra og skjult i nye samtaler. Samtidig siger "Før du sender" altid, at AI'en kan bruge tidligere beskeder.
- Når kommandosandkassen er aktiv, genstartes motoren ved hver besked. Stop, fejl og skift til en anden samtale i samme projekt giver også en kold start.

**Bevis:**
- `core/chat-session.cjs:200`, `:202-204`, `:207`, `:216`, `:232-234`, `:299`, `:314`, `:598`, `:636`; `core/projects.cjs:108`, `:117`; `ui/index.html:94`; `ui/app.js:406-407`, `:700`, `:716`; `core/workbench.cjs:90`. *læst*
- Målt: mellem besked 1 og 2 var designstatus det eneste felt, der ændrede sig. Det gav genstart og en ny session med 2 beskeder uden tekst fra den første opgave. En kold start kostede 2,4–5,4 s ekstra mod 0,56 s med varm motor (load 25–50). Med automatiske kommandoer genstartede motoren ved alle tre beskeder. *kørt*
- Målt: "Mit navn er Kaj." til model A, derefter skift til model B og "Hvad hedder jeg?". Svaret var "Det ved jeg ikke.", og der kom ingen advarsel. *kørt*

**Retning:**
- Del fingeraftrykket i to. Motorens identitet (forbindelse, model, skills, sandkasse og tilladelser) styrer, hvornår motoren genstartes. Arbejdsmåde, plan og design hører kun til prompten for den enkelte besked.
- Konfigurér agenterne for Samtale, Planlæg og Byg i samme motor, og skift agent for hver besked i samme OpenCode-session. OpenCode understøtter valg af agent pr. prompt.
- Ved skift af model eller forbindelse sendes de seneste beskeder automatisk med. Alternativt skal første lag sige tydeligt, at den nye model starter forfra. Ret teksten i "Før du sender".
- Start motoren, når projektet åbnes, og lad være med at genstarte den ved hver besked på grund af sandkassen.

## 5. Én fejl hos udbyderen stopper hele opgaven

**Det oplevede brugerne:** "AI'er svarer ikke." Opgaver, der stopper midt i, eller "Arbejder …" i lang tid.

**Årsagen:**
- Ved det første fejlsvar fra udbyderen, fx 429 (for mange kald) eller 503, markerer Auras gateway forbindelsen som død og svarer 409 på alle senere kald, også på OpenCodes egne genforsøg. Opgaven afsluttes som fejl, motoren lukkes, og planen trækkes tilbage (afsnit 3). Med cirka 40 deltagere på samme udbyder er grænser for antal kald sandsynlige, men det er ikke kontrolleret.
- En model, der kun sendte keepalive-signaler, holdt Aura i "Arbejder …" i 20 minutter. Derefter bad fejlteksten brugeren kontrollere internetforbindelsen. En model, der ikke svarede, gav fejl efter cirka 2,5 minutter. Efter 15 s uden indhold står der "Ingen nye signaler i N s. Du kan vente eller stoppe.", men med 10 px grå tekst og uden automatisk afslutning.
- Motoren skal starte inden for 30 s. Ellers lyder fejlen "Agentmotoren kunne ikke starte. Kontrollér installationen." Løber versionskontrollen i CLI'en tør for tid, kommer en udviklerbesked om `npm run runtime:prepare`. Om deltagernes maskiner ramte grænsen, er **uafklaret**.
- Når "Byg og kontrollér automatisk" er slået til, starter opgaven slet ikke, hvis tjekket af sandkassen fejler.
- Gatewayen smider udbyderens egen fejltekst væk.

**Bevis:**
- `core/gateway.cjs:16`, `:20`, `:63`; `core/chat-session.cjs:304-305`, `:594-598`. Målt med én indsat 429 ved kald 2: OpenCode alene prøvede igen efter cirka 1,1 s og gennemførte alle 8 kald. Aura stoppede efter 4,1 s og lavede ingen flere kald. Ved 429 og ved 503 nåede kun ét kald frem. *kørt*
- `core/gateway.cjs:6`, `:25`, `:59`, `:73`; `ui/chat-display.js:35`; `ui/styles.css:899`. Målt: med keepalive kom fejlen efter 1.253 s, med en model der ikke svarede efter 152 s. *kørt*
- `core/engine.cjs:31`, `:223`; `cli/runtime.cjs:26`. Motorstarten målt til 21–30 s under load omkring 150, og én start fejlede med netop den tekst. *kørt*
- `core/chat-session.cjs:193`. *læst*

**Retning:**
- Prøv igen med stigende pause ved 429 og 5xx, et begrænset antal gange, og respektér `Retry-After`. Kun 401, 402, 403 og 404 skal være endelige med det samme.
- Træk ikke planen tilbage ved forbigående fejl.
- Indfør en vagt pr. opgave: hvis der ikke kommer indhold i et stykke tid, vises en synlig besked med "Vent" og "Stop og prøv igen". Keepalive tæller ikke som aktivitet. Den samlede tidsgrænse får sin egen, korrekte fejltekst.
- Brug samme forklaring om langsom start ved motorstart som ved versionskontrol, og log den faktiske starttid.
- Vis udbyderens egen fejltekst bag "Se detaljer" (afsnit 10).

## 6. React og servere når ikke frem til forhåndsvisningen

**Det oplevede brugerne:** "Den efterspurgte en server med React – men fik vi en forhåndsvisning?" "Luk den boks." Stort problem med alt andet end ren HTML.

**Årsagen:**
- **AI'en starter selv serveren.** Auras regel siger, at brugeren skal gennemgå installationen, og at AI'en ikke selv må starte baggrundsprocesser. Reglen håndhæves ikke, og AI'en har intet værktøj til at starte forhåndsvisningen. Kører modellen `npm run dev`, venter OpenCode 120 s, dræber serveren og opfordrer modellen til at prøve igen med en længere grænse. Med sandkassen aktiv fejler kommandoen i stedet efter 5,6 s. Forhåndsvisningen får aldrig kendskab til serveren, og AI'ens slutbesked peger på en adresse, der ikke svarer.
- **"Boksen".** Forhåndsvisningsdialogen kræver 3–6 klik gennem to gennemgange med teknisk tekst ("Det er ikke en isoleret sandbox …"). Den lukker ikke, når der står "Forhåndsvisningen kører.", og samtykket huskes ikke.
- **Aura kigger det forkerte sted.** Kun et dev-script, der er præcis `vite`, `vite dev` eller `vite serve`, kører gennem Auras egen opstart. Alt andet kører som "tjenester", hvor Aura i 45 s kun spørger `127.0.0.1` på en port, Aura selv har tildelt. Vite ignorerer den port og lytter som standard kun på `[::1]`. Derfor fejler `vite --port 4399`, `vite --host`, et `start`-script med vite og en Node-server med fast port efter 45 s, selv om loggen siger "ready". Selv `vite --port $PORT`, som følger halvdelen af Auras egen regel, fejler. "Tilslut en anden server" rammer samme problem.
- **Projekttyper genkendes snævert.** FastAPI genkendes kun i `main.py` og Flask kun i `app.py`. Streamlit, `server.py`, PHP, mapper med `frontend/` og `backend/` og en app oprettet i en undermappe giver alle "Projektet har ingen package.json." Det sidste er netop det, modellen gør med `npm create vite@latest <navn>`. pnpm understøttes ikke. Flask uden `requirements.txt` bliver startet og fejler. Egen opstart kan kun angives i en skjult formular og gemmes i appdata. AI'en kan derfor ikke skrive opsætningen, selv om reglerne beder den beskrive tjenesterne.
- **AI'en får intet at vide.** Serverloggen sendes aldrig til AI'en, og der er ingen "Ret med AI" for serverfejl.
- **CDN.** Eksterne scripts blokeres som standard. Aura opdager det nu, men viser det kun som et lille link. Siden er tom eller hænger på "Indlæser …", mens AI'en skriver, at den virker. Der findes allerede en netliste pr. projekt (Projektets indstillinger → Forhåndsvisning → Se detaljer → Scripts), men diagnosen henviser ikke til den. Den statiske forhåndsvisning mangler desuden `'unsafe-eval'` (*læst, ikke kørt*).
- **Fejl i HTML.** Valget "Enkel hjemmeside" findes ikke i Projektets indstillinger, fordi et `<option>`-mærke er skrevet forkert.

**Bevis:**
- `core/project-guidance.cjs:5`, `:24`; `core/engine.cjs:59`; OpenCode-binæren (`kO=120000, LO=600000`). Målt: `npm run dev` kørte i 121,8 s. Port 5173 lyttede kun på `::1` fra 67 til 149 s, og forhåndsvisningen viste hele tiden "Start forhåndsvisning". I sandkassen: exit 1 efter 5,6 s. qwen3:8b kørte `npm create vite`, `npm install` og `npm run dev` trods reglen og bad til sidst brugeren køre `npm run dev` selv (1 kørsel). *kørt / qwen3:8b*
- `ui/server.js:9`, `:63`, `:74-77`. Målt: 6 klik uden installation fra AI'en, 3 klik plus "Luk" med installation. Dialogen stod åben over den kørende app. *kørt*
- `core/dev-server.cjs:51`, `:293-319`. Målt: `vite` kørte efter 1–3 s. `vite --port 4399`, `--host`, `start: vite` og fast port gav fejl efter 45,3 s, `vite --port $PORT` efter 46 s. `vite --host $HOST --port $PORT` virkede. *kørt*
- `desktop/main.cjs:667-671`, `ui/index.html:209`. `127.0.0.1:5173` svarede ikke, `localhost:5173` svarede. *kørt*
- `core/project-runtime.cjs:72-80`, `core/dev-server.cjs:38`, `desktop/main.cjs:645`, `core/store.cjs:41`. *kørt*
- `core/dev-server.cjs:201`; `ui/server.js:33-39`. *læst*
- `core/project-runtime.cjs:89-94`, `core/preview-policy.cjs:37`, `ui/index.html:367-373`. Målt: tom side med React og Babel fra unpkg og "Indlæser …" med et importmap til esm.sh. *kørt*
- `ui/index.html:365`: `</option value="static">Enkel hjemmeside</option>`. Målt: kun én option i appen. Fejlen kom ind i `5ffe905`. *kørt*

**Retning:**
- Giv AI'en et eget værktøj, der starter forhåndsvisningen gennem Auras DevServer og returnerer status og maskeret log. Send kendte serverkommandoer (`npm run dev`, `vite`, `next dev`, `flask run`, `uvicorn`, `python -m http.server`) dertil i stedet for at lade dem blokere.
- Brug ét samtykke i almindeligt dansk ("Må Aura installere og starte appen?"), som huskes, indtil `package.json` eller lockfilen ændres. Dialogen lukker selv, og teksten om sandkasse og npm ligger under "Se detaljer".
- Afgør, om appen er klar, ud fra serverens egen "Local:"-linje eller de porte, processen faktisk lytter på, inklusive `localhost` og `::1`. Kør alle scripts, der starter med `vite`, gennem Auras opstart, og kig også i undermapper.
- Læg opstarten i en fil i projektet (fx `.aura/preview.json`, eller understøt `.claude/launch.json`). AI'en skriver filen, og brugeren godkender den som en almindelig filændring.
- Giv serverfejl en "Ret med AI"-knap, der sender den maskerede log, og skriv fejlteksten på dansk ("Appen startede på en anden adresse, end Aura forventede.").
- Send CDN-diagnosen til AI'en, og lad brugeren tillade den konkrete adresse med ét klik (beslutning). Udvid kontrollen til importmap og ESM-imports.
- Ret `<option>`-mærket, og tilføj en prøve, der tæller valgene og fejler på den nuværende kode.

## 7. AI'en bygger i blinde og uden de sædvanlige designmidler

**Det oplevede brugerne:** Det, Codex eller Claude Code laver i ét hug, går i stykker i Aura. Resultaterne er ikke så flotte, selv med samme model.

**Årsagen** (alle delvist bekræftet; virkningen på kode og design er ikke målt med en stærk model):
- **Byggeløkken er brudt af godkendelser og prompt, ikke af manglende evne.** AI'en kan godt køre kommandoer, men hver kommando kræver et klik. Prompten siger ubetinget, at "hver kommando skal godkendes", og at kommandoer kun skal bruges, når det er nødvendigt. OpenCodes egen grundprompt siger derimod, at modellen *skal* køre lint og typetjek. Sprogserveren (LSP) er slået fra, så en filskrivning kun svarer "Wrote file successfully." Kontrollen af forhåndsvisningen (`preview:check`) findes, men intet kalder den, og loggen gives aldrig til AI'en. Designskill'en kræver skærmbilleder, men AI'en har intet værktøj til at se siden. Sandkassen spærrer localhost (afsnit 9).
- **Design.** Designskill'en har seks generelle punkter, og resten handler om tilgængelighed og proces. Der står intet om typografisk skala, afstande, farvetokens, ikoner eller skrifttyper. Den mere sandsynlige forskel til samme model andre steder er, at modellernes sædvanlige genveje til et pænt resultat er spærret i forhåndsvisningen eller koster begrundelser og godkendelser. Det gælder Tailwind fra CDN, webskrifttyper og eksterne billeder. Prompten siger ikke, hvad der må bruges i stedet. Skrifttyper i CSS og eksterne billeder kontrolleres ikke på forhånd og falder bare stille tilbage. En designpakke gemmes kun som navn, farve, links og filer.
- **Startpunktet.** Et nyt projekt er en pladsholder på 566 byte HTML, og README siger "Kun public/ vises". Reglerne nævner stadig en Georgia-skrift, som ikke længere findes. Modellen vælger React alligevel, men opretter appen i en undermappe, som forhåndsvisningen ikke finder (afsnit 6).
- **Lave grænser for ukendte modeller.** Uden katalogdata får en model 4.096 tokens til svar og 32.768 i kontekst. Det gælder fx en egen server med GLM og Mistral-modeller, der ikke har et af de kendte navne (`mistral-small-latest` fik 4.096). Store filer kan blive skåret af. Corti, Alexandra og OpenRouter med katalogdata er ikke ramt.
- **Grundprompten.** GLM og corti-s1 får OpenCodes generiske "interactive CLI tool"-prompt med krav som "færre end 4 linjer" og "ingen kommentarer". Den er den samme som i OpenCode alene og forklarer derfor ikke en forskel til OpenCode, kun til værktøjer med deres egen prompt. Virkningen er ikke målt.

**Bevis:**
- `core/engine.cjs:59`, `:80`, `:91`; `core/project-guidance.cjs:5`, `:24`, `:38`; `core/approvals-policy.cjs:118`; `desktop/main.cjs:693`; `desktop/preload.cjs:10`; `core/dev-server.cjs:201`; `profiles/skills/harness-design-og-tilgaengelighed/SKILL.md:12-17`, `:36`. Målt: de 10 værktøjer i Byg er bash, edit, glob, grep, question, read, skill, todowrite, webfetch og write. *kørt*
- `core/preview-policy.cjs:23-32`, `:37`; målt afvist for fonts.googleapis.com, fonts.gstatic.com, images.unsplash.com, cdn.jsdelivr.net og unpkg.com. `core/project-guidance.cjs:20`, `:25`; `profiles/grundregler.md:34`; `core/project-runtime.cjs:85-101`; `core/designs.cjs:21`. *kørt / læst*
- `core/projects.cjs:55`, `:57`, `:63`, `:64`; `core/project-guidance.cjs:11` (forældet siden `e75a1b6`). qwen3:8b valgte `npm create vite@latest lokalebooking -- --template react-ts` i 2 af 2 kørsler. *qwen3:8b*
- `core/connections.cjs:250-252`. Målt: `max_tokens: 4096` i kaldet for en egen server. *kørt*
- Fanget grundprompt for corti-s1. OpenCode sender modellens tænkning med mellem trinene, så den mulige forklaring, at tænkningen går tabt, er afkræftet. *kørt*
- Ingen af ni A/B-kørsler med qwen3:8b skrev filer inden for 4–6 trin. Forsøgene siger derfor intet om selve kvaliteten. *qwen3:8b*

**Retning:**
- Prompten skal passe til de faktiske indstillinger og kræve: "Byg og typetjek, og ret fejl, før du melder færdig." Kommandoer i projektet kører automatisk i sandkassen, når den er rettet (afsnit 1 og 9).
- Kør forhåndsvisningens kontrol efter hver byggeopgave, og giv resultatet til AI'en: maskeret log, konsolfejl og skærmbilleder i mobil- og desktopbredde. Alternativt får AI'en et værktøj, der gør det. Overvej en sprogserver til TypeScript, der følger med appen.
- Lav en konkret designskill med skala for typografi og afstande, farvetokens som CSS-variabler, tilstande (hover, fokus, tom, fejl og indlæsning), ikoner som inline SVG og lokale skrifttyper. Skriv de tilladte alternativer lige ved forbuddet mod CDN. Gem designpakken én gang i projektet, fx som `docs/design.md` og `tokens.css`.
- Gør README og `harness.json` neutrale, og fjern Georgia-linjen. Overvej rigtige startskabeloner pr. teknologi, som virker uden net (beslutning).
- Hæv standardgrænserne for ukendte modeller, brug oplysningerne fra `/models`, og sig tydeligt til, når et svar stopper på længdegrænsen.
- Overvej en grundprompt, som Aura selv ejer (beslutning).

## 8. Prompten er stor, gentager sig og skubber mod proces

**Det oplevede brugerne:** Langsomt i forhold til andre værktøjer med samme model. 1.552.316 tokens ind for én lille app. Spørgsmål og dokumentation i stedet for kode.

**Årsagen:**
- Aura sender cirka 2,3 gange så mange input-tokens pr. kald som OpenCode alene. System og værktøjer fylder cirka 16.600 tokens mod 7.200, og systemteksten alene 12.333 mod 2.091. Grundreglerne sendes to gange, fordi nye projekter får `AGENTS.md` som en ordret kopi af dem.
- I Byg efter en plan står planen tre gange i systemprompten efter én planrunde, og flere gange efter flere runder. Det gælder hvert eneste kald.
- Tekst om udgivelse (Vercel, komplai, Promte, Azure, Cloudflare, Flutter …) sendes også, når Udgiv er slået fra.
- Stien til den midlertidige mappe med opgavens unikke id står tidligt i systemprompten. Det forhindrer udbyderen i at genbruge den del af samtalen, den allerede har set (præfiks-cache), ved første kald i hver ny besked. Om Corti cacher, er **uafklaret**.
- **Skills.** Syv af ti skill-beskrivelser siger, at de passer til ethvert kodeprojekt, og OpenCode beder modellen hente en skill, når beskrivelsen passer. Skill'en Idé og afgrænsning siger "Byg ikke, før beskrivelsen er bekræftet", og Eksisterende projekt siger "Spørg, før du kører tests eller bygger". Det er ikke vist, at Auras egen sætning "før du går i gang" gør udslaget.
- Faste trin før og efter hver besked koster cirka 1–3 s: tjek af sandkassen, hentning af modelkataloget, Git-checkpoints (11 og 32 git-processer) og et skærmbillede før Byg (op til 6 s, *læst*).

Hvor meget størrelsen forsinker, er **uafklaret**. Den koster med sikkerhed tokens og penge, men forsinkelsen afhænger af, om Corti cacher, og den er kun målt i lokal Ollama på en belastet maskine.

**Det er ikke årsagen (bekræftet):** Gatewayen holder ikke strømmen tilbage (første byte efter 4,6 ms direkte mod 6,5 ms gennem gatewayen). Ventetiden mellem trinene er kortere i Aura end i OpenCode alene (77–338 ms mod 415–1.304 ms). Der laves ingen titelkald.

**Bevis:**
- `core/chat-session.cjs:325-327`; `core/projects.cjs:59-60` (byte-identisk med `profiles/grundregler.md`); `core/project-instructions.cjs:34`. Målt: systemprompten fylder 39.741 tegn mod 9.687, og 7 kald sender 471–475 KB mod 279 KB. *kørt*
- `core/chat-session.cjs:274`, `:335`, `:337`, `:338`, `:616`. Målt: planens testsætning stod 240 gange (3 × 80) på alle 7 Byg-kald. *kørt*
- `core/hosting-guidance.cjs:69`, `core/project-guidance.cjs:52`. *kørt*
- `core/chat-session.cjs:332`. Målt: inden for en opgave var 97–99 % af begyndelsen af kaldet den samme som i forrige kald. Ved en ny besked var det 73,1 %, og bruddet lå præcis ved id'et. *kørt*
- `profiles/skills/harness-ide-og-afgraensning/SKILL.md:8`, `:21`; `profiles/skills/harness-eksisterende-projekt/SKILL.md:12`; `core/project-guidance.cjs:50`. qwen3:8b hentede 7 skills i første trin (2 af 2). Med Auras fulde Byg-prompt var Idé og afgrænsning første handling i 3 af 3, uden skill-listen i 0 af 3. Én kørsel brugte 9 skill-kald og en komprimering (cirka 206.000 prompt-tokens), før en fil blev rørt. *qwen3:8b*
- `core/chat-session.cjs:192`, `:292`, `:298`, `:596`; `core/workbench.cjs:290`. *kørt*
- `core/gateway.cjs:68`, `core/engine.cjs:80`; målinger af gatewayen og af ventetiden mellem trin. *kørt*

**Retning:**
- Send grundreglerne én gang: skriv dem ikke ind i `AGENTS.md`, eller spring filen over, når indholdet er identisk. Send planen én gang. Send kun teksten om udgivelse, når Udgiv er slået til.
- Hold systemprompten byte-identisk mellem beskeder, og læg tekst, der hører til den enkelte opgave, i brugerbeskeden.
- Giv skills snævre beskrivelser, og skil skills til at bygge fra skills om data, sikkerhed og dokumentation. De sidste hentes kun på anmodning eller før udgivelse (beslutning). Idé og afgrænsning hører til Planlæg.
- Gem resultatet af sandkassetjekket for hele app-sessionen, og brug det gemte modelkatalog. Kør checkpointet samtidig med motorstarten, vis resultatet, før versionen gemmes, og vent ikke på skærmbilledet før opgaven.

## 9. Kommandosandkassen: ét klik ændrer alt

**Det oplevede brugerne:** Efter "Tillad altid" på en kommando blev det værre. Lokale servere, Python og Git fejlede, og der dukkede lange Linux-kommandoer op.

**Årsagen:**
- Ét "Tillad altid i projektet" på en hvilken som helst kommando slår sandkassen til for alle senere kommandoer i projektet og genstarter motoren ved hver besked. Kortet siger ikke noget om det.
- I sandkassen kan en kommando ikke lytte på eller forbinde til localhost og ikke læse `.git`. Systemets værktøjer på macOS (python3, git og make via xcode-select) fejler. AI'en får ikke at vide, at localhost er spærret.
- Sandkassen omskriver kommandoen, og OpenCode gemmer den omskrevne version. Modellen får derfor sine egne kommandoer tilbage som cirka 2.400 tegn lange `exec /usr/bin/env -i PATH=…`-linjer, og Aktivitet viser det samme. Selve kortet viser den oprindelige kommando. Virkningen på modellens kvalitet er ikke målt.
- Regelnøglen skifter form. Den første kommandoregel gemmes i en opgave uden sandkasse, hvor input er tomt. I senere opgaver med sandkasse er input fuldt eller indeholder opgavens id. Derfor matcher reglen næsten aldrig.
- npm-cachen ligger i opgavens nye midlertidige mappe, så hver installation starter forfra.
- Windows har ingen sandkasse.

**Bevis:**
- `core/chat-session.cjs:196`, `:299`; `ui/approvals.js:110`. *læst*
- `core/command-sandbox.cjs:46-49`; `core/chat-session.cjs:333`. Målt: en Node-server gav `listen EPERM 127.0.0.1:5199`. `python3 --version`, `python3 app.py`, `git --version` og `make --version` gav exit 1 med en xcode-select-fejl. Alle virker uden sandkasse. Sandkassen kostede 0,3–1,4 s ekstra pr. kommando. *kørt*
- `core/command-sandbox.cjs:57`; `core/activity.cjs:46`, `:60`. Målt: tre kommandoer blev sendt tilbage til modellen som 2.442–2.449 tegn. Sidste modelkald var 17.329 tegn mod 10.106 uden sandkasse. *kørt*
- `core/approvals-policy.cjs:155`. Målt: regler gemt med tomt input gav 0 automatiske godkendelser i 6 forsøg. Indpakningerne fra to opgaver adskiller sig fra tegn 404. *kørt*
- `core/command-sandbox.cjs:23`, `:47`; `core/chat-session.cjs:286`. *læst*

**Retning:**
- Lad sandkassen tillade localhost (127.0.0.1 og ::1) og lytning på projektets porte, læsende Git og systemets værktøjer. Hvilke netadresser der ellers må nås, er en beslutning.
- Bevar den oprindelige kommando i OpenCodes historik og i Aktivitet.
- Nøgl reglerne på den oprindelige kommando eller på en kategori.
- Gør det synligt, når et valg ændrer alle kommandoer, eller skil "husk denne kommando" fra "kør alle kommandoer i sandkasse".
- Genstart ikke motoren ved hver besked. Gem resultatet af sandkassetjekket, og vis én klar besked, hvis isolationen ikke kan starte.
- Brug én delt npm-cache, og find en løsning til Windows (beslutning).

Disse rettelser er en forudsætning for, at "projektmappen er grænsen" (afsnit 1) kan virke for React og servere.

## 10. API-nøgler bliver ikke renset, og fejlbeskederne peger forkert

**Det oplevede brugerne:** En Corti-nøgle, der manglede `==`, blev afvist, og Aura hjalp ikke. Det er svært at sætte nøgler ind.

**Årsagen:**
- Aura renser ikke indsatte nøgler, hverken i appen eller i CLI'en. Følgende sendes uændret og afvises: manglende `=` til sidst, mellemrum eller hårdt mellemrum foran, anførselstegn samt `Bearer ` eller `CORTI_API_KEY=` foran. Med `Bearer ` foran sendes en EU-S-nøgle desuden til EU-adressen.
- Usynlige eller typografiske tegn (fx nulbreddetegn og “ ”) får Node til at fejle, før kaldet bliver sendt. Aura oversætter det til "Serveren svarer ikke. Kontrollér adresse, port, netværk og eventuelt Tailscale." Det gælder alle otte udbydere.
- Aura læser aldrig udbyderens fejlsvar. En afvisning fra Corti siger altid, at "en nøgle virker kun i sit eget miljø", også når Corti svarer "API key is not valid base64".
- I den guidede opsætning gemmes forbindelsen, før nøglen er kontrolleret. Nøglefeltet er tomt ved "Ret oplysninger", så nøglen skal sættes ind igen. Standardnavnet er "Corti S1 · EU", også for EU-S. Redigering fra dialogen gemmer helt uden kontrol.
- Udbydervælgeren viser 10 kort, selv om `desktop/DESIGN.md:26`, `decisions.md:46` og AGENTS.md har besluttet fire kort plus "Vælg en anden". `verify-setup.cjs:47` fastlåser afvigelsen. Det er ikke et åbent spørgsmål, men en afvigelse fra en beslutning, der allerede er truffet.
- Adressefelterne for Azure og Ollama afviser almindelige kopier med misvisende tekst. Det rammer færre.

**Bevis:**
- `core/connections.cjs:90`, `:104`; `ui/app.js:915-916`; `cli/terminal.cjs:36`; `core/workbench.cjs:221-235`. Målt med en streng efterligning af Corti og en syntetisk EU-S-nøgle: korrekt nøgle og mellemrum bagved virkede. Uden `==`, med ét `=` for lidt, med mellemrum eller hårdt mellemrum foran og med anførselstegn blev nøglen afvist. Med `Bearer ` eller `CORTI_API_KEY=` foran blev den sendt til EU og afvist. Samme resultat i Electron. *kørt*
- `core/connections.cjs:124-125`. Målt med nulbreddetegn og typografiske anførselstegn: "Serveren svarer ikke …", og intet kald nåede frem. *kørt*
- `core/connections.cjs:127-128`; `core/gateway.cjs:59-60`. *kørt*
- Målt i Electron: den fejlede forbindelse blev gemt, nøglefeltet var tomt ved "Ret oplysninger", navnet var "Corti S1 · EU" med adressen `ai.eu-s.corti.app`, og der var 10 udbyderkort. Teksten "Forbindelsen er gemt." står i en skjult del og ses ikke i det guidede forløb. `ui/app.js:926`. *kørt*
- `core/connections.cjs:72-76`, `:113-117`. *kørt*
- At den rigtige Corti afviser en nøgle uden `=`, bygger på din note og ikke på en måling.

**Retning:**
- Lav én fælles rensefunktion i `core/connections.cjs`, som både kontrol og gem bruger. Den fjerner blanktegn og usynlige tegn, omsluttende anførselstegn samt `Bearer `, `Authorization:` og `NAVN=` foran. For Corti tilføjer den manglende `=`. Er nøglen for kort, siger den "Nøglen ser afkortet ud. Brug Kopiér-knappen i Corti Console." Vis kort, hvad der blev rettet, og hvilken region nøglen hører til, før den gemmes.
- Afklar først, om der findes gyldige Corti-nøgler uden miljøpræfiks. `desktop/tests/providers.test.cjs:112` fastlåser i dag, at sådanne nøgler stille falder tilbage til EU.
- Skeln mellem ugyldigt tegn, tidsudløb og netværksfejl. Læs en begrænset del af udbyderens fejlsvar, fjern alt, der ligner nøgler, og vis resten bag "Se detaljer". Oversæt kendte mønstre til dansk.
- Kontrollér nøglen, før den gemmes. Behold den maskeret til et nyt forsøg, og navngiv forbindelsen efter regionen.
- Ret udbydervælgeren og `verify-setup.cjs`, så de følger den besluttede regel.
- Udtræk Azure-ressourcens adresse fra en fuld URI, og tilføj `http://` for localhost.

## 11. CLI'en

**Det oplevede brugerne:** Corti EU og EU-S virkede ikke i CLI'en. Låsefiler og processer, der hænger. Ingen nøglering.

**Årsagen:**
- **To forskellige CLI'er har samme versionsnummer, 0.2.0-beta.6.**
  - Den udgivne (tag `cli-v0.2.0-beta.6` = `6d71813`, 13. oktober) kender kun EU og Frankrig. Den sender en EU-S-nøgle til EU, hvor nøglen afvises med en besked, der ikke nævner EU-S.
  - Versionen fra HEAD kender EU-S, men kan slet ikke køre en AI-opgave, når den er pakket eller installeret efter README. Et plugin, der kom ind natten før hackathonen (`5ffe905`), ligger i `desktop/node_modules`, som hverken er med i pakken eller i rodens lockfil. Fejlen er en rå engelsk ENOENT, mens `aura doctor` siger, at alt er i orden. Det rammer kun dem, der byggede fra repoet efter `5ffe905`.
- **Låse og efterladte motorer.** Kun SIGINT og SIGTERM håndteres. Lukkes terminalvinduet, eller går CLI'en ned, bliver låsefilen liggende, og næste start nægtes. `aura unlock` uden lås giver en rå fejl. OpenCode-serveren holder ikke øje med, om programmet, der startede den, stadig kører, så den lever videre. Det gælder også desktopappens motor, hvis Electron går ned, og det gælder også den udgivne version.
- Et mislykket login gemmer alligevel forbindelsen, så der opstår dubletter med samme navn. Der findes ingen kommando til at rette en nøgle.
- Ctrl+C afbryder ikke hentningen af modellisten. Efter 15 s kommer en misvisende netværksfejl.
- Login giver ingen hjælp til nøgle og region. Adgangssætningen spørges i hver session, kan ikke gendannes og kan ikke nulstilles, og der er ingen nøglering. Lageret med adgangssætning er et bevidst designvalg; ønsket om nøglering er dit.
- Godkendelser vises som rå JSON (afsnit 1).
- CLI-prøverne består (26 af 26), men dækker intet af ovenstående. Proceduren for at prøve den installerede pakke findes (`docs/udgivelse-cli.md:17`), men CLI-ændringerne i HEAD er hverken pakket, pakkeprøvet eller udgivet.

**Bevis:**
- `git show 6d71813:desktop/core/connections.cjs:64`, `:70`. Målt: den gamle kode sender EU-S-nøglen til `ai.eu.corti.app`, HEAD til `ai.eu-s.corti.app`. *kørt*
- `core/engine.cjs:99`, `:131`, `:202`; `scripts/cli-release-contract.cjs:9-12`; `cli/runtime.cjs:26`. Målt: CLI'en bygget af pakkens 119 filer gav ENOENT, fra repoet virkede den. *kørt*
- `cli/aura.cjs:89`, `:102`; `cli/storage.cjs:64-68`, `:74`; `cli/app.cjs:20`; `desktop/main.cjs:960`. Målt: efter SIGHUP og SIGKILL levede motoren stadig og svarede HTTP 200 15 s senere, og låsen lå tilbage. *kørt*
- `cli/connections.cjs:10-46`; `core/connections.cjs:124`, `:151`; `cli/aura.cjs:83-87`; `cli/storage.cjs:41-62`. Målt: to mislykkede logins gav to forbindelser med samme navn, og en server, der ikke svarer, gav fejl efter 15,1 s. *kørt*

**Retning:**
- Gør pluginet til en afhængighed af rodpakken, og find det med `require.resolve`. Lad `doctor` kontrollere det. Kør pakkeprøven mod den faktisk pakkede tarball i en ren mappe ved hver udgivelse.
- Hæv CLI-versionen, hver gang `desktop/core` ændres. Udgiv en rettet CLI, eller træk den gamle tilbage (beslutning). Vis den fundne Corti-region ved login og i `doctor`.
- Håndtér SIGHUP. Gem motorens procesnummer, og stop en efterladt motor ved næste start. Overtag låsen, når ejeren er død. Lad motoren stoppe, når programmet, der startede den, forsvinder, også i desktopappen.
- Kontrollér nøglen, før den gemmes, eller fjern forbindelsen igen ved fejl. Nummerér navne, spørg om nøglen før navnet, og tilføj en kommando til at rette en nøgle.
- Lad Ctrl+C afbryde netkald.
- Giv hjælp til nøgle og region i login. Brug nøglering som standard med det nuværende lager som reserve (beslutning), og gør det muligt at nulstille nøglelageret.
- Tilføj prøver for Corti EU og EU-S, rensning af nøgler, SIGHUP og SIGKILL samt Ctrl+C under netkald.

## 12. komplai Run siger "Udgivet", før appen kan åbnes

**Det oplevede brugerne:** komplai Run giver ikke ordentlig besked, når hjemmesiden ikke er klar endnu.

**Årsagen:**
- **Der er ingen ventetilstand.** Lige efter upload står der "Udgivet", og hovedknappen er "Åbn appen", uden at adressen er kontrolleret. Et klik åbner en fejlside, og Aura skriver "Appen er åbnet i din browser."
- **Efter en kontrol er kortet stadig grønt** ("Udgivet – Bekræftet af komplai Run"), uanset hvad adressen svarer, og ved siden af står en vag advarsel ("Kontrollér startsiden"). HTTP-koden står under "Se detaljer" uden forklaring, og komplais egen fejlkode bliver smidt væk. Knappen til at kontrollere igen flyttes ind under "Se detaljer", og "Udgiv en ny version" bliver hovedknap. Svarer adressen slet ikke, låses dialogen i cirka 16 s, og bagefter beder teksten om en ny kontrol, hvis knap er gemt væk.
- **Den automatiske genkontrol er usynlig og stopper aldrig.** Den kører hvert 30. sekund, men resultatet når ikke ud i den åbne dialog. Topknappen viser kun udbyderens status, og der kommer ingen besked, når appen er klar.
- **komplais side** (læst i komplai.dk-repoet og kørt lokalt mod komplais egen publisher-kode; ikke observeret i drift):
  - Hackathonens organisation kørte på `shared_free` med én kontrolplads ad gangen. Hvert kald til komplais oversigt og hver upload optager pladsen. Aura laver 5 kald til oversigten og 1 upload pr. udgivelse og desuden 1 kald til oversigten pr. åbent projekt hvert 30. sekund. Med cirka 40 deltagere er kollisioner sandsynlige.
  - Aura har ingen tekst for komplais svar "busy". En upload, der får 503 busy, vises som "Upload ikke bekræftet — Åbn udbyderens oversigt …", selv om intet er uploadet, og det er sikkert at prøve igen.
  - komplai tillader højst 8 samtidige læsninger. Én besøgende, der hentede 21 filer samtidigt, fik 8 svar og 13 gange 503 busy. Browseren viser så appen halvt, blankt eller med komplais tekst "Der er travlt lige nu". Auras kontrol henter kun `index.html` og kan derfor sige "matcher", mens resten af filerne fejler.
  - Hackathonen havde ét fælles komplai-login (`hackathon@komplai.dk`). Brugte deltagerne det, så de hinandens apps som deres egne og kunne uploade oven i hinanden. I så fald var "En nyere version er udgivet" og "Startsiden er anderledes" korrekte beskeder om en reel overskrivning. Om alle brugte det fælles login, er **uafklaret**.
  - Nye app-adresser fik først certifikat ved første HTTPS-kald, fordi der ikke var et wildcard-certifikat. Om det gav ventetid eller fejl på dagen, er **uafklaret** og kræver komplais edge-logs.
- Beskeden efter upload bliver slettet med det samme.
- Promte og GitHub Pages/Cloudflare har samme mønster i koden. Intet viser, at de blev brugt på hackathonen.

**Bevis:**
- `core/deployments.cjs:110-121`, `:149-157`, `:164-179`; `core/komplai-publish.cjs:135`, `:181`; `ui/share-view.js:21-24`, `:50`, `:54`, `:69-73`; `ui/deployment.js:66`, `:267-269`, `:292-296`; `ui/index.html:297`; `ui/deployment-setup.js:282`, `:304`, `:327`. Målt i Electron mod en falsk komplai: ved 404, ved 502 og når adressen ikke svarede, stod der "Udgivet" med "Åbn appen" som hovedknap. Efter "matcher" fortsatte kontrollen hvert 30. sekund (3 + 3 kald på 65 s). *kørt*
- komplai.dk `services/publisher/server.mjs:316-317`, `:633-636`, `:860-862`; `infra/organisations/publishing/pilots/hackathon.prod.json` (`shared_free`, `shared_member`); `packages/platform-server/src/publishing.server.ts:861`, `:1062-1066`, `:2127`. Målt lokalt: en statuskontrol under en upload gav to gange 503 busy; to samtidige uploads gav 200 og 503; 21 samtidige filhentninger gav 8 × 200 og 13 × 503. *kørt mod komplais kode, lokalt*
- I Aura: en upload, der fik 503 busy, gav "Upload ikke bekræftet". Busy ved Udgiv gav "komplai kunne ikke gennemføre handlingen. Prøv igen." *kørt*
- komplai.dk `infra/organisations/publishing/Caddyfile:4-5`, `:27-28`; `services/publisher/server.mjs:628`; `infra/organisations/publishing/README.md:45`. *læst; uafklaret*

**Retning:**
- Indfør en ventetilstand med overskriften "Appen bliver gjort klar …" og teksten "komplai har modtaget din version. Aura tjekker adressen og siger til, når appen kan åbnes. Du kan lukke vinduet imens." Topknappen viser "komplai Run · Gøres klar …", og når appen er klar, står der "Appen er klar".
- Lad overvågningen køre i hovedprocessen og hente *kun appens adresse*, ikke komplais oversigt, så kontrolpladsen skånes. Intervallet stiger, og overvågningen stopper, når der er et resultat. Dialog og topknap opdateres med det samme.
- Gør kun kortet grønt, når adressen svarer med den nye version. Oversæt komplais koder korrekt: `not_found` (ingen app har navnet), `not_published` (ingen aktiv version), `busy` (travlt; intet er uploadet, prøv igen) og `transfer_limit` (trafikgrænsen er nået). Tolk ikke "anderledes indhold" som "gøres klar", for det kan være en reel overskrivning.
- Hold "Prøv igen nu" synlig, og gør aldrig "Udgiv en ny version" til hovedknap, mens appen ikke er klar.
- Overvej at kontrollere flere af appens filer end `index.html`.
- Brug samme model for Promte og GitHub Pages.
- På komplais side: egne logins pr. deltager og en pulje, der kan klare en hackathon (beslutninger i komplai.dk).

## 13. Tværgående: ændringerne blev ikke prøvet ende til ende

**Hvad det forklarer:** "Mange fejl."

- Godkendelsessystemet (`approvals-policy.cjs`, `command-sandbox.cjs`, `command-sandbox-runner.mjs` og `model-consent.cjs`), CLI'ens plugin og fejlen i "Enkel hjemmeside" kom alle ind i `5ffe905` kl. 02:07 den 23. oktober. De blev udgivet i `dce68ea` kl. 08:15 samme morgen. Samme nat blev det fremhævede valg "Tillad for denne opgave" fjernet, mens `desktop/DESIGN.md:60` stadig beskriver det.
- Ende-til-ende-prøven for godkendelser (`desktop/scripts/verify-approvals.cjs:82`, `:92`) leder efter tekster og knapper, der ikke længere findes, og kan ikke bestå på 0.6. *læst, ikke kørt*
- Enhedstestene for godkendelser bruger forespørgsler, som motoren aldrig sender. Vagten kan derfor ikke udløses på det rigtige input (`desktop/tests/approvals-policy.test.cjs:18-20`).
- CLI-prøverne kører mod udviklingsmappen, hvor den manglende afhængighed tilfældigvis findes.
- Ingen prøve tæller valgene i "Opstart", og testene for udgivelseskortet dækker hverken 404, 502 eller en adresse, der ikke svarer.

**Retning:**
- Lav kontrakttests med optagne forespørgsler fra den låste OpenCode-version.
- Lav en ende-til-ende-prøve med en typisk byggeopgave, der fejler, hvis antallet af kort overstiger en grænse.
- Opdatér `verify-approvals.cjs`, og lad pakkeprøven køre mod tarballen.
- For hver ny vagt skal det vises, at den fejler på det input, der var grunden til at lave den.
- AGENTS.md kræver, at man ser skærmen i appen og tæller valgene, før en skærm kaldes færdig. Det gælder også godkendelseskortene og forhåndsvisningsdialogen.

---

## Beslutninger, kun du kan træffe

1. **Alt i projektmappen.** Skal samtalehistorikken (`opencode.db` og Auras egen historik) ligge i projektmappen, så projektet er komplet og kan flyttes? Eller skal den blive i appdata af hensyn til privatliv og OneDrive-synkronisering, så kun arbejdsfiler (midlertidige filer, tool-output og skills) flyttes ind?
2. **Projektmappen som grænse.** Skal læsning, søgning, filændringer og kommandoer i projektmappen ske uden kort som standard i nye projekter? Og skal eksisterende mapper få ét spørgsmål, når de åbnes?
3. **Windows.** Hvad må køre eller huskes uden teknisk isolation: ingen kommandoer, eller en fast liste af ufarlige kommandotyper i projektmappen?
4. **Sandkassens netadgang.** Hvilke adresser må kommandoer nå som standard: localhost, npm, PyPI, GitHub?
5. **Forhåndsvisningen og internettet.** Må brugeren tillade en CDN-adresse med ét klik? Skal bestemte domæner for skrifttyper og billeder være tilladt som standard? Skal en fast liste af designpakker kunne installeres uden ekstra begrundelse?
6. **Serverstart.** Må AI'en starte forhåndsvisningen gennem Aura med ét samtykke pr. projekt, og skal den starte automatisk efter første bygning?
7. **Opstartsfil i projektet.** Skal opstarten ligge i en fil i projektet (fx `.aura/preview.json` eller `.claude/launch.json`), som AI'en skriver, og brugeren godkender?
8. **Log til AI'en.** Må log og konsolfejl fra forhåndsvisningen sendes maskeret til AI'en efter hver opgave? Projektkode kan skrive persondata i loggen.
9. **Arbejdsmåder.** Skal Samtale have sin egen agent adskilt fra Planlæg? Må Planlæg stille spørgsmål i flere runder? Skal Byg uden plan bygge med det samme, eller må den stille op til tre spørgsmål først?
10. **Skills.** Skal skills om data, sikkerhed og dokumentation kun bruges på anmodning eller før udgivelse? Skal modellen selv hente skills, eller skal Aura vælge dem pr. arbejdsmåde?
11. **Grundprompt og startskabeloner.** Skal Aura erstatte OpenCodes grundprompt med sin egen? Skal Aura oprette en rigtig start (Vite og React eller statisk) ud fra planen i stedet for pladsholderen?
12. **Før du sender.** Skal samtykket gælde pr. udbyder og model på tværs af projekter?
13. **Nøgler.** Må en forbindelse overhovedet gemmes, hvis kontrollen fejler? Skal CLI'en bruge systemets nøglering? Skal den gamle CLI 0.2.0-beta.6 trækkes tilbage fra terminalsiden, indtil en rettet version er udgivet?
14. **Udgivelse.** Skal "Åbn appen" være skjult eller vises som et tekstlink, mens appen gøres klar? Må Aura vise en systemnotifikation ("Din app er klar")? Hvor længe skal Aura vente, før den skifter til "Appen er ikke klar endnu"?
15. **komplai.dk** (uden for Aura): egne logins pr. deltager ved arrangementer, en pulje med mere end én kontrolplads og et wildcard-certifikat før næste større udgivelsesbølge.
16. **Motor og gateway.** Intet i fundene kræver, at OpenCode eller gatewayen udskiftes. Gatewayens gennemstrømning og OpenCodes ventetid mellem trinene er udelukket som årsager til langsomheden, og grundårsagerne ligger i Auras opsætning ovenpå. Gatewayens håndtering af fejl skal dog ændres (afsnit 5). Om motoren alligevel skal skiftes, er din beslutning.
17. **Betalte målinger.** Må der bruges betalte testkald hos Corti, og eventuelt hos andre udbydere, til at måle det, der er uafklaret nedenfor?

## Stadig uafklaret

- **Rigtige modeller.** Intet er kørt med GLM 5.3 (corti-s1), Claude eller Mistral. Det er derfor ikke målt, hvor ofte de bruger temp-mapper, skriver uden for projektet, kører `npm run dev` eller bruger CDN. Det er heller ikke målt, om de rammer planformatet, påvirkes af OpenCodes plan-påmindelse eller henter mange skills. Hvor mange kort et rigtigt forløb giver, er ikke målt.
- **Corti.** Det er uafklaret, om Corti genbruger begyndelsen af samtalen (cache), og hvad Cortis standardindsats for tænkning er uden `reasoning_effort`. Det er også uafklaret, om `max_tokens` på 128.000 mod 32.000 påvirker hastigheden, om Cortis GLM 5.3 genererer langsomt eller var belastet på dagen, og hvad Cortis API svarer på en nøgle uden `=`.
- **Hastighed på en almindelig pc.** Alle tider er målt under meget høj belastning. Motorstart, kold start og hvor ofte grænserne på 30 s og 15 s rammes, skal måles igen på en almindelig kommunal bærbar.
- **Tid pr. godkendelseskort** er ikke målt, selv om det sandsynligvis er den største enkeltpost i ventetiden. Det er også ukendt, hvor mange modelkald samtalen med 1.552.316 tokens havde.
- **Windows** er slet ikke afprøvet. Stier under `%APPDATA%` og `%TEMP%`, den manglende sandkasse og mønstrene for skills er kun læst i koden.
- **Hvilken CLI** deltagerne brugte. Den udgivne rammes af EU-S-fejlen, en klon af repoet af opstartsfejlen.
- **komplai på dagen.** Det er uafklaret, om certifikatudstedelsen for nye adresser gav problemer (kræver Caddy-logs og svar på, om `komplai.run` står på Public Suffix List), om alle brugte det fælles login, og om en båndbreddegrænse på 20 Mbit/s for hele værten var aktiv. Det er også ukendt, hvad deltagerne konkret så i browseren.
- **Hvilken "boks"** noten "luk den boks" mener: kommandokortet til `npm run dev` eller dialogen, der bliver stående.
- **Promte:** hvilke statusværdier Promte sender. Ukendte værdier vises i dag som "Upload ikke bekræftet".
- **OneDrive:** hvor mange kommuner der omdirigerer Dokumenter til OneDrive. Det afgør risikoen ved at lægge samtaledata i projektmappen.
- **Enkeltobservationer uden forklaring:** `npm run build` i sandkassen kørte over 120 s i Electron, mod 11,6 s i motoren alene. To tidlige kørsler under ekstrem belastning endte med "Fejl" uden modelkald. Det er ikke undersøgt, om OpenCodes filovervågning i projekter uden Git forsinker første svar.
- Next.js og Create React App ser ud til at blive startet korrekt, men er ikke kørt.
- Om OpenCode kan læse skills fra en anden mappe end `OPENCODE_CONFIG_DIR`. Det afgør, om skills kan ligge i `.aura/skills`.
- Om den manglende `'unsafe-eval'` faktisk får biblioteker fra CDN til at fejle.

## Rådata og praktiske noter

- Scripts, målinger og skærmbilleder ligger i `/private/tmp/claude-501/-Users-bjornskalkam-GitHub-os-harness/8f624b89-9f41-4c8d-93d3-a9b418bb254c/scratchpad/hackathon/`. Der er én mappe pr. tema og en tilhørende `-skeptiker`-mappe:
  - `filer-uden-for-projektet`
  - `godkendelser-og-kommandoer`
  - `hastighed`
  - `arbejdsmaader-og-svar`
  - `noegler-og-cli`
  - `react-og-sprog`
  - `komplai-feedback`
  - `kvalitet-og-design`
- To OpenCode-processer fra tidligere CLI-prøver kører stadig på maskinen: PID 71008 (siden 18. oktober) og PID 55121. Undersøgelsen har ikke stoppet dem, så det kan du selv gøre.
- En undersøger sendte ved en fejl `kill` til PID 79677, som var en `ugrep`-søgning fra en anden session. Ingen filer blev berørt, men den søgning kan være fejlet.
- Repoet er uændret: HEAD er `dce68ea`, og `git status` er tom.