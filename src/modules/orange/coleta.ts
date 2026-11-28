import "server-only";
/**
 * Coleta automática do Orange, sem configuração:
 *  1. lista as usinas de GD do usuário;
 *  2. baixa as UCs do rateio (tela Unidade Rateio GD) e grava uma planilha por usina,
 *     que o rateio importa em "Buscar no Orange";
 *  3. lê o Relatório Gerencial de cada usina (consumo, compensado, economia em R$) para o
 *     acompanhamento. Como a Vercel limita cada execução a 60 s, o que faltar fica pendente
 *     e a próxima execução (cron diário do dia 6 ao 12, ou "Coletar agora") continua.
 *
 * "Receitas" extras (outras telas/exportações) continuam opcionais em orange/config.json;
 * os campos aceitam {usina}, {competencia} (AAAA-MM), {mes}, {ano} e {mesAno} (MM/AAAA).
 */
import { storage } from "@/modules/storage";
import { clienteLogado, type ClienteOrange } from "./cliente";
import { gerencialDaUsina, listarUsinas, planilhaGerencial, planilhaUcs, ucsDoRateio, type GerencialUsina, type UsinaGd } from "./gd";

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
  /** Só estas usinas (parte do nome ou id do Orange); vazio = todas as usinas do usuário. */
  filtroUsinas?: string[];
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
  /** Relatório Gerencial por usina (acompanhamento da economia). */
  gerencial?: GerencialUsina[];
  /** Usinas que ainda faltam ler nesta competência. */
  pendentes?: number;
  usinas?: number;
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

async function salvar(chave: string, dados: Buffer, tipo: string) {
  const s = storage();
  await s.remove(chave).catch(() => {});
  await s.save(chave, dados, tipo);
}

/** Receitas extras (opcionais) para as usinas configuradas. */
async function executarReceitas(c: ClienteOrange, config: ConfigColeta, competencia: string, indice: IndiceColeta) {
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
        const nome = `${nomeSeguro(u.nome)}_${r.tipo}_${competencia}.${extensao(arq.tipo, arq.nome)}`;
        const chave = `orange/coletas/${competencia}/${nome}`;
        await salvar(chave, Buffer.from(arq.dados), arq.tipo || "application/octet-stream");
        indice.arquivos.push({ usina: u.nome, tipo: r.tipo, nome, chave, bytes: arq.dados.byteLength });
      } catch (e) {
        indice.erros.push(`${u.nome} · ${r.nome}: ${e instanceof Error ? e.message : "falha"}`);
      }
    }
  }
}

export function filtrarUsinas(usinas: UsinaGd[], filtro: string[] | undefined): UsinaGd[] {
  const f = (filtro ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!f.length) return usinas;
  return usinas.filter((u) => f.some((x) => String(u.id) === x || u.nome.toLowerCase().includes(x) || u.apelido.toLowerCase().includes(x)));
}

export interface OpcoesColeta {
  /** Tempo máximo desta execução (ms); o restante fica pendente. */
  orcamentoMs?: number;
  /** Baixa as UCs de novo mesmo se já baixou nesta competência. */
  refazerUcs?: boolean;
  cliente?: ClienteOrange;
}

/**
 * Coleta automática da competência (padrão: o mês fechado anterior). Continua de onde parou
 * quando a competência é a mesma da última coleta.
 */
export async function coletar(config: ConfigColeta | null, competencia = competenciaAnterior(), opcoes: OpcoesColeta = {}): Promise<IndiceColeta> {
  const inicio = Date.now();
  const orcamento = opcoes.orcamentoMs ?? 45_000;
  const c = opcoes.cliente ?? (await clienteLogado());
  const anterior = await ultimaColeta();
  const mesma = anterior?.competencia === competencia ? anterior : null;
  const indice: IndiceColeta = {
    competencia,
    em: new Date().toISOString(),
    arquivos: mesma?.arquivos ?? [],
    erros: [],
    gerencial: mesma?.gerencial ?? [],
  };

  const usinas = filtrarUsinas(await listarUsinas(c), config?.filtroUsinas);
  indice.usinas = usinas.length;
  if (!usinas.length) indice.erros.push("Nenhuma usina de GD visível para este usuário no Orange.");

  // 1) UCs do rateio: uma planilha por usina
  const jaTemUcs = indice.arquivos.some((a) => a.tipo === "ucs");
  if (usinas.length && (!jaTemUcs || opcoes.refazerUcs)) {
    indice.arquivos = indice.arquivos.filter((a) => a.tipo !== "ucs");
    for (let i = 0; i < usinas.length; i += 15) {
      const lote = usinas.slice(i, i + 15);
      try {
        const ucs = await ucsDoRateio(c, lote, competencia);
        for (const u of lote) {
          const daUsina = ucs.filter((x) => x.usinaId === u.id);
          if (!daUsina.length) continue;
          const nome = `${nomeSeguro(u.nome)}_ucs_${competencia}.xlsx`;
          const chave = `orange/coletas/${competencia}/${nome}`;
          const dados = await planilhaUcs(daUsina);
          await salvar(chave, dados, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          indice.arquivos.push({ usina: u.nome, tipo: "ucs", nome, chave, bytes: dados.byteLength });
        }
      } catch (e) {
        indice.erros.push(`UCs do rateio (${lote.length} usina(s)): ${e instanceof Error ? e.message : "falha"}`);
      }
    }
  }

  // 2) Relatório Gerencial: só o que ainda não está ok, dentro do tempo
  const ok = new Set((indice.gerencial ?? []).filter((g) => g.status === "ok").map((g) => g.usinaId));
  const faltam = usinas.filter((u) => !ok.has(u.id));
  let lidas = 0;
  for (const u of faltam) {
    if (Date.now() - inicio > orcamento) break;
    try {
      const { linhas, ...g } = await gerencialDaUsina(c, u, competencia);
      indice.gerencial = [...(indice.gerencial ?? []).filter((x) => x.usinaId !== u.id), g];
      if (linhas.length) {
        const nome = `${nomeSeguro(u.nome)}_relatorio_${competencia}.xlsx`;
        const chave = `orange/coletas/${competencia}/${nome}`;
        const dados = await planilhaGerencial(u.nome, competencia, linhas);
        try {
          await salvar(chave, dados, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          indice.arquivos = [...indice.arquivos.filter((a) => a.chave !== chave), { usina: u.nome, tipo: "relatorio", nome, chave, bytes: dados.byteLength }];
        } catch {
          indice.erros.push(`${u.nome} · não deu para guardar o Relatório Gerencial (banco fora do ar?)`);
        }
      }
    } catch (e) {
      indice.erros.push(`${u.nome} · Relatório Gerencial: ${e instanceof Error ? e.message : "falha"}`);
    }
    lidas++;
  }
  indice.pendentes = faltam.length - lidas;

  // 3) receitas extras, se houver
  if (config?.receitas.length && config.usinas.length && Date.now() - inicio < orcamento) await executarReceitas(c, config, competencia, indice);

  try {
    await gravarJson(ULTIMO, indice);
  } catch {
    indice.erros.push("Não deu para guardar a coleta: o banco do site está fora do ar (Supabase pausado?). Os números acima valem, mas as planilhas não ficam salvas para o Rateio.");
  }
  return indice;
}

/** Soma da economia registrada no Relatório Gerencial (usinas lidas com sucesso). */
export function resumoEconomia(indice: IndiceColeta | null) {
  const g = (indice?.gerencial ?? []).filter((x) => x.status === "ok");
  const soma = (k: keyof GerencialUsina["totais"]) => g.reduce((a, x) => a + x.totais[k], 0);
  return { usinas: g.length, consumoKwh: soma("consumoKwh"), compensadoKwh: soma("compensadoKwh"), economiaRs: soma("economiaRs"), custoCativoRs: soma("custoCativoRs"), custoGdRs: soma("custoGdRs") };
}
