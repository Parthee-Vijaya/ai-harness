// En lille, gyldig PDF til prøverne. Den skrives her i stedet for at ligge som en binær fil i repoet, så det er
// til at se, hvad prøven faktisk læser. Uden tekst giver den en PDF, der kun har sider og ingen udtrækkelig tekst.
function pdf(text = 'Syntetisk PDF side 1', pages = 1) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [' + Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ') + `] /Count ${pages} >>`
  ];
  for (let index = 0; index < pages; index++) {
    const content = text ? `BT /F1 12 Tf 50 740 Td (${text}${pages > 1 ? ` · side ${index + 1}` : ''}) Tj ET` : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${4 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    );
  }
  let data = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((value, index) => { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${value}\nendobj\n`; });
  const startxref = Buffer.byteLength(data);
  data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    + offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
    + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  return Buffer.from(data);
}
module.exports = { pdf };
