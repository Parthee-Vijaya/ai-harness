// Kvittering fra macOS-signeringen: signering ændrer runtime-værktøjernes bytes, så kontrollen bagefter skal vide,
// hvilke ændringer der er signeringens egne. Én kvittering pr. bygning, navngivet efter pakkens kildebevis og de
// signerede bytes. En signatur med tidsstempel giver nye bytes ved hver bygning, så to bygninger af samme commit får
// hver sin kvittering, og en ny pakning sletter aldrig en tidligere. Det er en lokal kvittering, ikke Apples kontrol.
// Efter forslag i #39.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { promisify } = require('node:util');
const run = promisify(require('node:child_process').execFile);
const { createHash } = require('node:crypto');
const { inventory } = require('./runtime-integrity.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipts = path.join(__dirname, '..', '.runtime', 'receipts');
async function receiptPath(resources, target, signed) {
  const proof = await fs.readFile(path.join(resources, 'source-proof.json'));
  return path.join(receipts, `signed-runtime-${target}-${hash(proof).slice(0, 16)}-${signed.sha256.slice(0, 16)}.json`);
}

async function record(resources, target, input, verifySignature = file => run('/usr/bin/codesign', ['--verify', '--strict', file])) {
  const output = await inventory(path.join(resources, 'runtime'));
  assert.deepEqual(Object.keys(output.entries), Object.keys(input.entries), 'Signeringen må ikke tilføje eller fjerne runtime-filer');
  for (const [name, before] of Object.entries(input.entries)) {
    const after = output.entries[name];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    assert(before.type === 'file' && after.type === 'file' && before.executable === after.executable, 'Signeringen må kun ændre signerede filers bytes: ' + name);
    const file = path.join(resources, 'runtime', name), handle = await fs.open(file, 'r');
    const magic = Buffer.alloc(4); try { await handle.read(magic, 0, 4, 0); } finally { await handle.close(); }
    assert(['cffaedfe', 'cefaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(magic.toString('hex')), 'Kun Mach-O-filer må ændres under macOS-signeringen: ' + name);
    await verifySignature(file);
  }
  const proof = await fs.readFile(path.join(resources, 'source-proof.json'));
  const receipt = { schemaVersion: 1, target, inputSha256: input.sha256, sourceProofSha256: hash(proof), payloads: output };
  const file = await receiptPath(resources, target, output);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

// Kvitteringen til netop denne pakkes bytes, eller null. En pakke, der er ændret efter signeringen, har ingen kvittering.
async function expected(resources, target, input) {
  const file = await receiptPath(resources, target, await inventory(path.join(resources, 'runtime')));
  let value; try { value = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  assert.equal(value.schemaVersion, 1); assert.equal(value.target, target);
  assert.equal(value.inputSha256, input.sha256, 'Signeringskvitteringen tilhører en anden runtime');
  assert.equal(value.sourceProofSha256, hash(await fs.readFile(path.join(resources, 'source-proof.json'))), 'Signeringskvitteringen tilhører andre kildefiler');
  return value.payloads;
}
module.exports = { record, expected, receiptPath };
