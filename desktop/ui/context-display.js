// Kontekstmålingen står i statuslinjens detaljer. Første lag viser kun en advarsel, når samtalen nærmer sig grænsen.
// Teksten siger altid, at tallet er det senest afsluttede modelkald, ikke samtalens samlede forbrug.
(root => {
  // Nær grænsen: herfra kan et kald blive afvist, og brugeren kan selv gøre samtalen kortere.
  const NEAR = 80;
  const number = value => value.toLocaleString('da-DK');
  const share = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 });
  const reasons = {
    unmeasured: 'Konteksten måles, når det første modelkald er afsluttet.',
    'binding-changed': 'Konteksten er ikke målt for den valgte AI endnu.',
    'unknown-input': 'Motoren oplyste ikke, hvor meget kontekst det seneste modelkald brugte.'
  };
  function describe(snapshot, selected) {
    // Målingen gælder kun den forbindelse, model og rute, der er valgt nu. Et skift gør den forrige måling uaktuel.
    const binding = snapshot?.binding;
    const current = Boolean(binding && selected?.modelID && ['connectionID', 'modelID', 'routeID'].every(key => binding[key] === (selected[key] || '')));
    if (!current || snapshot.known !== true) {
      // Intet er målt endnu, målingen hører til en anden AI, eller motoren oplyste ikke tallet.
      const reason = !binding ? 'unmeasured' : !current ? 'binding-changed' : snapshot.reason;
      return { detail: reasons[reason] || reasons.unmeasured, warning: '' };
    }
    const { inputTokens, limitTokens, percentage } = snapshot;
    if (limitTokens === null || percentage === null) return { detail: `Seneste modelkald brugte ${number(inputTokens)} tokens kontekst. Grænsen er ikke oplyst for denne model. Tallet er det senest afsluttede kald, ikke samtalens samlede forbrug.`, warning: '' };
    return {
      detail: `Seneste modelkald brugte ${number(inputTokens)} af ${number(limitTokens)} tokens kontekst, altså ${share(percentage)} %. Tallet er det senest afsluttede kald, ikke samtalens samlede forbrug; værktøjer og nye beskeder ændrer det.`,
      warning: percentage >= NEAR ? `Samtalen fylder ${share(percentage)} % af grænsen på ${number(limitTokens)} tokens. Gør den kortere, hvis et kald bliver afvist.` : ''
    };
  }
  const api = Object.freeze({ describe, NEAR });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ContextDisplay = api;
})(typeof window === 'undefined' ? globalThis : window);
