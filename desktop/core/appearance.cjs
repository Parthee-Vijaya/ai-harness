// Appens udseende: Følg systemet, Lyst eller Mørkt. Valget gemmes i appens indstillinger og sættes i Electrons
// nativeTheme, som styrer light-dark() og prefers-color-scheme i alle vinduer, vinduesrammen og systemets kontroller.
// Efter forslag i #46.
const THEMES = Object.freeze(['system', 'light', 'dark']);
const known = value => THEMES.includes(value) ? value : 'system';

class Appearance {
  constructor(store, nativeTheme) { this.store = store; this.nativeTheme = nativeTheme; }
  async get() { return { theme: known((await this.store.read()).appearance?.theme) }; }
  // Udseendet må aldrig stoppe opstarten. Kan indstillingerne ikke læses, følger appen systemet.
  async start() {
    let value = { theme: 'system' };
    try { value = await this.get(); } catch { /* Indstillingsfejlen vises af de funktioner, der har brug for dem. */ }
    this.nativeTheme.themeSource = value.theme;
    return value;
  }
  async save(input) {
    if (!THEMES.includes(input?.theme)) throw new Error('Ukendt udseende. Vælg Følg systemet, Lyst eller Mørkt.');
    await this.store.update(state => { state.appearance = { ...state.appearance, theme: input.theme }; });
    this.nativeTheme.themeSource = input.theme;
    return { theme: input.theme };
  }
}
// Vinduets baggrund, før siden er tegnet, så et mørkt vindue ikke blinker hvidt. Samme værdier som --canvas.
const windowBackground = nativeTheme => nativeTheme.shouldUseDarkColors ? '#0E1319' : '#F8FAFC';
module.exports = { Appearance, THEMES, windowBackground };
