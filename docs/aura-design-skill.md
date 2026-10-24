# Aura-design til dine apps

`harness-aura-design` er en vejledning til de apps, sider og præsentationer, du bygger med Aura Harness. Den er hovedskill ved byggeopgaver: fra en kort idé til et konkret brugerforløb, en passende designretning, fungerende handlinger og faktisk afprøvning. Brand-, token- og tilgængelighedsreferencer supplerer efter behov.

## Brug i Aura og dit eget kodeværktøj

Skillen følger den eksisterende funktion **Design og tilgængelighed** under **Indstillinger → Funktioner**. Er design slået til, indlæses hovedfilens kerne direkte i instruktionerne til første modelkald ved **Planlæg**, **Byg** og **Arbejd direkte**, på desktop og i Auras terminal. Modellen behøver ikke selv huske at hente skillen. Den almindelige samtaletilstand får ikke en tvungen byggeinstruktion. De længere referencer er fortsat tilgængelige efter behov. Et fravalg gælder fra næste besked og kan gælde alle projekter eller kun det aktuelle projekt. Der tilføjes ingen ny indstilling eller dialog.

Idéhjælpen før oprettelse bruger den globale designindstilling og samme kerne, men kan stadig kun foreslå tekst: ingen filadgang eller værktøjer. Den låner aldrig instruktioner fra et andet åbent projekt. En ændring af instruktionerne efter gennemgang kræver ny gennemgang før afsendelse.

Under **Tilpas instruktioner** kan du læse skillen, gemme en lokal projekttilpasning og gendanne bibliotekets fælles version. De eksisterende projektfiler og regler bevares.

Skillen følger også med de 23 instruktionspakker til kodeværktøjer. Den bruger hver adapters eksisterende skillplacering; instruktionspakken henviser til den som første skill ved byggeopgaver, når den er valgt. Pakkerne indeholder nu 13 almindelige skills; de fire systemintegrationer er fortsat særskilte tilvalg. Eksport understøtter filplaceringen, men er ikke bevis for, at hvert kodeværktøj eller en bestemt model følger instruktionerne.

Et eksempel på en opgave:

> Byg en oversigt over vores mødelokaler. Brug den lokale designguide og de vedhæftede skitser. Vis en repræsentativ skærm, før vi beslutter designretningen. Bevar den nuværende navigation og funktioner.

## Indhold og grænser

- Den fulde leverede vejledning om webapps/hjemmesider som reference samt en kort kerne, der tilpasser arbejdsmetoden til den konkrete opgave.
- Én-sætningsbrief med reversible standardvalg og kun nødvendige spørgsmål; ingen fast grøn palette eller obligatorisk hero til alle apps.
- Brandmetode med dokumenterede kilder og tydelige antagelser.
- 43 beskrevne designretninger som inspiration, herunder fem valgfrie kompositionsopskrifter. Der følger ingen downloadede SkillsUI-skills eller 43 færdige temaer med.
- Designbrief og kvalitetsgennemgang, appmønstre og vejledning til agentarbejdsrum og paneler. Det er instruktioner til brugerprojektet, ikke nye runtimefunktioner.
- Læsbare HTML-/CSS-eksempler og en valgfri offline tokengenerator med målte kontrastpar og inputvalidering.
- Kontrol af reelle brugerhandlinger, små skærme, zoom, tastatur, temaer og bevægelse med ærlig angivelse af, hvad der ikke er afprøvet.

Biblioteket indeholder **17 Markdown-filer**. Eksempelkode køres ikke ved indlæsning. Hvis den materialiseres eller køres i et brugerprojekt, gælder de normale fil- og værktøjsgodkendelser. Python er alene et valgfrit projektværktøj til generatoren og bliver ikke en afhængighed for Aura.

Skillen ændrer ikke Auras egen brugerflade, onboarding, planer, godkendelser, modelvalg eller adgang til data og netværk. Den indfører ingen Privacy Gate eller sandbox. Et godkendt design i brugerprojektet må heller ikke udskiftes uden brugerens konkrete ønske og accept. Instruktioner er vejledning, ikke teknisk håndhævelse eller garanti for en models adfærd.

## Kompatibilitet og kilde

Den nye hovedmetode bygger på Parthees leverede “Design og byg gennemarbejdede webapps og hjemmesider” den 24. oktober 2026. Den fulde tekst er bevaret uændret i [webapp-craft.md](../profiles/skills/harness-aura-design/references/webapp-craft.md).

Den tidligere gennemgåede kilde er [Aura Design 1.1](https://github.com/Parthee-Vijaya/skills_claude/tree/88ef16cf3f8916911f5f26cb5a334dbdf332d1f5/aura-design) af Parthee Vijayamohan. Den er tilpasset original AI Harness ved `dce68ea74a199ca214ab535a16ff22765d8ee8de` (`0.6.0-beta.1`).

En direkte kopi passer ikke til originalens bibliotek: det kræver navnet `harness-…`, kun frontmatterfelterne `name` og `description` samt `SKILL.md` og Markdown-referencer. Startere, brief, notice og generator er derfor tilgængelige som referencer. Originalens format- og stivalidering er uændret.

Kildens `brand_scan.py` og `qa.py` medfølger ikke: de kan henholdsvis hente vilkårlige adresser/redirects og servere hele målmapper eller hente ekstern testkode. Brug projektets allerede tilladte research- og testværktøjer. Generatorreferencen har inputvalidering og dokumenterer præcis de farvepar, den måler; den er ikke en fuld WCAG-afprøvning. En udefineret `--t-hero` i kildens valgfrie layout er erstattet af generatorens `--t-3xl`.

[Proveniensreferencen](../profiles/skills/harness-aura-design/references/provenance.md) fastholder alle 18 kildefilers SHA-256, tilpasninger og licensoplysninger. EUPL-1.2 og den medfølgende MIT-notice bevares. Organisationers logoer og fonte samt SkillsUI-materiale får ingen ny licens gennem denne skill.

## Afprøvning

Se [hovedskillens nye prøver og modelbegrænsninger](contributions/primary-build-skill.md) samt [det tidligere bidrags før/eftervisninger, prøver og begrænsninger](contributions/aura-design-pr.md). Der er ingen ny installationspakke, release eller hosted CI-kørsel i dette bidrag.
