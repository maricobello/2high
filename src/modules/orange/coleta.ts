import "server-only";
/**
 * Coleta automática do Orange: para cada usina e competência, executa as "receitas"
 * (qual tela/exportação baixar e com quais filtros), guarda os arquivos no armazenamento
 * privado e um índice que o rateio usa em "Buscar no Orange".
 *
 * As receitas ficam em orange/config.json e são preenchidas a partir do mapa das telas
 * (Integrações › Robô do Orange › Mapear). Os campos aceitam {usina}, {competencia}
 * (AAAA-MM), {mes} (MM), {ano} (AAAA) e {mesAno} (MM/AAAA).
 */
import { storage } from "@/modules/storage";
import { clienteLogado, type ClienteOrange } from "./cliente";

export type TipoColeta = "ucs" | "relatorio" | "energia" | "fatura";

export interface Receita {
  tipo: TipoColeta;
  /** Rótulo para a tela (ex.: "Unidade Rateio GD"). */
  nome: string;
  caminho: string;
  metodo: "GET" | "POST";
  campos?: Record<string, string>;
}

export interface UsinaOrange {
  /** Identificador da usina no Orange (valor do filtro). */
  id: string;
  nome: string;
}

export interface ConfigColeta {
  receitas: Receita[];
  usinas: UsinaOrange[];
  atualizadoEm: string;
}

export interface ArquivoColetado {
  usina: string;
  tipo: TipoColeta;
  nome: string;
  chave: string;
  bytes: number;
}

export interface IndiceColeta {
  competencia: string;
  em: string;
  arquivos: ArquivoColetado[];
  erros: string[];
}

const CONFIG = "orange/config.json";
const ULTIMO = "orange/coletas/ultimo.json";

async function lerJson<T>(chave: string): Promise<T | null> {
  try {
    return JSON.parse((await storage().read(chave)).toString("utf8")) as T;
  } catch {
    return null;
  }
}
async function gravarJson(chave: string, valor: unknown) {
  const s = storage();
  await s.remove(chave).catch(() => {});
  await s.save(chave, Buffer.from(JSON.stringify(valor), "utf8"), "application/json");
}

export const lerConfig = () => lerJson<ConfigColeta>(CONFIG);
export const gravarConfig = (c: ConfigColeta) => gravarJson(CONFIG, c);
export const ultimaColeta = () => lerJson<IndiceColeta>(ULTIMO);

/** Competência anterior ao mês atual (o ciclo fechado mais recente), AAAA-MM. */
export function competenciaAnterior(hoje = new Date()): string {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function preencher(modelo: string, usina: UsinaOrange, competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return modelo
    .replaceAll("{usina}", usina.id)
    .replaceAll("{competencia}", competencia)
    .replaceAll("{mes}", mes)
    .replaceAll("{ano}", ano)
    .replaceAll("{mesAno}", `${mes}/${ano}`);
}

const nomeSeguro = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(0, 80);

function extensao(tipo: string, nome: string | null): string {
  const n = nome?.match(/\.(xlsx|xls|csv|pdf|png|jpe?g)$/i)?.[1];
  if (n) return n.toLowerCase();
  if (/spreadsheet|excel/.test(tipo)) return "xlsx";
  if (/csv/.test(tipo)) return "csv";
  if (/pdf/.test(tipo)) return "pdf";
  if (/png/.test(tipo)) return "png";
  return "bin";
}

/** Executa as receitas para as usinas e competência dadas; erros por item não param o resto. */
export async function coletar(config: ConfigColeta, competencia = competenciaAnterior(), cliente?: ClienteOrange): Promise<IndiceColeta> {
  const c = cliente ?? (await clienteLogado());
  const indice: IndiceColeta = { competencia, em: new Date().toISOString(), arquivos: [], erros: [] };
  for (const u of config.usinas) {
    for (const r of config.receitas) {
      try {
        const caminho = preencher(r.caminho, u, competencia);
        const campos = Object.fromEntries(Object.entries(r.campos ?? {}).map(([k, v]) => [k, preencher(v, u, competencia)]));
        const corpo = new URLSearchParams(campos).toString();
        const arq =
          r.metodo === "POST"
            ? await c.baixar(caminho, { method: "POST", body: corpo, headers: { "Content-Type": "application/x-www-form-urlencoded" } })
            : await c.baixar(corpo ? `${caminho}${caminho.includes("?") ? "&" : "?"}${corpo}` : caminho);
        if (/text\/html/.test(arq.tipo)) throw new Error("o Orange devolveu uma página em vez do arquivo (sessão ou filtro)");
        const ext = extensao(arq.tipo, arq.nome);
        const nome = `${nomeSeguro(u.nome)}_${r.tipo}_${competencia}.${ext}`;
        const chave = `orange/coletas/${competencia}/${nome}`;
        const s = storage();
        await s.remove(chave).catch(() => {});
        await s.save(chave, Buffer.from(arq.dados), arq.tipo || "application/octet-stream");
        indice.arquivos.push({ usina: u.nome, tipo: r.tipo, nome, chave, bytes: arq.dados.byteLength });
      } catch (e) {
        indice.erros.push(`${u.nome} · ${r.nome}: ${e instanceof Error ? e.message : "falha"}`);
      }
    }
  }
  await gravarJson(ULTIMO, indice);
  return indice;
}
