// Søgning i gemte samtaler på denne computer. Et træf åbner beskeden og sendes aldrig til AI'en. Efter forslag i #28.
(() => {
  if (typeof window.harness?.historySearch !== 'function') return;
  const make = (tag, text, className) => { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element; };
  const dialog = make('dialog', null, 'history-search-dialog'); dialog.id = 'history-search-dialog'; dialog.setAttribute('aria-labelledby', 'history-search-title');
  const header = make('div', null, 'dialog-heading'), title = make('h2', 'Søg i samtaler'); title.id = 'history-search-title';
  const close = make('button', 'Luk'); close.type = 'button'; close.id = 'history-search-close'; header.append(title, close);
  const note = make('p', 'Søgningen sker på din computer. AI’en ser ikke, hvad du søger efter.', 'hint');
  const form = make('form', null, 'history-search-form'), queryLabel = make('label', 'Ord eller sætning'), query = make('input');
  query.type = 'search'; query.maxLength = 200; query.required = true; query.id = 'history-search-query'; queryLabel.htmlFor = query.id;
  const scopeLabel = make('label', 'Søg i'), scope = make('select'); scope.id = 'history-search-scope'; scopeLabel.htmlFor = scope.id;
  const search = make('button', 'Søg', 'primary'); search.type = 'submit'; search.id = 'history-search-submit';
  form.append(queryLabel, query, scopeLabel, scope, search);
  const status = make('p', null, 'hint'); status.id = 'history-search-status'; status.setAttribute('role', 'status');
  const list = make('ol', null, 'history-search-results'); list.id = 'history-search-results';
  const more = make('button', 'Vis flere træf', 'text-button'); more.type = 'button'; more.id = 'history-search-more'; more.hidden = true;
  dialog.append(header, note, form, status, list, more); document.body.append(dialog);
  let generation = 0, activeSearch = null, nextOffset = null, opener = null, busy = false, rows = [], currentScope = null, summary = '';
  const selection = () => ({ project: window.chats?.projects().find(project => project.root === current?.root)?.id, chat: view?.id });
  const roles = { user: 'Dig', assistant: 'AI', system: 'Aura' };
  // Samtalens seneste ændring i lokal tid. Beskeder har ikke deres eget tidspunkt.
  const changed = at => { const date = new Date(at); return Number.isNaN(date.getTime()) ? '' : `Samtalen ændret ${date.toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`; };
  function scopes() {
    const chosen = scope.value || 'project'; scope.replaceChildren();
    for (const [value, label] of [['project', 'Dette projekt'], ['chat', 'Denne samtale'], ['all', 'Alle projekter']]) {
      const option = make('option', label); option.value = value;
      option.disabled = value !== 'all' && !currentScope?.project || value === 'chat' && !currentScope?.chat; scope.append(option);
    }
    scope.value = currentScope?.project ? chosen : 'all';
  }
  function highlight(target, text, needle) {
    const at = text.toLocaleLowerCase('da').indexOf(needle.toLocaleLowerCase('da'));
    if (at < 0) { target.textContent = text; return; }
    target.append(document.createTextNode(text.slice(0, at)), make('mark', text.slice(at, at + needle.length)), document.createTextNode(text.slice(at + needle.length)));
  }
  function render() {
    list.replaceChildren();
    for (const result of rows) {
      const item = make('li'), button = make('button', null, 'history-search-result'); button.type = 'button';
      button.append(make('strong', `${result.projectName} · ${result.chatTitle || 'Ny samtale'}`));
      const excerpt = make('span'); highlight(excerpt, result.excerpt, activeSearch?.query || '');
      button.append(excerpt, make('small', [roles[result.role] || result.role, changed(result.updatedAt)].filter(Boolean).join(' · ')));
      button.onclick = async () => {
        const ticket = generation; button.disabled = true;
        try { const target = await window.openStoredMessage(result); if (ticket === generation) { dialog.close(); target?.focus?.({ preventScroll: true }); } }
        catch (error) { if (ticket === generation) { status.textContent = error.message; button.disabled = false; } }
      };
      item.append(button); list.append(item);
    }
    more.hidden = nextOffset == null; search.disabled = busy;
  }
  async function run(offset = 0) {
    const text = query.value.trim(); if (!text || text.length > 200) return;
    const ticket = ++generation, basis = { query: text, limit: 20 };
    if (scope.value !== 'all' && currentScope?.project) basis.project = currentScope.project;
    if (scope.value === 'chat' && currentScope?.chat) basis.chat = currentScope.chat;
    // "Vis flere træf" bliver stående under hentningen, så fokus ikke forsvinder fra knappen.
    const first = offset ? rows.length : 0;
    activeSearch = basis; if (!offset) { rows = []; nextOffset = null; } busy = true; render(); more.setAttribute('aria-disabled', 'true');
    status.textContent = 'Søger …';
    try {
      const result = await call('historySearch', { ...basis, offset });
      if (ticket !== generation || !dialog.open) return;
      if (result?.localOnly !== true || !Array.isArray(result.results)) throw new Error('Søgningen kunne ikke gennemføres. Prøv igen.');
      // En anden samtale kan arbejde imens og skifte plads i rækkefølgen, så samme træf vises kun én gang.
      const seen = new Set(rows.map(row => `${row.chat}/${row.message}`));
      rows.push(...result.results.filter(row => !seen.has(`${row.chat}/${row.message}`))); nextOffset = result.nextOffset;
      summary = [
        rows.length ? `Viser ${rows.length} træf.${nextOffset != null ? ' Der er flere.' : ''}` : 'Ingen træf.',
        result.truncated ? `Ikke alle samtaler blev gennemsøgt.${scope.value === 'all' && currentScope?.project ? ' Vælg Dette projekt for at søge grundigere.' : ''}` : '',
        result.skipped ? `${result.skipped} ${result.skipped === 1 ? 'samtale kunne' : 'samtaler kunne'} ikke læses og blev sprunget over.` : '',
        result.unopened ? `Samtaler i ${result.unopened} ${result.unopened === 1 ? 'projekt' : 'projekter'} kan først søges, når projektet er åbnet.` : ''
      ].filter(Boolean).join(' ');
      status.textContent = summary;
    } catch (error) { if (ticket === generation) status.textContent = error.message; }
    finally {
      if (ticket === generation) {
        busy = false; render(); more.removeAttribute('aria-disabled');
        // Efter "Vis flere træf" får det første nye træf fokus.
        if (offset && rows.length > first) list.children[first]?.querySelector('button')?.focus();
      }
    }
  }
  form.onsubmit = event => { event.preventDefault(); void run(); };
  more.onclick = () => { if (nextOffset != null && !busy) void run(nextOffset); };
  const invalidate = () => { generation++; busy = false; rows = []; nextOffset = null; activeSearch = null; status.textContent = ''; render(); };
  query.addEventListener('input', invalidate); scope.addEventListener('change', invalidate);
  close.onclick = () => dialog.close();
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); } });
  dialog.addEventListener('close', () => { generation++; busy = false; if (opener?.isConnected && document.activeElement === document.body) opener.focus(); });
  window.localHistorySearch = { open() { opener = document.activeElement; currentScope = selection(); scopes(); invalidate(); if (!dialog.open) dialog.showModal(); query.focus(); } };
  document.getElementById('history-search-open').onclick = () => window.localHistorySearch.open();
})();
