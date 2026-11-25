/// <reference lib="webworker" />
/**
 * Worker do otimizador: carrega o HiGHS (WebAssembly) uma vez e resolve o modelo
 * fora da thread da página, para a tela não travar.
 */
import highsLoader from "highs";

type Pedido = { id: number; lp: string; opcoes: Record<string, unknown>; colunas: string[] };

let highs: ReturnType<typeof highsLoader> | null = null;

self.onmessage = async (ev: MessageEvent<Pedido>) => {
  const { id, lp, opcoes, colunas } = ev.data;
  try {
    highs ??= highsLoader();
    const h = await highs;
    const t0 = performance.now();
    const sol = h.solve(lp, opcoes as never);
    const tempoMs = performance.now() - t0;
    // devolve só as colunas que interessam (percentuais e inclusões)
    const cols: Record<string, { Primal: number }> = {};
    const todas = sol.Columns as Record<string, { Primal?: number }>;
    for (const c of colunas) if (todas[c]?.Primal != null) cols[c] = { Primal: todas[c].Primal! };
    self.postMessage({ id, status: sol.Status, objetivo: sol.ObjectiveValue, colunas: cols, tempoMs });
  } catch (err) {
    self.postMessage({ id, erro: err instanceof Error ? err.message : String(err) });
  }
};
