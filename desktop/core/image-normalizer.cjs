// Billedet afkodes og skrives om i hovedprocessen, så kun billedpunkterne sendes videre. EXIF, tekstfelter og
// placering fra den oprindelige fil følger ikke med. Store billeder skaleres ned, så det, modellen får, bliver
// ved med at være til at læse uden at fylde urimeligt.
const MAX_INPUT = 5 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const LONG_SIDE = 1600;
function createImageNormalizer({ nativeImage }) {
  if (typeof nativeImage?.createFromBuffer !== 'function') throw new Error('Billedbehandling kræver den native app.');
  return function normalize(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_INPUT) throw new Error('Vælg et billede på højst 5 MB.');
    let image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) throw new Error('Billedet kunne ikke åbnes. Vælg en gyldig PNG- eller JPEG-fil.');
    const size = image.getSize();
    if (![size.width, size.height].every(value => Number.isInteger(value) && value > 0 && value <= 8192) || size.width * size.height > 24_000_000) throw new Error('Billedet er for stort. Vælg højst 8192 pixels pr. side og 24 megapixels.');
    const fit = Math.min(1, LONG_SIDE / size.width, LONG_SIDE / size.height);
    if (fit < 1) image = image.resize({ width: Math.max(1, Math.round(size.width * fit)), height: Math.max(1, Math.round(size.height * fit)), quality: 'good' });
    let data = image.toPNG();
    // Et billede med mange farver kan stadig fylde meget som PNG. Så skaleres det ned endnu et trin.
    for (let attempt = 0; attempt < 2 && data.length > MAX_OUTPUT; attempt++) {
      const current = image.getSize();
      image = image.resize({ width: Math.max(1, Math.round(current.width / 2)), height: Math.max(1, Math.round(current.height / 2)), quality: 'good' });
      data = image.toPNG();
    }
    if (!Buffer.isBuffer(data) || !data.length) throw new Error('Billedet kunne ikke klargøres.');
    if (data.length > MAX_OUTPUT) throw new Error('Billedet fylder for meget, også efter nedskalering. Vælg et mindre billede eller et udsnit.');
    return { data, mime: 'image/png' };
  };
}
module.exports = { createImageNormalizer, MAX_OUTPUT, LONG_SIDE };
