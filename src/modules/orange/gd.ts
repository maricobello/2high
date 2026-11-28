import "server-only";
/**
 * Leitura dos dados de GD do Orange pelos mesmos endereços que as telas usam (só consulta):
 *  - usinas do usuário ............ GET  /cadastrousinagd/usinausuario
 *  - UCs do rateio (Unidade Rateio) POST /unidaderateiogd/getpercentualrateiobyidsusina {usinaIds, competencia}
 *  - Relatório Gerencial ........... GET  /GestaoUsinaGD/GetClientesUsina/{id} e /GestaoUsinaGD/List
 *
 * Nunca chama ações de gravação do Orange (aprovar versão, recalcular, abrir cadeado, importar…).
 */
import { ClienteOrange, ErroOrange } from "./cliente";

export interface UsinaGd {
  id: number;
  nome: string;
  apelido: string;
  distribuidora: string;
}

export interface UcRateio {
  usinaId: number;
  usina: string;
  idUnidade: string;
  instalacao: string;
  apelido: string;
  subgrupo: string;
  pct: number;
  saldoKwh: number;
  compensavelKwh: number;
  compensadoKwh: number;
  rsKwh: number;
}

export interface TotaisGerencial {
  ucs: number;
  consumoKwh: number;
  compensadoKwh: number;
  saldoKwh: number;
  custoCativoRs: number;
  faturaRecebidaRs: number;
  economiaRs: number;
  custoGdRs: number;
}

export interface LinhaGerencial {
  id: string;
  nova: string;
  antiga: string;
  apelido: string;
  pct: number;
  consumoKwh: number;
  compensadoKwh: number;
  tarifa: number;
  minimoRs: number;
}

export interface GerencialUsina {
  usinaId: number;
  usina: string;
  competencia: string;
  cliente: string;
  status: "ok" | "nao_processado" | "sem_dados";
  totais: TotaisGerencial;
  /** Modelos de relatório do Orange (TipoRemuneracaoVariavel) presentes na usina. */
  regras?: number[];
  /** Soma de cada coluna numérica do relatório (para conferir com a tela do Orange). */
  somas?: Record<string, number>;
}

type Obj = Record<string, unknown>;

/** "1.234,56" / "R$ 1.234,56" / 1234.56 → número. */
export function numeroOrange(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const s = v.replace(/R\$|%|kwh/gi, "").replace(/\s/g, "");
  if (!s || s === "-" || s === "--") return 0;
  const n = /,\d{1,}$/.test(s) || s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

const campo = (o: Obj, ...nomes: string[]): unknown => {
  for (const n of nomes) if (o[n] != null && o[n] !== "") return o[n];
  return undefined;
};
const num = (o: Obj, ...nomes: string[]) => numeroOrange(campo(o, ...nomes));
const txt = (o: Obj, ...nomes: string[]) => String(campo(o, ...nomes) ?? "").trim();

/** MM/AAAA a partir de AAAA-MM. */
export const mesAno = (competencia: string) => {
  const [a, m] = competencia.split("-");
  return `${m}/${a}`;
};

async function pedirJson(c: ClienteOrange, caminho: string, init: RequestInit = {}): Promise<Obj> {
  const res = await c.pedir(caminho, { ...init, headers: { Accept: "application/json, text/javascript, */*", "X-Requested-With": "XMLHttpRequest", ...(init.headers as Record<string, string>) } });
  const tipo = res.headers.get("content-type") ?? "";
  const corpo = await res.text();
  if (!res.ok) throw new ErroOrange(`Orange respondeu ${res.status} em ${caminho.split("?")[0]}.`);
  if (!/json/i.test(tipo) && /<html|id="loginform"/i.test(corpo)) throw new ErroOrange(`O Orange devolveu uma página em vez de dados em ${caminho.split("?")[0]} (sessão expirada?).`);
  try {
    return JSON.parse(corpo) as Obj;
  } catch {
    throw new ErroOrange(`Resposta inesperada do Orange em ${caminho.split("?")[0]}.`);
  }
}

const lista = (j: Obj): Obj[] => {
  const d = (j.data ?? j) as unknown;
  return Array.isArray(d) ? (d as Obj[]) : [];
};

export function lerUsinas(j: Obj): UsinaGd[] {
  const vistos = new Map<number, UsinaGd>();
  for (const r of lista(j)) {
    const id = Number(campo(r, "Id_Usina", "id_Usina", "IdUsina"));
    if (!Number.isFinite(id) || vistos.has(id)) continue;
    vistos.set(id, { id, nome: txt(r, "Tx_NomeUsina", "NomeUsina", "Tx_Nome"), apelido: txt(r, "Tx_Apelido"), distribuidora: txt(r, "DistribuidoraApelido", "DistribuidoraNome") });
  }
  return [...vistos.values()];
}

export async function listarUsinas(c: ClienteOrange): Promise<UsinaGd[]> {
  return lerUsinas(await pedirJson(c, "/cadastrousinagd/usinausuario"));
}

export function lerUcs(j: Obj, usinas: UsinaGd[]): UcRateio[] {
  const nomes = new Map(usinas.map((u) => [u.id, u.nome]));
  return lista(j)
    .map((r) => {
      const usinaId = Number(campo(r, "id_Usina", "Id_Usina"));
      return {
        usinaId,
        usina: nomes.get(usinaId) ?? txt(r, "Tx_NomeUsina"),
        idUnidade: txt(r, "Id_Empresa"),
        instalacao: txt(r, "Nr_Numero_Instalacao", "Nr_Instalacao"),
        apelido: txt(r, "Tx_Apelido"),
        subgrupo: txt(r, "Tx_SubGrupo"),
        pct: num(r, "Nr_Percentual", "Nr_Percentual_F"),
        saldoKwh: num(r, "Nr_Saldo_Kwh", "Nr_Saldo_Kwh_F"),
        compensavelKwh: num(r, "Nr_MediaConsumoCompensavel_Kwh", "Nr_MediaConsumoCompensavel_Kwh_F"),
        compensadoKwh: num(r, "Nr_MediaEnergiaCompensada_Kwh", "Nr_MediaEnergiaCompensada_Kwh_F"),
        rsKwh: num(r, "Nr_RsKwh", "Nr_RsKwh_F"),
      };
    })
    .filter((u) => u.instalacao && /\d/.test(u.instalacao));
}

/** UCs do rateio (tela Unidade Rateio GD) das usinas, na competência AAAA-MM. */
export async function ucsDoRateio(c: ClienteOrange, usinas: UsinaGd[], competencia: string): Promise<UcRateio[]> {
  if (!usinas.length) return [];
  const j = await pedirJson(c, "/unidaderateiogd/getpercentualrateiobyidsusina", {
    method: "POST",
    body: JSON.stringify({ usinaIds: usinas.map((u) => u.id), competencia: mesAno(competencia) }),
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  return lerUcs(j, usinas);
}

const linhasDoRelatorio = (j: Obj): Obj[] => {
  const d = (j.data ?? {}) as Obj;
  const grupos = Array.isArray(d.list) ? (d.list as Obj[]) : [];
  return grupos.flatMap((g) => (Array.isArray(g.aaData) ? (g.aaData as Obj[]) : []));
};

export function linhasGerencial(j: Obj): LinhaGerencial[] {
  return linhasDoRelatorio(j)
    .map((r) => ({
      id: txt(r, "Id_Empresa", "Id"),
      nova: txt(r, "UnidadeConsumidoraNova", "UnidadeConsumidora", "Nr_Instalacao"),
      antiga: txt(r, "UnidadeConsumidoraAntiga"),
      apelido: txt(r, "Tx_Apelido"),
      pct: num(r, "PercentualRateioCompetencia"),
      consumoKwh: num(r, "NrEnergiaTotalConsumida"),
      compensadoKwh: num(r, "NrEnergiaCompensada"),
      tarifa: num(r, "NrTarifaCativo", "NrTarifaDefault"),
      minimoRs: num(r, "NrValorConsumoMinimo"),
    }))
    .filter((l) => /\d/.test(l.nova));
}

export function somarGerencial(j: Obj): TotaisGerencial {
  const t: TotaisGerencial = { ucs: 0, consumoKwh: 0, compensadoKwh: 0, saldoKwh: 0, custoCativoRs: 0, faturaRecebidaRs: 0, economiaRs: 0, custoGdRs: 0 };
  {
    for (const r of linhasDoRelatorio(j)) {
      t.ucs++;
      t.consumoKwh += num(r, "NrEnergiaTotalConsumida");
      t.compensadoKwh += num(r, "NrEnergiaCompensada");
      t.saldoKwh += num(r, "NrSaldoMensal");
      t.custoCativoRs += num(r, "NrFaturaSimulada");
      t.faturaRecebidaRs += num(r, "NrFaturaRecebida");
      t.economiaRs += num(r, "NrEconomiaUC");
      t.custoGdRs += num(r, "Nr_DespesaTotal_Final");
    }
  }
  return t;
}

const NUMERICO = /^\s*-?(R\$\s*)?-?[\d.]+(,\d+)?\s*%?\s*$/;

/** Total de cada coluna numérica (números ou textos como "1.234,56"), arredondado a centavos. */
export function somasGerencial(j: Obj): Record<string, number> {
  const somas: Record<string, number> = {};
  for (const r of linhasDoRelatorio(j)) {
    for (const [k, v] of Object.entries(r)) {
      if (/^id|_id$|^Id_|^Nr_Instalacao$|Instalacao|^HiddenOrder$/i.test(k)) continue;
      if (typeof v === "number" || (typeof v === "string" && NUMERICO.test(v))) somas[k] = (somas[k] ?? 0) + numeroOrange(v);
    }
  }
  return Object.fromEntries(Object.entries(somas).slice(0, 120).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

export function regrasGerencial(j: Obj): number[] {
  const d = (j.data ?? {}) as Obj;
  const grupos = Array.isArray(d.list) ? (d.list as Obj[]) : [];
  return [...new Set(grupos.map((g) => Number(g.TipoRemuneracaoVariavel)).filter((n) => Number.isFinite(n)))];
}

/** Relatório Gerencial da usina na competência: totais de consumo, compensado e economia (e as linhas UC a UC). */
export async function gerencialDaUsina(c: ClienteOrange, u: UsinaGd, competencia: string): Promise<GerencialUsina & { linhas: LinhaGerencial[] }> {
  const ma = mesAno(competencia);
  const vazio = somarGerencial({});
  const base = { usinaId: u.id, usina: u.nome, competencia, cliente: "" };
  const resumo = await pedirJson(c, `/gestaousinagd/resumoprocessamentocompetencia?${new URLSearchParams({ id_usina: String(u.id), competencia: ma })}`);
  const st = (resumo.data as Obj | null)?.Nr_Status;
  if (st != null && Number(st) !== 2) return { ...base, status: "nao_processado", totais: vazio, linhas: [] };
  const clientes = lista(await pedirJson(c, `/GestaoUsinaGD/GetClientesUsina/${u.id}`)).map((r) => ({ id: txt(r, "Id"), titulo: txt(r, "Titulo", "Tx_Nome") }));
  const cli = clientes.find((x) => /tim/i.test(x.titulo)) ?? clientes[0];
  if (!cli) return { ...base, status: "sem_dados", totais: vazio, linhas: [] };
  const j = await pedirJson(c, `/GestaoUsinaGD/List?${new URLSearchParams({ ClienteId: cli.id, UsinaId: String(u.id), Competencia: ma })}`);
  const totais = somarGerencial(j);
  return { ...base, cliente: cli.titulo, status: totais.ucs ? "ok" : "sem_dados", totais, regras: regrasGerencial(j), somas: somasGerencial(j), linhas: linhasGerencial(j) };
}

async function excel() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof import("exceljs") }).default ?? (mod as unknown as typeof import("exceljs"));
}

/** Planilha no formato do Relatório Gerencial GD (o rateio lê o consumo total e as UCs). */
export async function planilhaGerencial(usina: string, competencia: string, linhas: LinhaGerencial[]): Promise<Buffer> {
  const X = await excel();
  const wb = new X.Workbook();
  const ws = wb.addWorksheet("Relatório Gerencial");
  ws.addRow([`Relatório Gerencial GD - Usina: ${usina} (Competência: ${mesAno(competencia)})`]);
  ws.addRow(["ID", "Instalação Nova", "Instalação Antiga", "Empresa", "Rateio (%)", "Consumo da UC (kWh)", "Energia Compensada (kWh)", "Tarifa Cativo (R$/kWh)", "Consumo Mínimo (R$)"]);
  for (const l of linhas) ws.addRow([l.id, l.nova, l.antiga, l.apelido, l.pct, l.consumoKwh, l.compensadoKwh, l.tarifa || null, l.minimoRs || null]);
  ws.addRow(["", "", "", "TOTAL", linhas.reduce((a, l) => a + l.pct, 0), linhas.reduce((a, l) => a + l.consumoKwh, 0), linhas.reduce((a, l) => a + l.compensadoKwh, 0), null, null]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Planilha no formato da tela "Unidade Rateio GD" (o rateio importa direto). */
export async function planilhaUcs(ucs: UcRateio[]): Promise<Buffer> {
  const X = await excel();
  const wb = new X.Workbook();
  const ws = wb.addWorksheet("Unidade Rateio GD");
  ws.addRow(["Nome da Usina", "ID da Unidade", "N° de Instalação", "Apelido da Unidade", "Subgrupo", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh", "Consumo Compensado kWh", "R$/kWh"]);
  for (const u of ucs) ws.addRow([u.usina, u.idUnidade, u.instalacao, u.apelido, u.subgrupo, u.pct, u.saldoKwh, u.compensavelKwh, u.compensadoKwh, u.rsKwh || null]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
