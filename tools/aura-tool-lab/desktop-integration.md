# Kontrakt for integration i Aura Harness

## Leveret grænseflade

`manifest.json` beskriver fire lokale, versionsmærkede tools med stabile navne,
input/output-schemaer, inputgrænser og deklaration af ingen datadeling eller
filadgang. `invokeLocal(name, input)` er det direkte bibliotekskald. `server.mjs`
leverer samme funktioner gennem MCP over stdio. Apyhub-klient og credentials
indlæses kun af laboratoriets CLI, aldrig af den lokale MCP-server.

## Knyt til hovedprocessen

En senere appændring bør indlæse det betroede manifest fra den pakkede app og
registrere præcis disse fire tools. Appen vælger toolversion og executable;
projektfiler og modeloutput må ikke tilføje MCP-servere eller ændre stien.

Brug enten bibliotekskald i en afgrænset worker eller en stdio-proces startet af
hovedprocessen med den medfølgende runtime. Send kun de konkrete, validerede
argumenter. Processen behøver hverken credentials, projektmapper eller netværk.
Anvend appens tekniske isolation; metadata som `dataEgress: none` er ikke i sig
selv en OS-beskyttelse. Afprøvningen på macOS har verificeret, at funktionerne og
MCP-processen virker, når netværk og filskrivning afvises.

## Godkendelser og datagrænser

Appens nuværende `ApprovalsPolicy` har ingen generel MCP-tilladelse, og motoren
har bevidst tomt `mcp.servers`. Bevar den afvisende standard. En appintegration
skal oversætte et konkret lokalt toolkald til appens eksisterende kontrolforløb:

1. Bind kaldet til aktuel samtale, projekt, plan og toolversion.
2. Valider input før godkendelse. Vis funktion, dataomfang og lokal udførelse på
   det eksisterende godkendelseskort; lav ikke en skjult global tilladelse.
3. Bind godkendelsen til en hash af de præcise argumenter, og genkontrollér den
   ved udførelse. Et senere ændret input kræver en ny vurdering.
4. Respektér Stop, annullering, tilbagetrukne tilladelser og aktive dataregler.
5. Valider output og registrer toolnavn, version, udfald og varighed. Gem ikke
   rå IBAN, tekstindhold, nøgler eller andet følsomt input i aktivitetsloggen.

Filer skal læses gennem Auras eksisterende filadgang og Privacy Gate før deres
indhold gives til et tool. Pakken har ingen alternativ filindgang. Lokalt
output kan stadig være følsomt, når det returneres til en ekstern model;
appens regler for modeldeling gælder derfor også efter et lokalt toolkald.

Hvis Apyhub senere skal kunne kaldes fra selve Aura, er det en separat ekstern
udførelsesvej. Den skal være eksplicit valgt og have godkendt destination,
leverandør, argumenter og forbrug. Brug Auras credentialmekanisme i hovedprocessen.
Indlæs ikke laboratoriets private credentialfiler i modellen eller agentprocessen.
Skift aldrig automatisk fra lokal udførelse til en ekstern leverandør.

## Accept før aktivering i installeret Aura

- Registrering og toolkald verificeret mod den faktisk anvendte OpenCode-version.
- Plan-, godkendelses- og Privacy Gate-tests for de nye toolkald.
- Afvisning af ukendte tools, ændrede argumenter, tilbagekaldt tilladelse og kald
  fra en afsluttet eller forkert samtale.
- Native kontrol gennem en rigtig modelsamtale i en separat Aura-testprofil.
- Verificeret pakning af runtime, toolmanifest, biblioteker og licenser.

Disse app-specifikke trin er ikke udført i denne første katalog- og toolafprøvning.
