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
import { rateioAutomatico, usinaDasPlanilhas } from "@/modules/rateio/automatico";
import { lerXlsx } from "@/modules/rateio/xlsx";
import { filtroGestao, gerencialDaUsina, listarUsinas, painelDaUsina, periodoDoPainel, planilhaGerencial, planilhaUcs, ucsDoRateio, type FiltroGestao, type GerencialUsina, type UsinaGd } from "./gd";

export type TipoColeta = "ucs" | "relatorio" | "energia" | "fatura" | "rateio";

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
  /** Usinas que ainda faltam ler no Relatório Gerencial nesta competência. */
  pendentes?: number;
  /** Usinas cujas UCs ainda faltam baixar. */
  pendentesUcs?: number;
  /** Ids das usinas com UCs já baixadas nesta competência. */
  ucsFeitas?: number[];
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

const simples = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(ufv|usina|ugd|gd)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/** Usinas cujo nome (sem acento, sem "UFV") contém algum termo do filtro, ou cujo id é o termo. */
export function filtrarUsinas(usinas: UsinaGd[], filtro: string[] | undefined): UsinaGd[] {
  const f = (filtro ?? []).map((x) => x.trim()).filter(Boolean);
  if (!f.length) return usinas;
  return usinas.filter((u) =>
    f.some((x) => {
      const t = simples(x);
      return String(u.id) === x || (t.length > 1 && (` ${simples(u.nome)} `.includes(` ${t} `) || ` ${simples(u.apelido)} `.includes(` ${t} `)));
    }),
  );
}

export interface OpcoesColeta {
  /** Tempo máximo desta execução (ms); o restante fica pendente. */
  orcamentoMs?: number;
  /** Baixa tudo de novo (UCs e Relatório Gerencial) mesmo se já baixou nesta competência. */
  refazerUcs?: boolean;
  cliente?: ClienteOrange;
}

/**
 * Coleta automática da competência (padrão: o mês fechado anterior). Continua de onde parou
 * quando a competência é a mesma da última coleta.
 */
/** Roda fn em até n itens ao mesmo tempo, sem começar novos depois do prazo. Devolve quantos rodaram. */
export async function emParalelo<T>(itens: T[], n: number, prazo: number, fn: (t: T) => Promise<void>): Promise<number> {
  let i = 0;
  let feitos = 0;
  const trabalhador = async () => {
    while (i < itens.length && Date.now() < prazo) {
      const t = itens[i++];
      await fn(t);
      feitos++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return feitos;
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
    gerencial: opcoes.refazerUcs ? [] : (mesma?.gerencial ?? []),
    ucsFeitas: opcoes.refazerUcs ? [] : (mesma?.ucsFeitas ?? []),
  };

  const usinas = filtrarUsinas(await listarUsinas(c), config?.filtroUsinas);
  indice.usinas = usinas.length;
  if (!usinas.length) indice.erros.push("Nenhuma usina de GD visível para este usuário no Orange.");

  // 1) UCs do rateio: uma planilha por usina (até metade do tempo; o resto continua na próxima)
  let bancoFora = false;
  const feitas = new Set(indice.ucsFeitas);
  const faltamUcs = usinas.filter((u) => !feitas.has(u.id));
  const lotes: UsinaGd[][] = [];
  for (let i = 0; i < faltamUcs.length; i += 15) lotes.push(faltamUcs.slice(i, i + 15));
  await emParalelo(lotes, 3, inicio + orcamento * 0.5, async (lote) => {
    let ucs: Awaited<ReturnType<typeof ucsDoRateio>>;
    try {
      ucs = await ucsDoRateio(c, lote, competencia);
    } catch (e) {
      indice.erros.push(`UCs do rateio (${lote.length} usina(s)): ${e instanceof Error ? e.message : "falha"}`);
      return;
    }
    await emParalelo(lote, 8, Number.POSITIVE_INFINITY, async (u) => {
      const daUsina = ucs.filter((x) => x.usinaId === u.id);
      if (daUsina.length && !bancoFora) {
        const nome = `${nomeSeguro(u.nome)}_ucs_${competencia}.xlsx`;
        const chave = `orange/coletas/${competencia}/${nome}`;
        const dados = await planilhaUcs(daUsina);
        try {
          await salvar(chave, dados, XLSX);
          indice.arquivos = [...indice.arquivos.filter((a) => a.chave !== chave), { usina: u.nome, tipo: "ucs", nome, chave, bytes: dados.byteLength }];
        } catch {
          bancoFora = true;
          return;
        }
      }
      if (!bancoFora) indice.ucsFeitas = [...(indice.ucsFeitas ?? []), u.id];
    });
  });
  const ucsOk = new Set(indice.ucsFeitas);
  indice.pendentesUcs = usinas.filter((u) => !ucsOk.has(u.id)).length;

  // 2) Relatório Gerencial: só o que ainda não está ok, várias usinas ao mesmo tempo
  const ok = new Set((indice.gerencial ?? []).filter((g) => g.status === "ok").map((g) => g.usinaId));
  const faltam = usinas.filter((u) => !ok.has(u.id));
  let filtro: FiltroGestao | null = null;
  let filtroErro = "";
  if (faltam.length) {
    try {
      filtro = await filtroGestao(c);
    } catch (e) {
      filtroErro = e instanceof Error ? e.message : "falha";
    }
  }
  const [ano, mes] = competencia.split("-").map(Number);
  const ini = new Date(Date.UTC(ano, mes - 12, 1));
  const inicio12 = `${ini.getUTCFullYear()}-${String(ini.getUTCMonth() + 1).padStart(2, "0")}`;
  const lidas = await emParalelo(faltam, 6, inicio + orcamento, async (u) => {
    try {
      const { linhas, ...g } = await gerencialDaUsina(c, u, competencia);
      if (filtro) {
        try {
          g.painel = await painelDaUsina(c, u, inicio12, competencia, filtro);
        } catch (e) {
          g.painelErro = e instanceof Error ? e.message : "falha";
        }
      } else if (filtroErro) g.painelErro = filtroErro;
      // rateio automático: UCs do rateio + Relatório Gerencial + dados da usina (Gestão de Usinas)
      const per = periodoDoPainel(g.painel);
      const arqUcs = indice.arquivos.find((a) => a.tipo === "ucs" && a.usina === u.nome);
      if (!per) g.rateioErro = g.painelErro ? `sem dados da usina (${g.painelErro})` : "sem contratada/injetada da usina na Gestão de Usinas";
      else if (!arqUcs) g.rateioErro = "sem a lista de UCs do rateio";
      else {
        try {
          const abas = await lerXlsx(new Uint8Array(await storage().read(arqUcs.chave)).buffer);
          if (linhas.length) abas.push(...(await lerXlsx(new Uint8Array(await planilhaGerencial(u.nome, competencia, linhas)).buffer)));
          const usina = usinaDasPlanilhas(abas, { nome: u.nome, distribuidora: u.distribuidora, inicio: inicio12, fim: competencia, meses: per.meses, contratadaPeriodo: per.contratada, injetadaPeriodo: per.injetada, geradaPeriodo: per.gerada });
          if (!usina) throw new Error("não montou a usina a partir das planilhas");
          const { resumo, planilha } = await rateioAutomatico(usina);
          const nome = `${nomeSeguro(u.nome)}_rateio_${competencia}.xlsx`;
          const chave = `orange/coletas/${competencia}/${nome}`;
          if (!bancoFora) {
            await salvar(chave, planilha, XLSX);
            indice.arquivos = [...indice.arquivos.filter((a) => a.chave !== chave), { usina: u.nome, tipo: "rateio", nome, chave, bytes: planilha.byteLength }];
          }
          g.rateio = { ...resumo, chave };
        } catch (e) {
          g.rateioErro = e instanceof Error ? e.message : "falha no rateio";
        }
      }
      indice.gerencial = [...(indice.gerencial ?? []).filter((x) => x.usinaId !== u.id), g];
      if (linhas.length && !bancoFora) {
        const nome = `${nomeSeguro(u.nome)}_relatorio_${competencia}.xlsx`;
        const chave = `orange/coletas/${competencia}/${nome}`;
        const dados = await planilhaGerencial(u.nome, competencia, linhas);
        try {
          await salvar(chave, dados, XLSX);
          indice.arquivos = [...indice.arquivos.filter((a) => a.chave !== chave), { usina: u.nome, tipo: "relatorio", nome, chave, bytes: dados.byteLength }];
        } catch {
          bancoFora = true;
        }
      }
    } catch (e) {
      indice.erros.push(`${u.nome} · Relatório Gerencial: ${e instanceof Error ? e.message : "falha"}`);
    }
  });
  indice.pendentes = faltam.length - lidas;
  if (bancoFora) indice.erros.push(`Dados baixados do Orange, mas não guardados: o banco do site está fora do ar. No Rateio GD, use "Buscar no Orange", que busca na hora sem o banco.`);

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
