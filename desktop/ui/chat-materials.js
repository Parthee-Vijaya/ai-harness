// Vedhæftninger til én besked. Brugerfladen kender aldrig en filsti: den sender kun de id'er, hovedprocessen har
// givet den, og viser det indhold, hovedprocessen har læst. Valget hører til netop den åbne samtale; skifter
// samtalen, kasseres både valget og en igangværende gennemgang.
(() => {
  // app.js' egen $ tager en selector; her slås der op på id.
  const byId = id => document.getElementById(id);
  const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
  // Tilstanden læses fra den åbne samtale i app.js. Modulet kender hverken filstier eller forbindelser.
  const read = () => ({ root: current?.root, chat: view?.id, running });
  const dialog = byId('chat-materials-dialog'), status = byId('chat-materials-status'), chips = byId('chat-materials-chips');
  const plus = byId('chat-materials-plus'), menu = byId('chat-materials-menu');
  // epoch tælles op ved hvert skift, så et svar fra et gammelt kald ikke kan skrive i den nye tilstand.
  let owner = null, state = null, epoch = 0, busy = false, review = null;
  const key = value => JSON.stringify([value?.root, value?.chat]);
  const same = value => owner === value && key(read()) === value.key;
  const handle = () => state && { scope: state.scope, revision: state.revision };
  // Et billede vises, som det sendes: omskrevet til PNG uden EXIF. Teksten vises ordret.
  function content(file) {
    if (file.kind === 'pdf') {
      const block = el('div'), text = el('pre');
      text.tabIndex = 0;
      block.append(el('p', 'Udtrukket tekst med sidetal. Der er ikke udført OCR eller billedanalyse.', 'hint'));
      const pages = file.pages || [];
      // Én side vises bare. Flere sider får ét valg, så gennemgangen ikke bliver en mur af tekst.
      if (pages.length > 1) {
        const select = el('select');
        select.setAttribute('aria-label', 'Vælg side i PDF’en');
        for (const page of pages) { const choice = el('option', `Side ${page.page} af ${pages.length}`); choice.value = String(page.page); select.append(choice); }
        select.onchange = () => { text.textContent = pages.find(page => String(page.page) === select.value)?.text || ''; };
        select.onchange();
        block.append(select);
      } else text.textContent = pages[0]?.text || file.text;
      block.append(text);
      return block;
    }
    if (file.kind !== 'image') return el('pre', file.text);
    const block = el('div');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(file.dataURL || '')) { block.textContent = 'Billedet kunne ikke vises. Gennemgå filvalget igen.'; return block; }
    const image = el('img'); image.src = file.dataURL; image.alt = file.name; image.className = 'material-image';
    block.append(image, el('p', `Sendes som PNG uden EXIF · ${file.width} × ${file.height} pixels`));
    return block;
  }
  function button(text, onClick, primary = false) { const n = el('button', text); n.type = 'button'; if (primary) n.className = 'primary'; n.onclick = onClick; return n; }
  function controls() {
    const running = read().running, disabled = !owner || !state || busy || running;
    for (const n of document.querySelectorAll('#chat-materials-plus,[data-material-picker],#chat-materials-chips button')) n.disabled = disabled;
    for (const n of dialog.querySelectorAll('button,input')) n.disabled = busy || running;
    const attach = byId('materials-attach'); if (attach) attach.disabled = busy || running || !review;
    const next = byId('materials-next');
    if (next) { const count = dialog.querySelectorAll('input:checked').length; next.disabled = busy || running || count < 1 || count > 8; }
  }
  function apply(next) {
    if (next?.chat !== owner?.chat || !Array.isArray(next.selected) || !Array.isArray(next.candidates)) throw Error('Filvalget tilhører ikke den aktuelle samtale.');
    if (state?.scope === next.scope && next.revision < state.revision) return;
    state = next;
    chips.replaceChildren();
    chips.hidden = !state.selected.length;
    for (const file of state.selected) {
      const item = el('span'); item.className = 'material-chip';
      const remove = button('×', () => perform('chatMaterialsRemove', { ...handle(), id: file.id }, apply));
      remove.setAttribute('aria-label', 'Fjern vedhæftning ' + file.name);
      item.append(el('span', (file.changed ? 'Ændret: ' : '') + [file.folder, file.name].filter(Boolean).join('/')), remove);
      chips.append(item);
    }
    controls();
  }
  async function refresh() {
    const mine = owner, ticket = epoch;
    if (!mine) return;
    try { const next = await call('chatMaterialsState', { chat: mine.chat }, selectedOwner()); if (same(mine) && ticket === epoch) apply(next); }
    catch (error) { if (same(mine)) { status.textContent = error.message; status.hidden = false; } }
  }
  async function perform(method, input, after) {
    if (busy || !owner || read().running) return;
    const mine = owner, ticket = epoch;
    busy = true; controls();
    status.textContent = 'Kontrollerer filvalget på denne computer …'; status.hidden = false;
    try {
      const next = await call(method, { chat: mine.chat, ...input }, selectedOwner());
      if (!same(mine) || ticket !== epoch) return;
      if (next.cancelled) apply(next); else await after(next);
      status.hidden = true;
    }
    catch (error) {
      if (same(mine) && ticket === epoch) { review = null; status.textContent = error.message; status.hidden = false; const feedback = byId('materials-feedback'); if (feedback) feedback.textContent = error.message; }
    }
    finally { if (same(mine) && ticket === epoch) { busy = false; controls(); } }
  }
  // En afbrudt gennemgang efterlader ikke en kvittering, der kunne bruges senere.
  function close() {
    epoch++; busy = false; status.hidden = true;
    const pending = review; review = null;
    if (dialog.open) dialog.close();
    if (pending && owner) void call('chatMaterialsRemove', { chat: owner.chat, scope: pending.scope, revision: pending.revision, id: pending.token }, selectedOwner()).catch(() => {});
    controls(); plus.focus();
  }
  function base(title, note) {
    dialog.replaceChildren();
    const heading = el('h2', title); heading.id = 'materials-title';
    const feedback = el('p'); feedback.id = 'materials-feedback'; feedback.setAttribute('role', 'status');
    dialog.append(heading, el('p', note), feedback);
  }
  function candidates(next) {
    apply(next); review = null;
    base(next.folder ? 'Vælg filer fra referencemappen' : 'Gennemgå de valgte filer', 'Vælg præcis de filer, du vil gennemgå. Indtil nu er kun navne og størrelser hentet. Ingen hel mappe medsendes.');
    if (next.truncated) dialog.append(el('p', 'Listen er afgrænset til 100 filer, 250 mappeposter og tre undermappeniveauer. Vælg en mindre mappe for at se mere.'));
    const list = el('div'); list.className = 'material-candidates';
    for (const file of next.candidates) {
      const row = el('label'), check = el('input');
      check.type = 'checkbox'; check.value = file.id; check.checked = !next.folder; check.onchange = controls;
      row.className = 'check-label';
      row.append(check, el('span', `${file.name} · ${file.bytes.toLocaleString('da-DK')} bytes`));
      list.append(row);
    }
    dialog.append(list);
    const onward = button('Gennemgå indhold', () => perform('chatMaterialsPreview', { ...handle(), ids: [...list.querySelectorAll('input:checked')].map(n => n.value) }, preview), true);
    onward.id = 'materials-next';
    const actions = el('div'); actions.className = 'dialog-actions';
    actions.append(button('Annuller', close), onward);
    dialog.append(actions);
    if (!dialog.open) dialog.showModal();
    controls();
  }
  function preview(next) {
    review = next;
    base('Dette indhold kan medsendes', 'Indholdet medsendes først efter den almindelige gennemgang af modtager og data. Kildemappen bliver ikke et arbejdsområde for AI’en.');
    for (const file of next.files) {
      const section = el('section');
      section.append(el('h3', [file.folder, file.name].filter(Boolean).join('/')), el('small', `${file.bytes.toLocaleString('da-DK')} bytes · SHA-256 ${file.sha256}`), content(file));
      dialog.append(section);
    }
    const add = button('Tilføj de gennemgåede filer', () => {
      const pending = review;
      if (pending) void perform('chatMaterialsAttach', { scope: pending.scope, revision: pending.revision, token: pending.token }, value => { review = null; apply(value); dialog.close(); });
    }, true);
    add.id = 'materials-attach';
    const actions = el('div'); actions.className = 'dialog-actions';
    actions.append(button('Annuller', close), add);
    dialog.append(actions);
    controls();
  }
  const closeMenu = () => { menu.hidden = true; plus.setAttribute('aria-expanded', 'false'); };
  function sync() {
    if (read().running) closeMenu();
    const next = read(), id = next.root && next.chat ? key(next) : null;
    if (id !== owner?.key) {
      closeMenu(); epoch++;
      owner = id ? { ...next, key: id } : null;
      state = null; busy = false; review = null;
      chips.replaceChildren(); chips.hidden = true; status.hidden = true;
      if (dialog.open) dialog.close();
      if (owner) void refresh();
    }
    controls();
  }
  plus.onclick = () => { const open = menu.hidden; menu.hidden = !open; plus.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button')?.focus(); };
  document.addEventListener('click', event => { if (!event.target.closest('.material-menu-wrap')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); plus.focus(); event.preventDefault(); } });
  for (const n of document.querySelectorAll('[data-material-picker]')) n.onclick = () => { closeMenu(); return perform(n.dataset.materialPicker, {}, candidates); };
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) close(); });
  window.harness.onEvent(event => { if (event.type === 'chat-materials.changed' && event.chat === owner?.chat && !busy) void refresh(); });
  // Den præcise tekst i Før du sender. Det er den samme tekst, der sendes.
  const disclose = (materials, notice = '') => {
    const target = document.getElementById('data-materials');
    target.replaceChildren();
    target.hidden = !materials;
    if (!materials) return;
    const heading = document.createElement('h3');
    heading.textContent = 'Vedhæftninger · det præcise indhold';
    target.append(heading);
    for (const file of materials.files) {
      const name = document.createElement('p');
      const text = content(file);
      name.textContent = [file.folder, file.name].filter(Boolean).join('/');
      // Almindelige navne og den præcise tekst i første lag; kontrolsum, revision og bytes bag Se detaljer.
      const fold = document.createElement('details'), summary = document.createElement('summary'), facts = document.createElement('p');
      summary.textContent = 'Se detaljer';
      facts.className = 'hint';
      facts.textContent = `${file.bytes.toLocaleString('da-DK')} bytes · revision ${materials.revision} · SHA-256 ${file.sha256}` + (file.normalizedHash ? ` · sendt billede ${file.normalizedBytes.toLocaleString('da-DK')} bytes, SHA-256 ${file.normalizedHash}` : '');
      fold.append(summary, facts);
      target.append(name, text, fold);
    }
    if (notice) { const warning = document.createElement('p'); warning.className = 'materials-notice'; warning.textContent = notice; target.append(warning); }
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = materials.notice;
    target.append(note);
  };
  window.chatMaterials = { sync, disclose, selection: () => state?.selected.length ? handle() : null };
  sync();
})();
