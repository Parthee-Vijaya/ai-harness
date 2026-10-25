// AI'ens svar er markdown og behandles som data. Vi bygger kun elementer med textContent, så modellens tekst aldrig
// bliver til HTML. Tabeller, kopiknapper og links, der viser deres værtsnavn. Efter forslag i #27.
(function (root) {
  // Kun almindelige http- og https-adresser uden loginoplysninger eller kontroltegn. Hovedprocessen kontrollerer igen.
  function linkURL(value) {
    if (typeof value !== 'string' || value.length > 4096 || /[\u0000- \u007f]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || /[\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) return null;
      return url.href;
    } catch { return null; }
  }
  // Celler i en tabelrække. \| og | inde i `kode` deler ikke cellen.
  function cells(line) {
    const source = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
    const result = []; let cell = '', code = 0;
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\\' && source[i + 1] === '|') { cell += '|'; i++; continue; }
      if (source[i] === '`') { let n = 1; while (source[i + n] === '`') n++; if (!code) code = n; else if (code === n) code = 0; cell += '`'.repeat(n); i += n - 1; continue; }
      if (source[i] === '|' && !code) { result.push(cell.trim()); cell = ''; } else cell += source[i];
    }
    result.push(cell.trim()); return result;
  }
  // options: visible(tekst), copy(tekst, knap), openLink(adresse), decorate(element) og complete (svaret er færdigt).
  function render(element, text, options = {}) {
    const node = (tag, value, cls) => { const el = element.ownerDocument.createElement(tag); if (value != null) el.textContent = value; if (cls) el.className = cls; return el; };
    // Kopiknapper vises først, når teksten er færdig, så de ikke bygges om under streaming.
    const copying = Boolean(options.copy) && options.complete !== false;
    const copy = (value, label, cls) => { const button = node('button', label, cls); button.type = 'button'; button.onclick = () => options.copy(value(), button); return button; };
    function link(target, rawLabel, address) {
      // Usynlige formattegn, fx retningstegn, fjernes, så teksten ikke kan vende eller skjule det viste værtsnavn.
      const label = String(rawLabel).replace(/\p{Cf}/gu, '').trim() || address, url = linkURL(address);
      if (!url || !options.openLink) { target.append(`${label} (${address})`); return; }
      const button = node('button', null, 'markdown-link'); button.type = 'button'; button.title = url; button.onclick = () => options.openLink(url);
      if (label === address || label === url) button.append(node('span', url, 'markdown-link-host'));
      else {
        // Værtsnavnet står i sit eget, isolerede element, så brugeren kan se, hvor et klik fører hen, også uden mus.
        const text = node('bdi', label), host = node('span', `(${new URL(url).host})`, 'markdown-link-host'); host.dir = 'ltr';
        button.append(text, ' ', host);
      }
      target.append(button);
    }
    // En løs adresse slutter ikke med tegnsætning eller en uparret slutparentes.
    function bare(target, value) {
      let address = value, rest = '';
      while (/[.,;:!?'"]$/.test(address) || (address.endsWith(')') && (address.match(/\(/g) || []).length < (address.match(/\)/g) || []).length)) { rest = address.slice(-1) + rest; address = address.slice(0, -1); }
      link(target, address, address); if (rest) target.append(rest);
    }
    function inline(target, value) {
      // Link-målet må indeholde balancerede parenteser, fx Wikipedia-sider som Kalundborg_(by).
      const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|<(https?:\/\/[^\s<>]+)>|(https?:\/\/[^\s<>\]]+))/g; let last = 0, match;
      while ((match = pattern.exec(value))) {
        if (match.index > last) target.append(value.slice(last, match.index));
        if (match[2] !== undefined) target.append(node('strong', match[2]));
        else if (match[3] !== undefined) target.append(node('code', match[3]));
        else if (match[4] !== undefined) target.append(node('em', match[4]));
        else if (match[5] !== undefined) link(target, match[5], match[6]);
        else if (match[7] !== undefined) link(target, match[7], match[7]);
        else bare(target, match[8]);
        last = pattern.lastIndex;
      }
      if (last < value.length) target.append(value.slice(last));
    }
    const visible = options.visible ? options.visible(text) : String(text), lines = visible.replace(/\r\n/g, '\n').split('\n'), blocks = [];
    const codeSources = new Map();
    let paragraph = null, list = null, code = null, codeLines = 0;
    const close = () => { paragraph = null; list = null; };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (code) { if (/^\s*```/.test(line)) code = null; else { const value = codeSources.get(code) + (codeLines++ ? '\n' : '') + line; codeSources.set(code, value); code.textContent = value; } continue; }
      if (/^\s*```/.test(line)) {
        close(); const box = node('div', null, 'markdown-code'), pre = node('pre'); code = node('code'); codeLines = 0;
        const block = code; codeSources.set(block, '');
        if (copying) box.append(copy(() => codeSources.get(block), 'Kopiér kode', 'text-button markdown-copy-code'));
        box.append(pre); pre.append(code); blocks.push(box); continue;
      }
      if (!line.trim()) { close(); continue; }
      const header = cells(line), separator = i + 1 < lines.length ? cells(lines[i + 1]) : [];
      if (line.includes('|') && header.length >= 2 && header.length === separator.length && separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
        close(); const wrap = node('div', null, 'markdown-table'), table = node('table'), head = node('thead'), body = node('tbody');
        wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Tabel i AI-svar');
        const row = (values, tag) => { const tr = node('tr'); header.forEach((_, n) => { const cell = node(tag); if (tag === 'th') cell.scope = 'col'; inline(cell, values[n] || ''); tr.append(cell); }); return tr; };
        head.append(row(header, 'th')); i++;
        while (i + 1 < lines.length && lines[i + 1].trim() && lines[i + 1].includes('|') && !/^\s*```/.test(lines[i + 1])) body.append(row(cells(lines[++i]), 'td'));
        table.append(head, body); wrap.append(table); blocks.push(wrap); continue;
      }
      const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
      if (heading) { close(); const h = node('h4'); inline(h, heading[1].replace(/\s+#+\s*$/, '')); blocks.push(h); continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { close(); blocks.push(node('hr')); continue; }
      const item = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
      if (item) {
        const tag = item[1] ? 'ol' : 'ul';
        if (!list || list.tagName.toLowerCase() !== tag) { paragraph = null; list = node(tag); blocks.push(list); }
        const li = node('li'); inline(li, item[2]); list.append(li); continue;
      }
      list = null; if (!paragraph) { paragraph = node('p'); blocks.push(paragraph); } else paragraph.append(node('br'));
      inline(paragraph, line);
    }
    // Korte svar på én linje kan markeres direkte; kun længere eller sammensatte svar får en kopiknap.
    if (visible.trim() && copying && (visible.trim().length >= 200 || blocks.length > 1)) blocks.push(copy(() => visible, 'Kopiér tekst', 'text-button markdown-copy-answer'));
    element.classList.add('markdown'); element.replaceChildren(...blocks); options.decorate?.(element);
  }
  const api = { render, cells, linkURL };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MarkdownView = api;
})(typeof window === 'object' ? window : globalThis);
