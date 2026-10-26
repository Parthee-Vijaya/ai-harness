const path = require('node:path');

// Node kører brugerens gennemgåede projektkode og skal kunne indlæse projektets
// native npm-pakker. Tilladelsen gælder kun Node, aldrig Electron eller renderere.
function signingOptions(options) {
  const node = path.join(options.app, 'Contents', 'Resources', 'runtime', 'node', 'bin', 'node');
  const previous = options.optionsForFile || (() => ({}));
  return { ...options, optionsForFile(file) {
    const selected = previous(file);
    return path.resolve(file) === node ? { ...selected, entitlements: path.resolve(__dirname, '../packaging/entitlements.node.mac.plist') } : selected;
  } };
}
// Runtime-værktøjerne kontrolleres mod den forberedte runtime før signeringen. Bagefter gemmes en kvittering for
// de bytes, signeringen ændrede, så pakken kan kontrolleres efter signeringen. Efter forslag i #39.
async function sign(options, signer = require('app-builder-lib/out/codeSign/macCodeSign').sign) {
  const fs = require('node:fs/promises'), integrity = require('./runtime-integrity.cjs');
  const resources = path.join(options.app, 'Contents', 'Resources');
  const manifest = JSON.parse(await fs.readFile(path.join(resources, 'runtime', 'manifest.json'), 'utf8'));
  const prepared = JSON.parse(await fs.readFile(path.join(__dirname, '..', '.runtime', manifest.target, 'manifest.json'), 'utf8'));
  await integrity.verifyRuntime(path.join(resources, 'runtime'), manifest, prepared, require('../runtime-lock.json'), manifest.target);
  await signer(signingOptions(options));
  await require('./signed-runtime-proof.cjs').record(resources, manifest.target, prepared.payloads);
}
module.exports = { sign, signingOptions };
