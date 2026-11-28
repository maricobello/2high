/**
 * Rateio automático no servidor: o mesmo cálculo da tela do Rateio GD (otimizador HiGHS, regra do
 * contrato, refino), sem navegador. Recebe as planilhas que o robô do Orange baixou (UCs do rateio e
 * Relatório Gerencial) e os dados da usina (contratada, injetada, gerada, meses) e devolve o
 * resultado e a planilha modelo preenchida.
 */
import highsLoader from "highs";
import { analisarProjeto, injecaoMensal } from "./engine";
import { importarSheets } from "./grid";
import { interpretarSolucao, montarModelo, OPCOES_SOLVER } from "./otimizador";
import { preencherModelo } from "./planilha-modelo";
import { PARAMETROS_PADRAO, type Parametros, type ResultadoUsina, type Usina } from "./types";
import type { Sheet } from "./grid";

export interface DadosUsinaAuto {
  nome: string;
  distribuidora: string;
  /** AAAA-MM */
  inicio: string;
  /** AAAA-MM */
  fim: string;
  meses: number;
  contratadaPeriodo: number;
  injetadaPeriodo: number;
  geradaPeriodo: number;
}

export interface ResumoRateioAuto {
  usina: string;
  ucs: number;
  metodo: string;
  status: string;
  compensadoAtualKwh: number;
  compensadoPropostoKwh: number;
  ganhoKwhAno: number;
  cargaContratoPct: number | null;
  saldoFinalAtualKwh: number;
  saldoFinalPropostoKwh: number;
  avisos: string[];
}

let highs: ReturnType<typeof highsLoader> | null = null;

const fimDoMes = (aaaamm: string) => {
  const [a, m] = aaaamm.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};

/** Monta a usina a partir das planilhas do robô (UCs + Relatório Gerencial) e dos dados do período. */
export function usinaDasPlanilhas(sheets: Sheet[], d: DadosUsinaAuto): Usina | null {
  const imp = importarSheets(sheets);
  const comSaldo = imp.usinas.find((u) => u.ucs.length && u.fonteUcs !== "relatorio");
  const rel = imp.usinas.find((u) => u.fonteUcs === "relatorio");
  const u = comSaldo ?? rel;
  if (!u) return null;
  return {
    ...u,
    nome: d.nome || u.nome,
    distribuidora: d.distribuidora || u.distribuidora,
    periodoInicio: `${d.inicio}-01`,
    periodoFim: fimDoMes(d.fim),
    meses: d.meses,
    energiaContratadaPeriodo: d.contratadaPeriodo,
    energiaInjetadaPeriodo: d.injetadaPeriodo,
    energiaGeradaPeriodo: d.geradaPeriodo,
    consumoMensal: [...(u.consumoMensal ?? []), ...(rel && rel !== u ? rel.consumoMensal : [])],
  };
}

/** Roda o rateio otimizado de uma usina, como a tela faz, e gera a planilha modelo. */
export async function rateioAutomatico(u: Usina, params: Partial<Parametros> = {}): Promise<{ resultado: ResultadoUsina; resumo: ResumoRateioAuto; planilha: Buffer }> {
  const p: Parametros = { ...PARAMETROS_PADRAO, incluirNovasUcs: false, ...params };
  const avisos: string[] = [];
  if (injecaoMensal(u) <= 0) throw new Error("sem energia injetada da usina no período");
  const base = analisarProjeto([u], [], p);
  let resultado = base.usinas[0];
  let status = "proporcional";
  const modelo = montarModelo([u], base.candidatas, p);
  if (modelo.mapa.length) {
    highs ??= highsLoader();
    const h = await highs;
    const t0 = Date.now();
    const sol = h.solve(modelo.lp, OPCOES_SOLVER as never);
    const otim = interpretarSolucao(modelo, sol.Status, sol.ObjectiveValue, sol.Columns as never, Date.now() - t0);
    resultado = analisarProjeto([u], [], p, otim).usinas[0];
    status = String(sol.Status);
  }
  for (const v of resultado.validacoes ?? []) if (!v.ok && v.nivel === "erro") avisos.push(`${v.titulo}: ${v.detalhe}`);
  const blob = await preencherModelo(u, resultado, [], p);
  const planilha = Buffer.from(await blob.arrayBuffer());
  const contr = u.energiaContratadaPeriodo > 0 && u.meses > 0 ? u.energiaContratadaPeriodo / u.meses : 0;
  const compensavelMes = u.ucs.reduce((a, x) => a + x.compensavelKwh, 0);
  const resumo: ResumoRateioAuto = {
    usina: u.nome,
    ucs: u.ucs.length,
    metodo: resultado.metodo,
    status,
    compensadoAtualKwh: Math.round(resultado.atual.compensadoTotal),
    compensadoPropostoKwh: Math.round(resultado.proposto.compensadoTotal),
    ganhoKwhAno: Math.round(resultado.proposto.compensadoTotal - resultado.atual.compensadoTotal),
    cargaContratoPct: contr > 0 ? Math.round((compensavelMes / contr) * 1000) / 10 : null,
    saldoFinalAtualKwh: Math.round(resultado.atual.saldoFinal),
    saldoFinalPropostoKwh: Math.round(resultado.proposto.saldoFinal),
    avisos: avisos.slice(0, 5),
  };
  return { resultado, resumo, planilha };
}
