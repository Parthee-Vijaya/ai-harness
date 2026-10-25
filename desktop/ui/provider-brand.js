// Udbyderens logo ved den valgte model. Kun appens egne logoer (provider-*.svg med licensfil), aldrig adresser fra
// et katalog, og altid forbindelsens logo, også ved OpenRouter. Alle udbydere vises ens. Efter forslag i #22.
(function (root) {
  const ASSETS = Object.freeze({
    alexandra: 'provider-alexandra.svg', anthropic: 'provider-anthropic.svg', azure: 'provider-azure.svg',
    compatible: 'provider-compatible.svg', corti: 'provider-corti.svg', mistral: 'provider-mistral.svg',
    ollama: 'provider-ollama.svg', openai: 'provider-openai.svg', openrouter: 'provider-openrouter.svg', zen: 'provider-zen.svg'
  });
  const asset = kind => typeof kind === 'string' && Object.hasOwn(ASSETS, kind) ? ASSETS[kind] : null;
  function icon(kind, ownerDocument) {
    const src = asset(kind);
    if (!src || !ownerDocument?.createElement) return null;
    const image = ownerDocument.createElement('img');
    image.className = 'provider-brand-icon'; image.src = src; image.alt = '';
    image.width = 18; image.height = 18; image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    return image;
  }
  // Knappens tekst bevares som tekst. Logoet vises først, når en model er valgt.
  function decorate(button, { kind, modelID, label } = {}) {
    if (!button?.replaceChildren || !button.ownerDocument?.createElement) return;
    const text = button.ownerDocument.createElement('span'); text.className = 'provider-brand-label';
    text.textContent = label == null ? button.textContent : String(label);
    const image = modelID ? icon(kind, button.ownerDocument) : null;
    button.replaceChildren(...(image ? [image, text] : [text]));
  }
  const api = Object.freeze({ asset, icon, decorate });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProviderBrand = api;
})(typeof window === 'undefined' ? globalThis : window);
