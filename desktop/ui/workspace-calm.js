// Approved workspace presentation. This module never sends messages or grants permissions.
(() => {
  const root = document.getElementById('workspace');
  const el = id => document.getElementById(id);
  const body = document.body;
  const revealed = new WeakMap();
  const narrow = matchMedia('(max-width: 720px)');
  const overlaySidebar = matchMedia('(max-width: 900px)');
  const themeKey = 'harness-workspace-theme-v1';
  let theme = 'dark', mobileSurface = false;
  try { if (localStorage.getItem(themeKey) === 'light') theme = 'light'; } catch { /* Presentation only. */ }

  const themeButton = node('button', 'Mørk arbejdsvisning');
  themeButton.id = 'workspace-theme'; themeButton.type = 'button';
  themeButton.setAttribute('role', 'switch');
  el('project-menu').append(themeButton);
  const navigation = node('button', '☰', 'calm-navigation');
  navigation.id = 'workspace-navigation'; navigation.type = 'button';
  navigation.setAttribute('aria-label', 'Vis projekter og samtaler');
  navigation.setAttribute('aria-controls', 'sidebar'); navigation.setAttribute('aria-expanded', 'false');
  root.querySelector('.workspace-bar').prepend(navigation);

  const mobile = node('nav', undefined, 'calm-mobile-tabs');
  mobile.setAttribute('aria-label', 'Arbejdsvisning');
  const chatButton = node('button', 'Samtale'), surfaceButton = node('button', 'Arbejdsflade');
  chatButton.type = surfaceButton.type = 'button';
  chatButton.id = 'workspace-chat'; surfaceButton.id = 'workspace-surface';
  chatButton.setAttribute('aria-controls', 'chat-panel'); surfaceButton.setAttribute('aria-controls', 'work-surface');
  mobile.append(chatButton, surfaceButton); root.append(mobile);

  // Keep the existing iframe mounted, including its form and scroll state.
  const area = node('div', undefined, 'calm-preview-area');
  const surface = el('preview-surface'); surface.before(area); area.append(surface);
  const status = node('div', undefined, 'calm-preview-status'); status.hidden = true;
  const statusText = node('span'); statusText.setAttribute('role', 'status');
  const statusAction = node('button', 'Vis arbejdsstatus', 'text-button'); statusAction.type = 'button';
  statusAction.id = 'preview-work-status'; status.append(statusText, statusAction); area.before(status);
  const veil = node('div', undefined, 'calm-preview-veil'); veil.id = 'preview-work-veil'; veil.hidden = true;
  const card = node('div', undefined, 'calm-work-note');
  const orbit = node('span', undefined, 'calm-work-orbit'); orbit.setAttribute('aria-hidden', 'true');
  const logo = node('img'); logo.src = 'onboarding-aura-mark.svg'; logo.alt = ''; orbit.append(logo);
  const heading = node('h2', 'Din idé tager form'), note = node('p');
  const waitingButton = node('button', 'Se dit ventende valg'); waitingButton.type = 'button'; waitingButton.id = 'preview-work-waiting'; waitingButton.hidden = true;
  const revealButton = node('button', 'Vis forhåndsvisningen →'); revealButton.type = 'button'; revealButton.id = 'preview-work-reveal';
  card.append(orbit, heading, note, waitingButton, revealButton); veil.append(card); area.append(veil);

  function applyTheme() {
    body.dataset.workspaceTheme = theme;
    themeButton.setAttribute('aria-checked', String(theme === 'dark'));
  }
  themeButton.onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark'; applyTheme();
    try { localStorage.setItem(themeKey, theme); } catch { /* Presentation only. */ }
  };
  function closeSidebar() {
    body.classList.remove('calm-sidebar-open'); navigation.setAttribute('aria-expanded', 'false');
  }
  navigation.onclick = () => {
    if (!overlaySidebar.matches) { el('sidebar-toggle').click(); return; }
    // Preserve the user's regular sidebar preference outside this temporary drawer.
    const open = body.classList.toggle('calm-sidebar-open'); navigation.setAttribute('aria-expanded', String(open)); panes();
    if (open) el('sidebar-toggle').focus();
  };
  el('sidebar-toggle').addEventListener('click', event => {
    if (!body.classList.contains('workspace-calm') || !overlaySidebar.matches) return;
    event.stopImmediatePropagation(); closeSidebar(); navigation.focus();
  }, true);
  el('sidebar').addEventListener('click', event => {
    if (overlaySidebar.matches && event.target.closest('.chat-row, .project-name')) closeSidebar();
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#sidebar, #workspace-navigation')) closeSidebar();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && body.classList.contains('calm-sidebar-open')) { closeSidebar(); navigation.focus(); }
  });
  function panes() {
    root.classList.toggle('calm-mobile-surface', mobileSurface);
    chatButton.setAttribute('aria-pressed', String(!mobileSurface)); surfaceButton.setAttribute('aria-pressed', String(mobileSurface));
    el('chat-panel').inert = narrow.matches && mobileSurface;
    el('work-surface').inert = narrow.matches && !mobileSurface;
    // A hidden drawer must not retain keyboard focus targets.
    el('sidebar').inert = body.classList.contains('workspace-calm') && overlaySidebar.matches && !body.classList.contains('calm-sidebar-open');
    window.previewLayout?.();
  }
  function showPane(showSurface, focus = false) {
    mobileSurface = showSurface; panes();
    if (focus && narrow.matches) (showSurface ? root.querySelector('.work-tab[aria-selected="true"]') : el('prompt'))?.focus();
  }
  chatButton.onclick = () => showPane(false, true); surfaceButton.onclick = () => showPane(true, true);
  const sidebarObserver = new MutationObserver(panes); sidebarObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
  narrow.addEventListener('change', panes);
  overlaySidebar.addEventListener('change', () => { closeSidebar(); panes(); });
  function visibility() {
    body.classList.toggle('workspace-calm', !root.hidden);
    if (root.hidden) { closeSidebar(); el('sidebar').inert = false; }
    panes();
  }
  new MutationObserver(visibility).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  function currentRun() {
    let saved = revealed.get(view);
    if (!saved || saved.started !== view.runStartedAt) { saved = { started: view.runStartedAt, reveal: false }; revealed.set(view, saved); }
    return saved;
  }
  function setText(target, text) { if (target.textContent !== text) target.textContent = text; }
  function render() {
    const active = view.running === true, waiting = active && view.waitingFor.length > 0;
    const saved = currentRun(), covered = active && !saved.reveal;
    const hadFocus = veil.contains(document.activeElement);
    status.hidden = !active; veil.hidden = !covered;
    // Prevent keyboard interaction with the obscured preview, never alter its sandbox.
    surface.inert = covered;
    area.dataset.state = waiting ? 'waiting' : active ? 'working' : 'idle';
    setText(statusText, waiting ? `Venter på dig: ${view.waitingFor[0].title}` : window.ChatDisplay.phase(view) || view.statusDetail || 'Aura arbejder …');
    setText(heading, waiting ? 'Et valg, før vi fortsætter' : 'Din idé tager form');
    setText(note, waiting ? 'Aura venter på dit svar i samtalen. Planer og godkendelser gælder fortsat.' : 'Aura arbejder på næste skridt. Du kan se forhåndsvisningen imens; den kan ændre sig under arbejdet.');
    waitingButton.hidden = !waiting;
    setText(statusAction, waiting ? 'Se dit valg' : covered ? 'Se aktivitet' : 'Vis arbejdsstatus');
    statusAction.setAttribute('aria-controls', waiting ? 'chat-panel' : covered ? 'panel-activity' : 'preview-work-veil');
    if (hadFocus && !covered) (active ? statusAction : el('tab-preview')).focus();
  }
  function goToWaiting() { showPane(false); el('agent-activity-jump').click(); }
  waitingButton.onclick = goToWaiting;
  revealButton.onclick = () => { currentRun().reveal = true; render(); statusAction.focus(); };
  statusAction.onclick = () => {
    if (view.waitingFor.length) return goToWaiting();
    if (!veil.hidden) window.workspace.show('activity', { focus: true });
    else { currentRun().reveal = false; render(); revealButton.focus(); }
  };
  window.calmWorkspace = { render, showSurface: () => showPane(true) };
  applyTheme(); visibility(); render();
})();
