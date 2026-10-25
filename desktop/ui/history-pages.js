// Gemte beskeder vises i sider. Kun visning: ingen kald til AI'en eller hovedprocessen. Efter forslag i #34.
(function (root) {
  const PAGE_SIZE = 20, PAGE_CHARACTERS = 60000;
  // De nyeste gemte beskeder op til 20 stk. eller cirka 60.000 tegn. Mindst én, så også en meget lang besked kan vises.
  function takePrevious(remaining) {
    if (!Array.isArray(remaining)) throw new TypeError('Forventede gemte beskeder');
    let index = remaining.length, characters = 0, count = 0;
    while (index > 0 && count < PAGE_SIZE) {
      const length = String(remaining[index - 1]?.text || '').length;
      if (count && characters + length > PAGE_CHARACTERS) break;
      characters += length; count++; index--;
    }
    return { older: remaining.slice(0, index), recent: remaining.slice(index) };
  }
  // En visning, som en hændelse har oprettet, før samtalen blev åbnet, er tom og har endnu ikke hentet beskeder og plan.
  const needsRestore = (fresh, view) => Boolean(fresh) || (!view.historyLoaded && !view.log.children.length);
  const api = Object.freeze({ takePrevious, needsRestore, PAGE_SIZE, PAGE_CHARACTERS });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HistoryPages = api;
})(typeof window === 'undefined' ? globalThis : window);
