// Nøglevinduets side. Nøglen sendes kun til hovedprocessen og vises aldrig igen. Ved en fejl bliver den stående
// maskeret, så den kan prøves igen; den ryddes, når den er gemt, eller vinduet lukkes.
(() => {
  const api = window.keyWindow, $ = id => document.getElementById(id);
  if (!api) return;
  let busy = false, checking = 'Kontrollerer nøglen …';
  // Vinduet følger indholdet. documentElement fylder altid vinduet, så højden måles på indholdet selv.
  const fit = () => requestAnimationFrame(() => {
    const main = document.querySelector('main'), body = getComputedStyle(document.body);
    api.resize(Math.ceil(main.getBoundingClientRect().height + parseFloat(body.paddingTop) + parseFloat(body.paddingBottom)));
  });
  function lock(value) { busy = value; for (const id of ['key-value', 'key-submit', 'key-save-anyway']) $(id).disabled = value; }
  function show(result) {
    $('key-error').hidden = false; $('key-error-text').textContent = result.error || 'Nøglen kunne ikke kontrolleres. Prøv igen.';
    $('key-details').hidden = !result.details; $('key-details-text').textContent = result.details || ''; $('key-details').open = false;
    $('key-save-anyway').hidden = !result.offerSave;
    $('key-status').textContent = ''; $('key-value').focus(); $('key-value').select();
  }
  async function run(work) {
    if (busy) return; lock(true);
    $('key-error').hidden = true; $('key-status').textContent = checking;
    try { const result = await work(); if (result?.done) { $('key-value').value = ''; $('key-status').textContent = 'Nøglen er gemt.'; return; } show(result || {}); }
    catch { show({}); }
    finally { lock(false); fit(); }
  }
  api.context().then(context => {
    $('key-heading').textContent = context.heading; document.title = context.heading;
    $('key-label').textContent = context.label; $('key-recipient').textContent = context.recipient;
    $('key-warning').textContent = context.warning; $('key-warning').hidden = !context.warning;
    $('key-submit').textContent = context.action; $('key-help').hidden = !context.help; checking = context.checking || checking;
    if (context.logo) { $('key-logo').src = context.logo; $('key-logo').hidden = false; }
    $('key-value').focus(); fit();
  });
  $('key-form').addEventListener('submit', event => { event.preventDefault(); run(() => api.submit($('key-value').value)); });
  $('key-save-anyway').onclick = () => run(() => api.saveAnyway());
  $('key-cancel').onclick = () => { $('key-value').value = ''; api.cancel(); };
  $('key-help').onclick = () => api.help();
  $('key-details').addEventListener('toggle', fit);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('key-value').value = ''; api.cancel(); } });
})();
