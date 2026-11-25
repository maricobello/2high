/// <reference lib="webworker" />
/** Busca do máximo compensável ótimo (regra proporcional) fora da thread da tela. */
import { sugerirCobertura } from "./otimo-cobertura";
import type { Candidata, Parametros, Usina } from "./types";

self.onmessage = (ev: MessageEvent<{ id: number; usinas: Usina[]; candidatas: Candidata[]; params: Parametros }>) => {
  const { id, usinas, candidatas, params } = ev.data;
  try {
    (self as unknown as Worker).postMessage({ id, sugestao: sugerirCobertura(usinas, candidatas, params) });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, erro: e instanceof Error ? e.message : String(e) });
  }
};
