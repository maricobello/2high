// Gera um PDF simples (texto) a partir de um arquivo .txt — usado em testes ponta a ponta.
// Uso: node scripts/make-sample-pdf.mjs tests/fixtures/fatura-grupo-a.txt saida.pdf
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output] = process.argv;
const lines = readFileSync(input, "utf8").split("\n");
const toLatin1 = (s) => Buffer.from(s, "latin1");
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

let content = "BT /F1 9 Tf 40 800 Td 12 TL\n";
for (const l of lines) content += `(${esc(l)}) '\n`;
content += "ET";
const contentBuf = toLatin1(content);

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  null,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];
const parts = [toLatin1("%PDF-1.4\n")];
const offsets = [];
let size = parts[0].length;
objects.forEach((obj, i) => {
  offsets.push(size);
  const body =
    obj === null
      ? Buffer.concat([toLatin1(`${i + 1} 0 obj\n<< /Length ${contentBuf.length} >>\nstream\n`), contentBuf, toLatin1("\nendstream\nendobj\n")])
      : toLatin1(`${i + 1} 0 obj\n${obj}\nendobj\n`);
  parts.push(body);
  size += body.length;
});
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`;
parts.push(toLatin1(xref));
writeFileSync(output, Buffer.concat(parts));
console.log(`PDF gerado: ${output}`);
