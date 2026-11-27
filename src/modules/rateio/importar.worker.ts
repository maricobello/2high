/// <reference lib="webworker" />
/**
 * Leitura de planilhas fora da thread da tela: o export de faturas do Orange tem dezenas de MB
 * e dezenas de milhares de linhas; lido na tela, o navegador congela. Aqui o worker lê o
 * arquivo, reconhece as tabelas e devolve só o resultado (UCs, candidatas, avisos).
 */
import { chavesDeInstalacao, importarSheets } from "./grid";
import { lerArquivo } from "./xlsx";

type Pedido = { id: number; tipo: "importar" | "desligadas"; files: File[] };

self.onmessage = async (ev: MessageEvent<Pedido>) => {
  const { id, tipo, files } = ev.data;
  try {
    const sheets = (await Promise.all(files.map(async (f) => (await lerArquivo(f)).map((s) => ({ ...s, name: files.length > 1 ? `${f.name} › ${s.name}` : s.name }))))).flat();
    if (tipo === "desligadas") {
      const chaves = new Set<string>();
      for (const sh of sheets) for (const k of chavesDeInstalacao(sh.grid)) chaves.add(k);
      (self as unknown as Worker).postMessage({ id, chaves: [...chaves] });
    } else {
      (self as unknown as Worker).postMessage({ id, imp: importarSheets(sheets) });
    }
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, erro: e instanceof Error ? e.message : String(e) });
  }
};
