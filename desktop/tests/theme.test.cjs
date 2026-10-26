// Lyst og mørkt tema bygger på ét sæt farvetokens i ui/styles.css. Testene fanger en fast farve uden for tokens,
// et token uden mørk værdi, et token i en forkert rolle, et brugt token, der ikke findes, for lav kontrast i et af
// temaerne og et ensfarvet logo, der forbliver mørkt på mørk baggrund.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = name => fs.readFileSync(path.join(__dirname, '..', 'ui', name), 'utf8');
const css = ui('styles.css');
const rootEnd = css.indexOf('\n}\n') + 3, root = css.slice(0, rootEnd);
// Høj kontrast bruger systemets farver og står for sig.
const forced = /@media \(forced-colors: active\) \{[\s\S]*?\n\}\n/;
const rules = [...css.slice(rootEnd).replace(/\/\*[\s\S]*?\*\//g, '').replace(forced, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), decls: body.split(';').map(d => d.match(/^\s*([a-z-]+)\s*:\s*([\s\S]+?)\s*$/)).filter(Boolean).map(([, prop, value]) => ({ prop, value })) }));
const tokens = Object.fromEntries([...root.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
const layout = ['radius', 'sidebar', 'motion-fast', 'motion-step', 'ease-out'];
const pair = name => { const m = tokens[name]?.match(/^light-dark\((#[0-9a-f]{3,8}),\s*(#[0-9a-f]{3,8})\)$/i); assert.ok(m, `--${name} har ikke både en lys og en mørk værdi`); return [m[1], m[2]]; };

// Farver, der bevidst står fast: metalkanten, masken, kontaktens knop, sidens egen baggrund i forhåndsvisningen,
// gennemsigtighedsmønstret i farveprøven, komplais blå skråstreg og pladen bag Cloudflares logo.
const fixed = [
  ['#chat-form::before', ['#fff', '#8b8c9e', '#e7e8f3', '#8583ab', '#c6dbe2', '#7d82a1', '#f5effa', '#a6c6c2', '#8f8ba9', '#e9ecf3']],
  ['input[type=checkbox][role=switch]::before', ['#fff']],
  ['iframe', ['#fff']], ['#preview-stage', ['white']], ['.compare img', ['#fff']],
  ['.color-swatch', ['#eee', 'white']], ['.komplai-mark b', ['#0ea5e9']], ['img[src$="provider-cloudflare.png"]', ['#fff']]
];
const named = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ');
const system = 'accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext'.split(' ');
const colorProps = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline))?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|accent-color|caret-color|text-decoration(-color)?|column-rule(-color)?|mask)$/;

test('ingen faste farver uden for farvetokens, ud over de bevidst faste', () => {
  const found = [];
  for (const { selector, decls } of rules) for (const { prop, value } of decls) {
    if (!colorProps.test(prop)) continue;
    const literal = value.replace(/var\(--[a-z-]+\)/g, ' ');
    const colors = [...(literal.match(/#[0-9a-f]{3,8}\b/gi) || []), ...(literal.match(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi) || [])];
    for (const word of literal.toLowerCase().match(/[a-z]+/g) || []) if (named.includes(word) || system.includes(word)) colors.push(word);
    for (const color of colors) if (!fixed.some(([s, list]) => s === selector && list.includes(color.toLowerCase()))) found.push(`${selector} { ${prop}: ${value} }`);
  }
  assert.deepEqual(found, [], 'Brug et farvetoken fra :root i ui/styles.css');
});

test('hvert brugt token findes, og hvert farvetoken har en lys og en mørk værdi', () => {
  const runtime = ['chat-width', 'swatch-color', 'work-edge-angle'];
  const used = [...new Set([...css.matchAll(/var\(--([a-z-]+)/g)].map(m => m[1]))];
  assert.deepEqual(used.filter(name => !tokens[name] && !runtime.includes(name)), []);
  assert.deepEqual(Object.keys(tokens).filter(name => !used.includes(name)), [], 'Tokens, som ingen regel bruger');
  for (const name of Object.keys(tokens).filter(name => !layout.includes(name) && name !== 'on-accent')) pair(name);
  assert.equal(tokens['on-accent'], '#fff');
  assert.match(root, /color-scheme: light dark;/);
});

const luminance = hex => { const full = hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex.slice(0, 7); return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const value = (name, scheme) => name === 'on-accent' ? tokens[name] : pair(name)[scheme];
const surfaces = ['canvas', 'surface', 'raised', 'field', 'fill-subtle', 'fill', 'fill-strong', 'control', 'control-hover', 'control-active', 'tint', 'tint-subtle', 'success-bg', 'warning-bg', 'warning-bg-subtle', 'danger-bg'];
const inks = ['ink', 'muted', 'quiet', 'accent-text', 'accent-ink', 'focus', 'success-ink', 'warning-ink', 'danger-ink'];

test('flader bliver mørkere og tekst lysere i mørkt tema', () => {
  const wrong = [...surfaces.filter(name => !(luminance(pair(name)[1]) < luminance(pair(name)[0]))), ...inks.filter(name => !(luminance(pair(name)[1]) > luminance(pair(name)[0])))];
  assert.deepEqual(wrong, []);
});

// Hvilke tokens en regel må bruge til tekst og til flader. Fx er --accent en flade med hvid tekst og må ikke være tekst.
const textTokens = [...inks.filter(name => name !== 'focus'), 'faint', 'on-accent', 'surface'];
const notBehind = ['accent-text', 'accent-ink', 'focus', 'muted', 'success-ink', 'warning-ink', 'danger-ink'];
test('tokens bruges i deres rolle: tekst, flade og fokus', () => {
  const wrong = [];
  for (const { selector, decls } of rules) for (const { prop, value: v } of decls) {
    const names = [...v.matchAll(/var\(--([a-z-]+)\)/g)].map(m => m[1]).filter(name => tokens[name]);
    if (prop === 'color') wrong.push(...names.filter(name => !textTokens.includes(name)).map(name => `${selector}: color bruger --${name}`));
    if (/^outline(-color)?$/.test(prop)) wrong.push(...names.filter(name => name !== 'focus').map(name => `${selector}: outline bruger --${name}`));
    if (/^background/.test(prop)) wrong.push(...names.filter(name => notBehind.includes(name)).map(name => `${selector}: baggrund bruger --${name}`));
  }
  assert.deepEqual(wrong, []);
});

// WCAG 2.2: 4,5:1 for tekst og 3:1 for fokus, valgte kanter og statusprikker.
test('tekst og markeringer har nok kontrast i både lyst og mørkt tema', () => {
  const text = [
    ...surfaces.map(s => ['ink', s]),
    ...['canvas', 'surface', 'raised', 'field', 'fill-subtle', 'fill', 'fill-strong', 'control', 'control-hover', 'tint'].map(s => ['muted', s]),
    ...['canvas', 'surface', 'raised', 'field'].map(s => ['quiet', s]),
    ...['canvas', 'surface', 'raised', 'field', 'fill-subtle', 'fill', 'fill-strong', 'control', 'control-hover', 'tint', 'tint-subtle'].map(s => ['accent-text', s]),
    ['accent-ink', 'tint'], ['accent-ink', 'fill-strong'], ['on-accent', 'accent'], ['on-accent', 'accent-hover'], ['surface', 'ink'],
    ['success-ink', 'success-bg'], ['success-ink', 'surface'], ['success-ink', 'raised'], ['warning-ink', 'warning-bg'], ['warning-ink', 'warning-bg-subtle'], ['warning-ink', 'surface'],
    ['danger-ink', 'danger-bg'], ['danger-ink', 'surface'], ['danger-ink', 'raised']];
  const marks = [['focus', 'surface'], ['focus', 'raised'], ['focus', 'canvas'], ['accent', 'surface'], ['accent', 'raised'], ['success', 'surface'], ['warning', 'surface'], ['danger', 'surface'], ['quiet', 'canvas'], ['on-accent', 'success'], ['on-accent', 'danger']];
  const low = [];
  for (const [list, minimum] of [[text, 4.5], [marks, 3]]) for (const [a, b] of list) for (const scheme of [0, 1]) {
    const ratio = contrast(value(a, scheme), value(b, scheme));
    if (ratio < minimum) low.push(`${['lyst', 'mørkt'][scheme]}: --${a} på --${b} ${ratio.toFixed(2)} < ${minimum}`);
  }
  // Regler, der selv sætter både tekst og flade med ét token hver. Pynt med --faint er undtaget.
  for (const { selector, decls } of rules) {
    const one = prop => decls.filter(d => d.prop === prop || (prop === 'background' && d.prop === 'background-color')).map(d => d.value.match(/^var\(--([a-z-]+)\)$/)?.[1]).filter(Boolean).pop();
    const fg = one('color'), bg = one('background');
    if (!fg || !bg || fg === 'faint') continue;
    for (const scheme of [0, 1]) { const ratio = contrast(value(fg, scheme), value(bg, scheme)); if (ratio < 4.5) low.push(`${['lyst', 'mørkt'][scheme]}: ${selector} --${fg} på --${bg} ${ratio.toFixed(2)}`); }
  }
  assert.deepEqual(low, []);
});

// Et ensfarvet logo skal have en mørk regel, der faktisk rammer hver mørk flade eller streg i filen.
function darkCoverage(svg) {
  const parts = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
  const media = parts.match(/@media \(prefers-color-scheme: dark\)\{([\s\S]*)\}$/)?.[1] || '';
  const ruleList = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), props: Object.fromEntries(body.split(';').map(d => d.split(':').map(s => s.trim())).filter(d => d[1])) }));
  const base = ruleList(parts.replace(/@media[\s\S]*$/, '')), dark = ruleList(media);
  const matches = (sel, el) => sel === el.tag || (sel.match(/^(\w*)\[(\w+)="([^"]+)"\]$/) && (([, tag, attr, val]) => (!tag || tag === el.tag) && el.attrs[attr] === val)(sel.match(/^(\w*)\[(\w+)="([^"]+)"\]$/))) || (sel.startsWith('.') && el.attrs.class?.split(/\s+/).includes(sel.slice(1)));
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<(clipPath|defs)[\s\S]*?<\/\1>/g, '');
  const missing = [];
  for (const [, tag, rest] of body.matchAll(/<(\w+)([^>]*)>/g)) {
    const el = { tag, attrs: Object.fromEntries([...rest.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])) };
    for (const prop of ['fill', 'stroke']) {
      const paint = base.filter(r => matches(r.sel, el) && r.props[prop]).map(r => r.props[prop]).pop() || el.attrs[prop];
      if (!paint || !/^#[0-9a-f]{3,6}$|^black$/i.test(paint)) continue;
      // Mørk betyder under 3:1 mod den mørke flade; den lyse udgave skal nå mindst 3:1.
      if (contrast(paint === 'black' ? '#000' : paint, value('surface', 1)) >= 3) continue;
      const lifted = dark.filter(r => matches(r.sel, el) && r.props[prop]).map(r => r.props[prop]).pop();
      if (!lifted || contrast(lifted, value('surface', 1)) < 3) missing.push(`<${tag} ${prop}="${paint}">`);
    }
  }
  return missing;
}
test('ensfarvede udbyderlogoer har en lys udgave i mørkt tema, som rammer hver mørk flade', () => {
  const dir = path.join(__dirname, '..', 'ui');
  const files = fs.readdirSync(dir).filter(name => /^provider-.*\.svg$/.test(name) && name !== 'provider-promte.svg');
  assert.ok(files.length >= 12);
  // promte har sin egen mørke flade bag logoet.
  for (const file of files) assert.deepEqual(darkCoverage(fs.readFileSync(path.join(dir, file), 'utf8')), [], file);
  assert.notDeepEqual(darkCoverage('<svg><style>@media (prefers-color-scheme: dark){[fill="#000000"]{fill:#e4e9f0}}</style><path d="M0" fill="#182235"/></svg>'), [], 'vagten slår til, når selektoren ikke rammer');
});

test('Udseende ligger under Indstillinger med Følg systemet først og markeret som anbefalet', () => {
  const html = ui('index.html');
  const menu = html.match(/<div id="settings-menu"[\s\S]*?<\/div>/)[0];
  assert.match(menu, /id="appearance-button"[^>]*>[\s\S]*?Udseende<\/button>/);
  const dialog = html.match(/<dialog id="appearance-dialog"[\s\S]*?<\/dialog>/)[0];
  assert.deepEqual([...dialog.matchAll(/value="([a-z]+)"/g)].map(m => m[1]), ['system', 'light', 'dark']);
  assert.match(dialog, /Følg systemet<\/span><span class="recommended">Anbefalet<\/span>/);
  assert.equal((dialog.match(/class="recommended"/g) || []).length, 1);
});
