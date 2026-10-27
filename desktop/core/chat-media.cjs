// Billeder i en besked. Billedet skrives om til PNG i hovedprocessen, og kun billedpunkterne sendes videre.
// Teksten i beskeden er brugerens egen; billedet lægges på som en del af netop den besked.
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { imageInfo } = require('./image-info.cjs');
// PDF'en læses i en egen proces med egen hukommelsesgrænse og en tidsgrænse, så en ødelagt eller fjendtlig fil
// hverken kan tage appen med sig eller blive ved. Resultatet er ren tekst; der udføres ikke OCR.
function workerNode() {
  const bundled = require('./runtime.cjs').get()?.node;
  if (bundled) return bundled;
  if (!process.versions.electron) return process.execPath;
  return path.resolve(__dirname, '..', '.runtime', `${process.platform}-${process.arch}`, 'node', process.platform === 'win32' ? 'node.exe' : 'bin/node');
}
async function pdfText(data, { extractPDF } = {}) {
  // Prøverne kan give deres egen udtrækning; appen bruger altid den separate proces.
  if (extractPDF !== undefined) { if (typeof extractPDF !== 'function') throw new Error('Den lokale PDF-læser kunne ikke startes.'); return extractPDF(Buffer.from(data)); }
  return new Promise((resolve, reject) => {
    const node = workerNode();
    const worker = path.join(__dirname.replace(/app\.asar(?=[\\/])/, 'app.asar.unpacked'), 'pdf-text-worker.cjs');
    const child = spawn(node, ['--max-old-space-size=256', worker], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { PATH: path.dirname(node), NODE_NO_WARNINGS: '1' } });
    const output = [];
    let bytes = 0, problem = '', settled = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('PDF-læsningen tog for lang tid.')); }, 15000);
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    child.stdout.on('data', chunk => { if (settled) return; bytes += chunk.length; if (bytes > 1024 * 1024) { child.kill(); finish(new Error('PDF-resultatet er for stort.')); return; } output.push(Buffer.from(chunk)); });
    child.stderr.on('data', chunk => { problem = (problem + chunk.toString()).slice(-1000); });
    child.on('error', () => finish(new Error('Den lokale PDF-læser kunne ikke startes.')));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(problem.includes('OCR') ? 'PDF’en indeholder ingen tekst, der kan udtrækkes. Der er ikke udført OCR.' : 'PDF’en kunne ikke læses sikkert. Brug en almindelig, ukrypteret PDF med højst 100 sider.'));
      try { finish(null, JSON.parse(Buffer.concat(output, bytes).toString('utf8'))); } catch { finish(new Error('PDF-resultatet kunne ikke læses.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(data);
  });
}
async function mediaSnapshot(data, kind, normalizeImage, options = {}) {
  if (kind === 'pdf') { const extracted = await pdfText(data, options); return { kind: 'pdf', mime: 'application/pdf', pages: extracted.pages, text: extracted.text }; }
  if (kind !== 'image') throw new Error('Ukendt filtype.');
  if (typeof normalizeImage !== 'function') throw new Error('Sikker billedbehandling er ikke tilgængelig.');
  const original = imageInfo(data);
  if (!['image/png', 'image/jpeg'].includes(original.mime)) throw new Error('Vælg et PNG- eller JPEG-billede.');
  const image = await normalizeImage(data), info = imageInfo(image.data);
  if (image.mime !== 'image/png' || info.mime !== 'image/png') throw new Error('Billedet kunne ikke klargøres sikkert.');
  return {
    kind: 'image', mime: 'image/png', width: info.width, height: info.height,
    dataURL: `data:image/png;base64,${image.data.toString('base64')}`,
    normalizedBytes: image.data.length, normalizedHash: createHash('sha256').update(image.data).digest('hex'), text: ''
  };
}
// Billedet lægges på brugerens seneste besked i den form, udbyderen bruger. Andet end et rent PNG afvises her.
function addImages(body, images, { responses = false, anthropic = false, mistral = false } = {}) {
  if (!images?.length) return body;
  const messages = responses ? body.input : body.messages;
  if (!Array.isArray(messages)) throw new Error('Billedet kunne ikke bindes til brugerens besked.');
  const message = [...messages].reverse().find(item => item.role === 'user');
  if (!message) throw new Error('Billedet mangler en brugerbesked.');
  const content = typeof message.content === 'string' ? [{ type: responses ? 'input_text' : 'text', text: message.content }] : Array.isArray(message.content) ? [...message.content] : [];
  for (const image of images) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataURL || '') || image.dataURL.length > 1_500_000) throw new Error('Billedet er ændret.');
    content.push(responses ? { type: 'input_image', image_url: image.dataURL, detail: 'auto' }
      : anthropic ? { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.dataURL.split(',')[1] } }
      : { type: 'image_url', image_url: mistral ? image.dataURL : { url: image.dataURL } });
  }
  message.content = content;
  return body;
}
module.exports = { pdfText, mediaSnapshot, addImages };
