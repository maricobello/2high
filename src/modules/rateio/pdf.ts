/**
 * Texto de PDF linha a linha, no navegador (ou no Node, nos testes), com pdf.js via unpdf.
 * Agrupa os trechos de texto pela altura na página para preservar linhas de tabela.
 */
export interface TextoPdf {
  linhas: string[];
  paginas: number;
  /** true quando quase não há texto (PDF digitalizado / imagem). */
  semTexto: boolean;
}

interface Item {
  str: string;
  transform: number[];
  width: number;
}

export async function lerPdf(dados: ArrayBuffer | Uint8Array): Promise<TextoPdf> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(dados instanceof Uint8Array ? dados : new Uint8Array(dados));
  const linhas: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const itens = (tc.items as unknown as Item[]).filter((i) => typeof i.str === "string" && i.str.trim());
    // agrupa por y (tolerância de 2 pt), ordena por x
    const grupos: { y: number; itens: Item[] }[] = [];
    for (const it of itens) {
      const y = it.transform[5];
      const g = grupos.find((x) => Math.abs(x.y - y) <= 2);
      if (g) g.itens.push(it);
      else grupos.push({ y, itens: [it] });
    }
    grupos.sort((a, b) => b.y - a.y);
    for (const g of grupos) {
      g.itens.sort((a, b) => a.transform[4] - b.transform[4]);
      let linha = "";
      let fimAnterior = -Infinity;
      for (const it of g.itens) {
        const x = it.transform[4];
        // separa colunas distantes com dois espaços
        linha += linha ? (x - fimAnterior > 12 ? "  " : x - fimAnterior > 1 ? " " : "") : "";
        linha += it.str.trim();
        fimAnterior = x + it.width;
      }
      linhas.push(linha);
    }
  }
  const chars = linhas.join("").replace(/\s/g, "").length;
  return { linhas, paginas: pdf.numPages, semTexto: chars < 100 };
}
