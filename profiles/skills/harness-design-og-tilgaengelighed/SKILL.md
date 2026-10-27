---
name: harness-design-og-tilgaengelighed
description: Bygger brugerflader ud fra organisationens designsystem eller godkendte referencer og afprøver tilgængelighed med både værktøjer og hænder. Kontrollerer tastatur, fokus, kontrast, formularer, fejlbeskeder, overskrifter og små skærme og ser resultatet i browseren. Brug den, når en side, formular eller komponent bygges eller ændres, og før en offentlig side udgives.
---

# Design og tilgængelighed

En brugerflade er først færdig, når den kan bruges med tastatur, skærmlæser og på en lille skærm, og når det står klart, hvad der faktisk er set og kontrolleret.

## Design

1. Brug organisationens designsystem og designguide først, derefter de designvalg og referencer, brugeren har valgt, fx farve, logo og inspiration. Angiv, hvad du bygger på. Opfind ikke indhold fra sider, du ikke kunne læse. Uden en designguide er dit design et forslag og ikke organisationens identitet.
2. Skriv et kort designbrief, før du bygger en ny brugerflade eller et nyt forløb: formål og primær handling, hovedvisninger, udtryk i tre til fem ord, kilder til farver, logo og skrift, data og det, der skal afprøves. Gem det i `docs/design.md`, og brug og opdatér filen, når den findes. Ved en lille ændring bruger du det eksisterende brief. Laver du en plan, står et kort resumé i planens afsnit om udseendet.
3. Vælg én designretning ud fra opgaven. Et arbejdsredskab samler sig om handlinger og data, et website om indhold og navigation. Brug ét tydeligt visuelt greb og ikke en standardpakke med gradienter, glas, ens kort og store runde hjørner overalt.
4. Læg et lille sæt designtokens, før du bygger komponenterne: farveroller med en egen tekstfarve til hver farvet flade, en typografisk skala, en afstandsskala og, når projektet skal have det, et mørkt tema ved siden af det lyse. Brug projektets eksisterende komponenter og tokens, når de findes.
5. Byg hele det første brugerforløb, så første udkast allerede er gennemarbejdet: layout, typografi, farver, navigation og realistisk, opdigtet dansk eksempelindhold. Hver knap virker, og tomme tilstande, fejl, indlæsning og manglende adgang er med. Hold demo, lokalt gemte data og rigtig integration tydeligt adskilt.
6. Tænk mobil først, og skriv brugerfladetekster i et klart, konkret dansk. Knapper siger, hvad der sker.
7. Brug systemskrift eller skrifttyper, ikoner og billeder, der ligger i projektet. Eksterne adresser bruges kun, når projektets netliste tillader dem. Kopiér ikke logoer, billeder, skrifter eller tekster med uafklarede rettigheder, og tegn hverken logoer eller byvåben om.
8. Undgå dekorative dashboards og generiske marketingtekster, som ikke hjælper opgaven.

Spørg kun om det, der ændrer designet væsentligt, fx en designguide eller et logo, du ikke kan finde. Ellers vælger du selv og skriver antagelserne i briefet. Afklaring af målgruppe og omfang hører til `harness-ide-og-afgraensning`, hvis den er installeret.

Detaljerne står i to referencer. Læs designmetoden, når du laver en ny brugerflade eller ændrer udtrykket, og mønstrene, når du bygger formularer, lister, tilstande eller AI-funktioner:

- [Designmetoden](references/designmetode.md): designbriefet, brandkilder, designretning, tokens og tema, typografi og afstand, komposition og kvalitetstjek før aflevering.
- [Mønstre og tilstande](references/moenstre-og-tilstande.md): tilstande, formularer, søgning, tabeller, fejlbeskeder, AI-funktioner, bevægelse og offentlige løsninger.

## Tilgængelighed

Danske offentlige organers websteder og apps skal overholde standarden EN 301 549, som i praksis betyder WCAG 2.1 på niveau AA. Byg efter WCAG 2.2 AA, som den nyeste udgave af standarden bygger på. Hvert websted og hver app skal have en tilgængelighedserklæring i Digitaliseringsstyrelsens WAS-tool, og den skal opdateres ved ændringer og mindst én gang om året. Brug [tjeklisten](references/tilgaengelighed.md).

Kontrollér altid i hånden:

- Hele forløbet kan gennemføres med tastatur, og fokus er synligt og følger en logisk rækkefølge.
- Formularfelter har synlige labels, og fejlbeskeder forklarer problemet ved det rigtige felt.
- Overskrifter følger en logisk struktur, og siden har `lang="da"`.
- Tekst har tilstrækkelig kontrast i hvert tema, siden har, og information bæres ikke af farve alene.
- Siden kan forstørres til 200 procent og bruges på en smal skærm uden vandret rulning. Knapper og felter har klikflader på mindst 24 px, gerne omkring 44 px.
- Billeder har meningsfulde alternative tekster, og dekorative billeder skjules for skærmlæsere.

Kør også et automatisk værktøj som axe eller Lighthouse, hvis det er muligt. Et automatisk værktøj finder kun en del af problemerne og kan ikke alene afgøre, om en side er tilgængelig.

## Se resultatet

Se siden, som den faktisk vises, på computer- og mobilbredde, i begge temaer og ved 200 procent zoom, når dit værktøj kan åbne siden eller tage skærmbilleder. Giver dit værktøj dig log, konsolfejl eller skærmbilleder efter en opgave, så brug dem. Kan du ikke se siden, så skriv præcist, hvad der ikke er set. Sammenlign med referencerne. Påstå ikke, at brugeren har godkendt designet.

## Aflevering

Skriv, hvad der er kontrolleret automatisk, hvad der er set, hvad der er prøvet med tastatur, og hvad der er afprøvet mod en rigtig tjeneste, og hvilke kendte problemer der er tilbage. Brug trinene i `harness-afproevning-og-fejlretning`, hvis den er installeret. Kald ikke løsningen tilgængelig på baggrund af en automatisk scanning.
