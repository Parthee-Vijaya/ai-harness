// Det rolige statuspanel i opsætningen: ren beregning af, hvad panelet skal sige ud fra det, appen allerede ved.
// Panelet henter aldrig noget selv, og grønt bruges kun, når en kontrol faktisk er lykkedes. Efter forslag i #17.
(function (root) {
  const NOTES = Object.freeze({
    pending: 'Forbindelsen kontrolleres. Der sendes ingen projektfiler.',
    error: 'Forbindelsen svarede ikke som ventet. Dine valg er bevaret.',
    checked: 'Modelkataloget svarer. Model og kvote afprøves først ved din første besked.',
    saved: 'Forbindelsen er gemt lokalt. Adgangen er ikke kontrolleret i denne session.',
    preview: 'Du kigger kun. Intet er valgt, gemt eller sendt endnu.',
    none: 'Dit valg her forbinder ikke og sender ikke noget.'
  });
  const CONNECTION = Object.freeze({
    preview: 'Forhåndsvisning. Intet er valgt endnu.',
    checked: 'Kontrolleret i denne session.',
    saved: 'Gemt lokalt.',
    chosen: 'Valgt. Ikke gemt endnu.',
    none: 'Dit næste valg.'
  });
  /**
   * kind er den udbyder, panelet viser, name dens navn. saved er en gemt forbindelse, check dens seneste kontrol,
   * og verified at kontrollen hører til netop den forbindelse. preview er en udbyder, musen kun hviler på.
   */
  function describe({ kind = '', name = '', saved = false, preview = false, check = null, verified = false } = {}) {
    // Grønt kræver en gemt forbindelse, en kontrol, der hører til den, og et katalog med mindst én model.
    const checked = Boolean(saved && verified && check && check.status === 'ok' && check.count > 0);
    const state = check && check.status === 'checking' ? 'pending'
      : check && check.status === 'error' ? 'error'
      : checked ? 'checked' : saved ? 'saved' : preview ? 'preview' : 'none';
    return {
      state,
      provider: name || 'Ingen udbyder valgt endnu',
      connection: preview && !saved ? CONNECTION.preview : checked ? CONNECTION.checked : saved ? CONNECTION.saved : kind ? CONNECTION.chosen : CONNECTION.none,
      model: checked ? 'Vælges i projektet.' : 'Vælges, når forbindelsen svarer.',
      note: NOTES[state],
      // Din computer er altid med; forbindelsen, når en udbyder er valgt; modellen først efter en kontrol.
      active: [true, Boolean(kind), checked]
    };
  }
  const api = Object.freeze({ describe });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SetupStatus = api;
})(typeof window === 'undefined' ? globalThis : window);
