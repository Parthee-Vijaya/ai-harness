# Fire lokale tools i Aura 1

Den lokale beta 0.6.0 indeholder JSON til CSV, CSV til JSON, tekstsammenligning og
IBAN-formatkontrol. Modellen kan vælge funktionerne i Samtale, Planlæg og Byg.
Kaldet vises på det eksisterende godkendelseskort, hvor du vælger Tillad én gang
eller Afvis. Der er ingen nye skærme eller globale tooltilladelser.

Funktionerne behandler deres argumenter i hukommelsen og kontakter ikke Apyhub.
Der er ingen automatisk ekstern reserve. Output og toolhistorik følger samtalens
Privacy Gate før næste modelkald. Følsomme strukturdata kan kræve en dokumenteret
lokal model, selv om selve toolkaldet allerede er godkendt.

- CSV understøtter danske tegn, citationstegn, linjeskift, komma, semikolon og tabulator.
- CSV-import bevarer celler som tekst og afviser dublerede/reserverede kolonnenavne.
- CSV-eksport beskytter som standard formellignende tekstceller og angiver ændringerne.
- Tekstdiff kan genskabe begge originaltekster; ordstatistik tæller også mellemrum og tegn.
- IBAN-kontrollen undersøger format og kontrolcifre, ikke kontoens eksistens eller ejer.

Der er højst 256 KiB input, 10.000 rækker og 200 kolonner; diffberegningen er
begrænset til 250 ms. Toolene kan ikke selv åbne filer, URL'er eller nøgler.

Se [integrationskontrakten](../tools/aura-tool-lab/desktop-integration.md) og
[toolpakken](../tools/aura-tool-lab/README.md) for kilde, bygning og afprøvning.

## Lokal pakkekvalifikation, 29. oktober 2026

Den byggede Apple Silicon-pakke `0.6.0-beta.1` består native appprøven med den
medfølgende runtime, uden udvikler-PATH eller reserve til kildeappen. Prøven
brugte 10 konkrete toolgodkendelser, tre delingsgennemgange og en kontrolleret
loopback-model. UI-filerne matcher versionen før integrationen byte for byte.

DMG-kontrolsum og appens signaturkontrol består. Pakken er lokalt adhoc-signeret,
ikke notariseret og ikke offentliggjort som en GitHub-release. Den eksisterende
brugerinstallation er ikke overskrevet. Se
[testbeviset](evidence/local-tools-2026-10-28/package-native-2026-10-29.json).
