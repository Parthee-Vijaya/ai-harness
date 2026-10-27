// Billeder i en besked. Billedet skrives om til PNG i hovedprocessen, og kun billedpunkterne sendes videre.
// Teksten i beskeden er brugerens egen; billedet lægges på som en del af netop den besked.
const { createHash } = require('node:crypto');
const { imageInfo } = require('./image-info.cjs');
async function mediaSnapshot(data, kind, normalizeImage) {
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
module.exports = { mediaSnapshot, addImages };
