const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const uiFiles = require('../core/ui-files.cjs');

const ui = path.join(__dirname, '..', 'ui');
const html = fs.readFileSync(path.join(ui, 'index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const sorted = list => [...list].sort();

// En fil, der mangler i listen, giver 404 uden fejl, og de fleste moduler bruges med window.X?., så funktionen forsvinder stille.
test('hver lokal fil, index.html henter, står i listen over leverede filer og findes', () => {
  const referenced = new Set([...html.matchAll(/\b(?:src|href)="([\w.-]+\.(?:js|css|png|svg))"/g)].map(match => match[1]));
  assert.ok(referenced.size > 20, 'index.html henter appens scripts og stilark');
  for (const file of referenced) {
    assert.ok(uiFiles.has(file), `${file} hentes af index.html, men står ikke i core/ui-files.cjs`);
    assert.ok(fs.existsSync(path.join(ui, file)), `${file} findes ikke i ui/`);
  }
});

test('hver fil i listen findes i ui/', () => {
  for (const file of uiFiles) assert.ok(fs.existsSync(path.join(ui, file)), `${file} står i listen, men findes ikke i ui/`);
});

test('listen over leverede filer står i alfabetisk orden', () => {
  assert.deepEqual([...uiFiles], sorted(uiFiles));
});

test('index.html har ét script eller stilark pr. linje i head', () => {
  for (const line of head.split('\n')) assert.ok((line.match(/<script|<link/g) || []).length <= 1, `flere elementer på samme linje: ${line.slice(0, 80)}`);
});

test('preload.cjs har én kanal pr. linje i alfabetisk orden', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'preload.cjs'), 'utf8');
  const body = source.slice(source.indexOf('const methods = {') + 'const methods = {'.length, source.indexOf('\n};'));
  const lines = body.split('\n').filter(line => line.trim());
  const names = lines.map(line => {
    const match = /^  (\w+): '([\w:-]+)',?$/.exec(line);
    assert.ok(match, `ikke én kanal på linjen: ${line.slice(0, 80)}`);
    return match[1];
  });
  assert.ok(names.length > 100, 'alle kanaler er fundet');
  assert.deepEqual(names, sorted(names));
  assert.equal(new Set(names).size, names.length, 'ingen navne gentages');
});
