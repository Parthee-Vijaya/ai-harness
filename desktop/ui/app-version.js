// Read-only local metadata, not a check for updates. Never delay startup.
(async () => {
  try {
    const result = await window.harness.updatesState(undefined, null);
    const version = result.ok && result.value?.current;
    // Keep the full installed version, including beta number and build metadata.
    if (typeof version !== 'string' || version.length > 80 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) return;
    for (const element of document.querySelectorAll('[data-app-version]')) {
      element.textContent = version;
      element.setAttribute('aria-label', `Version ${version}`);
    }
    for (const logo of document.querySelectorAll('.brand .aura-logo, .aura-brand .aura-logo')) logo.title = `Aura ${version}`;
  } catch { /* Missing metadata must not block project creation. */ }
})();
