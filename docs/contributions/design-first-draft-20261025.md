Tilføjer `harness-aura-design` som fælles hovedmetode til at omsætte en kort bestilling til et gennemarbejdet produkt. Skillen dækker brugerforløb, designretning, brandkilder, typografi, farver, responsivt layout, tilgængelighed og afprøvning. Den fulde byggevejledning og 43 designretninger følger med som passive referencer.

Det første udkast skal allerede have et begrundet visuelt udtryk. Typografi, farver, afstande og ikoner udskydes ikke til en senere omgang. En enkelt sætning er nok til et forslag, men giver ikke tilladelse til at ændre et eksisterende godkendt UI eller springe planer og godkendelser over.

## Før / efter: konkret skillindhold i Aura

| Før denne opdatering | Efter: kvalitet fra første udkast |
|---|---|
| ![Tidligere designvejledning](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/harness-aura-design/docs/images/design-first-draft/before/first-draft.png) | ![Udtrykkeligt krav til første udkast](https://raw.githubusercontent.com/Parthee-Vijaya/ai-harness/feat/harness-aura-design/docs/images/design-first-draft/after/first-draft.png) |

Billederne er fra den eksisterende instruktionsdialog i rigtig Electron med separate syntetiske profiler. Tekstfeltet er rullet til samme afsnit. Ingen HTML/CSS er ændret, og billederne er ikke eksempler på en ekstern models genererede produkt.

## Omfang og integration

- Biblioteksindhold, referencer, licens/proveniens, katalog og **23 genbyggede eksportpakker**.
- Metoden gælder brugerens projekt; den må ikke ændre værtsappen Aura, onboarding, navigation eller godkendelsesforløb.
- Eksisterende godkendt design og funktioner bevares. Skillen giver ingen værktøjs-, fil-, netværks- eller datatilladelser.
- EUPL-1.2 og den tilpassede kildes MIT-notice/proveniens bevares. Ingen netværksscanner eller filserver medfølger.
- Denne PR leverer indholdet. **#43** håndterer indlæsning før første modelkald og den altid aktive grundpakke. Integrér indholdet her først; denne gren ændrer ikke aktiverings- eller tilladelseslogikken.
- Designmetoden kan bruges med Mistral, Corti og andre modeller. Instruktioner er ikke en garanti for ens visuel kvalitet eller en teknisk sandbox.

## Verifikation — 25. oktober 2026

- **7/7 designbiblioteksprøver består**, herunder katalog, referencer, materialisering, eksport/installation og bevarede tilladelsesgrænser.
- **23 eksportpakker genbygget** med opdateret indhold og katalog.
- Native før/efter: hovedskillen åbnes i den rigtige instruktionsdialog; ingen rendererfejl.
- Fuld desktop-suite: **521/523 består**. De samme to fejl i `approvals.test.cjs` findes på uændret original main `dce68ea` (514/516 på baseline). Ingen nye fejl; hele suiten kaldes ikke grøn.
- macOS Apple Silicon, Node 22.23.3 og låste Electron-afhængigheder. Prøverne bruger syntetiske data og er ikke hosted CI eller en ekstern modelkvalitetsprøve.

Genkør: `node --test desktop/tests/aura-design.test.cjs`, `node scripts/build-packages.cjs` og `node desktop/scripts/verify-contribution-update.cjs skill after`.

[Fokuseret log](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/harness-aura-design/docs/contributions/design-first-draft-tests.tap) · [Fuld log](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/harness-aura-design/docs/contributions/design-first-draft-full.tap) · [Vejledning og afgrænsning](https://github.com/Parthee-Vijaya/ai-harness/blob/feat/harness-aura-design/docs/aura-design-skill.md)
