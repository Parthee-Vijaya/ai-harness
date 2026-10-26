// Udseende under Indstillinger: Følg systemet, Lyst eller Mørkt. Valget gælder med det samme i hele appen og huskes.
// Efter forslag i #46.
(() => {
  if (typeof window.harness?.appearanceGet !== 'function') return;
  const dialog = document.getElementById('appearance-dialog'), status = document.getElementById('appearance-status');
  const choices = [...dialog.querySelectorAll('input[name="appearance-theme"]')];
  const names = { system: 'Følg systemet', light: 'Lyst', dark: 'Mørkt' };
  // Kun svaret på det seneste valg vises, så hurtige skift ikke får markeringen til at hoppe.
  let saved = null, request = 0;
  const show = theme => { saved = theme; for (const choice of choices) choice.checked = choice.value === theme; };
  // Det gemte valg hentes, før dialogen åbnes. En fejl vises derfor i siden og ikke bag en åben dialog.
  document.getElementById('appearance-button').onclick = () => action(async () => {
    const value = await call('appearanceGet');
    ++request; show(value.theme); status.textContent = ''; dialog.showModal();
    (choices.find(choice => choice.checked) || choices[0]).focus();
  });
  for (const choice of choices) choice.addEventListener('change', async () => {
    if (!choice.checked) return;
    const mine = ++request;
    try {
      const value = await call('appearanceSave', { theme: choice.value });
      if (mine !== request) return;
      show(value.theme); status.textContent = `${names[value.theme]} er valgt.`;
    } catch (error) {
      if (mine !== request) return;
      if (saved) show(saved);
      status.textContent = `Udseendet blev ikke gemt. ${error.message}`;
    }
  });
  // Fokus tilbage til Indstillinger, når dialogen lukkes, som ved de andre punkter i menuen.
  dialog.addEventListener('close', () => {
    const active = document.activeElement;
    if (!document.querySelector('dialog[open]') && (active === document.body || !active?.checkVisibility({ checkVisibilityCSS: true }))) document.getElementById('settings-toggle').focus();
  });
})();
