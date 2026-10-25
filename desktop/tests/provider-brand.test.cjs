const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const brand = require('../ui/provider-brand.js');

class Element {
  constructor(tag = 'button', ownerDocument) { this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.attributes = {}; this._text = ''; }
  get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent || '').join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const document = { createElement: tag => new Element(tag, document) };

test('kendte forbindelser bruger kun appens egne logoer, og de findes', () => {
  for (const kind of ['anthropic', 'openai', 'mistral', 'ollama', 'openrouter', 'azure', 'corti', 'alexandra', 'zen', 'compatible']) {
    const asset = brand.asset(kind);
    assert.match(asset, /^provider-[a-z]+\.svg$/);
    assert.ok(fs.existsSync(path.join(__dirname, '../ui', asset)), kind);
  }
});

test('OpenRouter viser forbindelsens eget logo, ikke modeludgiverens', () => {
  const button = document.createElement('button');
  brand.decorate(button, { kind: 'openrouter', modelID: 'anthropic/claude-proeve', label: 'Claude prøve · OpenRouter' });
  assert.equal(button.children[0].src, 'provider-openrouter.svg');
  assert.equal(button.textContent, 'Claude prøve · OpenRouter');
});

test('en ukendt forbindelse får kun tekst, og katalogværdier bliver aldrig til billedadresser', () => {
  for (const kind of ['ukendt', '__proto__', 'constructor', 'https://example.invalid/logo.svg', '<img src=x onerror=alert(1)>', null, {}]) {
    const button = document.createElement('button');
    brand.decorate(button, { kind, modelID: 'model', label: 'Valgt model · Ukendt server' });
    assert.equal(button.children.length, 1); assert.equal(button.children[0].tagName, 'span');
    assert.equal(button.textContent, 'Valgt model · Ukendt server');
    assert.equal(brand.asset(kind), null);
  }
});

test('modelnavnet forbliver tekst, og logoet er pynt, som skærmlæsere springer over', () => {
  const label = '<img src=x onerror=alert(1)> & "Claude"', button = document.createElement('button');
  brand.decorate(button, { kind: 'anthropic', modelID: 'claude', label });
  assert.equal(button.textContent, label);
  assert.deepEqual(button.children.map(child => child.tagName), ['img', 'span']);
  assert.equal(button.children[0].alt, ''); assert.equal(button.children[0].attributes['aria-hidden'], 'true');
});

test('et nyt valg erstatter logoet, og uden valgt model vises intet logo', () => {
  const button = document.createElement('button');
  brand.decorate(button, { kind: 'mistral', modelID: 'model', label: 'Mistral' });
  brand.decorate(button, { kind: 'openai', modelID: 'gpt', label: 'OpenAI' });
  assert.equal(button.children.length, 2); assert.equal(button.children[0].src, 'provider-openai.svg');
  brand.decorate(button, { kind: 'openai', modelID: '', label: 'Vælg AI' });
  assert.equal(button.children.length, 1); assert.equal(button.textContent, 'Vælg AI');
  assert.doesNotThrow(() => brand.decorate(null));
});
