// Teksten i en PDF læses i en egen proces med snævre grænser: ingen netadgang, ingen scripts i dokumentet, ingen
// skrifttyper udefra og ingen optegning. Der udføres ikke OCR, så en PDF, der kun består af billeder, giver ingen
// tekst. PDF'en kommer ind på standard input, og resultatet skrives som JSON på standard output.
(async () => {
  globalThis.fetch = async () => { throw Error('PDF-læseren har ingen netadgang.'); };
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 5 * 1024 * 1024) throw Error('PDF’en er for stor.'); chunks.push(chunk); }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(Buffer.concat(chunks)), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, disableAutoFetch: true, disableRange: true, disableStream: true, stopAtErrors: true, verbosity: 0 });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw Error('PDF’en må højst indeholde 100 sider.');
    const pages = [];
    let total = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (typeof item.str === 'string') text += item.str + (item.hasEOL ? '\n' : ' ');
        if (text.length > 128 * 1024) throw Error('PDF-teksten må højst fylde 128 KB.');
      }
      text = text.trim();
      total += Buffer.byteLength(text);
      if (total > 128 * 1024) throw Error('PDF-teksten må højst fylde 128 KB.');
      pages.push({ page: number, text });
      page.cleanup();
    }
    if (!total) throw Error('PDF’en indeholder ingen tekst, der kan udtrækkes. Der er ikke udført OCR.');
    const text = pages.map(page => `[Side ${page.page}]\n${page.text}`).join('\n\n');
    if (Buffer.byteLength(text) > 128 * 1024) throw Error('PDF-teksten må højst fylde 128 KB.');
    process.stdout.write(JSON.stringify({ pages, text }));
  } finally { await task.destroy(); }
})().catch(error => { process.stderr.write(String(error.message).slice(0, 300)); process.exitCode = 1; });
