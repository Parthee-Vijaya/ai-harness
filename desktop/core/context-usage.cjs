// Den seneste måling af ét modelkalds input, læst fra motorens egen step-finish. Konteksten regnes aldrig ud fra
// samtalens samlede forbrug: det ville tælle svar og tidligere kald med og give et tal, der ikke findes.
// En måling gælder kun netop den forbindelse, model, rute, motor og modelsession, der blev målt.
const FIELDS = ['connectionID', 'modelID', 'routeID', 'engineID', 'sessionID'];
function bindingOf(value) {
  if (!value || typeof value !== 'object' || typeof value.modelID !== 'string' || !value.modelID || typeof value.sessionID !== 'string' || !value.sessionID) return null;
  const result = {};
  for (const key of FIELDS) { const item = value[key] ?? ''; if (typeof item !== 'string' || item.length > 300 || /[\x00-\x1f\x7f]/.test(item)) return null; result[key] = item; }
  return result;
}
const same = (left, right) => Boolean(left && right && FIELDS.every(key => left[key] === right[key]));
// Kun et helt, ikke-negativt tal er en oplysning. Alt andet, fx null eller en tekst, er ukendt.
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const limitOf = value => Number.isSafeInteger(value) && value > 0 ? value : null;
class ContextUsage {
  constructor({ now = Date.now } = {}) { this.now = now; this.binding = null; this.limit = null; this.latest = null; this.reason = 'unmeasured'; }
  // Grænsen er Auras egen grænse for et kalds input, ikke nødvendigvis modellens hele kontekstvindue.
  bind(value) {
    const binding = bindingOf(value);
    if (!same(binding, this.binding)) { this.latest = null; this.reason = this.binding ? 'binding-changed' : 'unmeasured'; }
    this.binding = binding; this.limit = binding ? limitOf(value?.limit) : null;
    return this.snapshot();
  }
  observe(part) {
    if (part?.type !== 'step-finish' || !this.binding) return this.snapshot();
    const tokens = part.tokens || {}, input = count(tokens.input), cacheRead = count(tokens.cache?.read ?? tokens.cacheRead), cacheWrite = count(tokens.cache?.write ?? tokens.cacheWrite);
    // Hele kaldets input er nye tokens plus det, der blev læst fra og skrevet til cache. Mangler ét af tallene, er summen ukendt.
    const total = input !== null && cacheRead !== null && cacheWrite !== null ? input + cacheRead + cacheWrite : null;
    this.latest = { input, cacheRead, cacheWrite, totalInput: Number.isSafeInteger(total) ? total : null, at: this.now() };
    this.reason = this.latest.totalInput === null ? 'unknown-input' : this.limit === null ? 'unknown-limit' : null;
    return this.snapshot();
  }
  snapshot() {
    const inputTokens = this.latest?.totalInput ?? null, limitTokens = this.limit;
    const share = inputTokens !== null && limitTokens !== null ? inputTokens / limitTokens * 100 : null;
    return { known: inputTokens !== null, inputTokens, limitTokens, percentage: Number.isFinite(share) ? share : null, at: this.latest?.at ?? null, binding: this.binding ? { ...this.binding } : null, reason: this.reason };
  }
}
module.exports = { ContextUsage, bindingOf };
