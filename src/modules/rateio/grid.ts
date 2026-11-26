/**
 * Leitura de tabelas a partir de grades (linhas × colunas de valores),
 * vindas de planilha (.xlsx/.csv) ou de texto colado do Orange.
 * Independe de biblioteca: o leitor de Excel só converte cada aba em grade.
 */
import { CONSUMO_MINIMO, norm, parseLigacao, toNumber, toPct, ucKey } from "./normalize";
import type { Candidata, ConsumoMes, UcAtual, Usina } from "./types";

export type Cell = string | number | boolean | Date | null | undefined;
export type Grid = Cell[][];

export interface Sheet {
  name: string;
  grid: Grid;
}

type FieldMap<K extends string> = Record<K, string[]>;

const UC_FIELDS: FieldMap<"usina" | "idUnidade" | "instalacao" | "apelido" | "subgrupo" | "pct" | "saldo" | "compensavel" | "compensado" | "consMin" | "ligacao"> = {
  usina: ["nome da usina", "usina", "usina gd", "unidade geradora"],
  idUnidade: ["id da unidade", "id unidade", "id"],
  instalacao: ["no de instalacao", "n de instalacao", "no da instalacao", "no instalacao", "n instalacao", "numero de instalacao", "numero da instalacao", "instalacao", "uc", "numero da uc", "unidade consumidora", "codigo da uc"],
  apelido: ["apelido da unidade", "apelido", "endereco id", "nome da unidade"],
  subgrupo: ["subgrupo", "sub grupo", "grupo tarifario"],
  pct: ["% do rateio", "% rateio", "rateio %", "rateio", "percentual", "percentual do rateio", "% atual"],
  saldo: ["saldo kwh", "saldo", "saldo de creditos", "saldo (kwh)"],
  compensavel: ["consumo compensavel kwh", "consumo compensavel", "consumo compensavel (kwh)", "compensavel kwh"],
  compensado: ["consumo compensado kwh", "consumo compensado", "compensado", "consumo compensado (kwh)"],
  // opcionais: o export padrão do Orange não traz; outras planilhas podem trazer
  consMin: ["consumo minimo", "consumo minimo kwh", "cons. min", "cons min", "custo de disponibilidade", "disponibilidade"],
  ligacao: ["tipo de ligacao", "ligacao", "fases", "tipo tensao", "tipo de tensao"],
};

const CAND_FIELDS: FieldMap<"instalacao" | "apelido" | "concessionaria" | "mes" | "status" | "ligacao" | "mercado" | "naUsinaGd" | "media" | "consMin" | "compensavel"> = {
  instalacao: ["uc", "instalacao", "no de instalacao", "no da instalacao", "no instalacao", "n instalacao", "numero de instalacao", "numero da uc", "unidade consumidora"],
  apelido: ["endereco id", "apelido", "apelido da unidade", "nome"],
  concessionaria: ["concessionaria", "distribuidora"],
  mes: ["mes referencia", "mes de referencia", "referencia"],
  status: ["status", "situacao"],
  ligacao: ["tipo tensao", "tipo de tensao", "tipo de ligacao", "ligacao", "fases"],
  mercado: ["mercado"],
  naUsinaGd: ["na usina gd", "usina gd atual", "usina gd", "ja na usina"],
  media: ["media kwh", "media", "consumo medio", "consumo medio kwh", "media de consumo"],
  consMin: ["cons. min", "cons min", "consumo minimo", "custo de disponibilidade"],
  compensavel: ["compensavel", "compensavel kwh"],
};

const CAL_FIELDS: FieldMap<"mes" | "concessionaria" | "usina" | "ucs" | "grupo" | "fornecedor" | "responsavel" | "idReplace" | "versao" | "etapasOk" | "pct" | "etapa" | "status" | "prazo" | "atraso" | "resultado" | "motivo" | "proxima"> = {
  mes: ["mes do ciclo"],
  concessionaria: ["concessionaria"],
  usina: ["usina"],
  ucs: ["ucs"],
  grupo: ["grupo"],
  fornecedor: ["fornecedor"],
  responsavel: ["responsavel"],
  idReplace: ["id solicitacao replace"],
  versao: ["versao do estudo"],
  etapasOk: ["etapas ok"],
  pct: ["% concluido"],
  etapa: ["etapa atual"],
  status: ["status"],
  prazo: ["prazo da etapa"],
  atraso: ["dias de atraso"],
  resultado: ["resultado da distribuidora"],
  motivo: ["motivo da negativa / correcao"],
  proxima: ["proxima acao / pendencia"],
};

function text(c: Cell): string {
  if (c == null) return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  return String(c).trim();
}

/** Mapeia cabeçalhos para campos: primeiro igualdade exata, depois "começa com". */
function mapHeader<K extends string>(row: Cell[], fields: FieldMap<K>): Partial<Record<K, number>> {
  const heads = row.map((c) => norm(text(c)));
  const out: Partial<Record<K, number>> = {};
  const used = new Set<number>();
  const keys = Object.keys(fields) as K[];
  for (const pass of ["exact", "prefix"] as const) {
    for (const k of keys) {
      if (out[k] != null) continue;
      for (const alias of fields[k]) {
        const idx = heads.findIndex((h, i) => !used.has(i) && h && (pass === "exact" ? h === alias : h.startsWith(alias)));
        if (idx >= 0) {
          out[k] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return out;
}

function findHeader<K extends string>(grid: Grid, fields: FieldMap<K>, required: NoInfer<K>[], maxRow = 40) {
  for (let r = 0; r < Math.min(grid.length, maxRow); r++) {
    const map = mapHeader(grid[r] ?? [], fields);
    if (required.every((k) => map[k] != null)) return { row: r, map };
  }
  return null;
}

const get = (row: Cell[], idx: number | undefined) => (idx == null ? undefined : row[idx]);

// ---------------------------------------------------------------------------
// UCs do rateio atual

/** Mínimo da UC: coluna informada; senão pela ligação (30/50/100); grupo A não tem custo de disponibilidade. */
function consumoMinimoUc(informado: number, ligacao: string, subgrupo: string): number | null {
  if (informado > 0) return informado;
  const lig = parseLigacao(ligacao);
  if (lig) return CONSUMO_MINIMO[lig];
  if (/^\s*a/i.test(subgrupo)) return 0;
  return null;
}

// ---------------------------------------------------------------------------
// Relatório Gerencial GD (Orange): uma competência, UC a UC, com o total do consumo

const REL_FIELDS: FieldMap<"id" | "nova" | "antiga" | "empresa" | "pct" | "consumo" | "compensada" | "tarifa" | "minimoRs"> = {
  id: ["id"],
  nova: ["instalacao nova"],
  antiga: ["instalacao antiga"],
  empresa: ["empresa", "apelido"],
  pct: ["rateio (%)", "rateio"],
  consumo: ["consumo da uc(kwh)", "consumo da uc (kwh)", "consumo da uc"],
  compensada: ["energia compensada (kwh)", "energia compensada"],
  tarifa: ["tarifa cativo (r$/kwh)", "tarifa cativo", "tarifa"],
  minimoRs: ["consumo minimo(r$)", "consumo minimo (r$)", "consumo minimo"],
};

export interface RelatorioGerencial {
  usina: string;
  competencia: string;
  /** Consumo total das UCs na competência (linha TOTAL). */
  consumoTotal: number;
  ucs: UcAtual[];
}

/** Lê o Relatório Gerencial GD. null se a aba não for desse formato. */
export function parseRelatorioGerencial(grid: Grid): RelatorioGerencial | null {
  const topo = norm((grid[0] ?? []).map(text).join(" "));
  const h = findHeader(grid, REL_FIELDS, ["nova", "pct", "consumo", "compensada"], 10);
  if (!h || (!/relatorio gerencial/.test(topo) && h.map.antiga == null)) return null;
  const cab = (grid[0] ?? []).map(text).join(" ");
  const usina = /Usina:\s*([^|]+?)(?:\s*\(|\s+Data do|$)/i.exec(cab)?.[1]?.trim() ?? "";
  const comp = /Compet[eê]ncia:\s*(\d{1,2})\/(\d{4})/i.exec(cab);
  const competencia = comp ? `${comp[2]}-${comp[1].padStart(2, "0")}` : "";
  const ucs: UcAtual[] = [];
  let consumoTotal = 0;
  for (let r = h.row + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const nova = text(get(row, h.map.nova));
    const consumo = toNumber(get(row, h.map.consumo));
    if (/total/i.test(text(get(row, h.map.empresa))) || (!/\d/.test(nova) && consumo > 0)) {
      consumoTotal = consumo;
      continue;
    }
    if (!/\d/.test(nova)) continue;
    const tarifa = toNumber(get(row, h.map.tarifa));
    const minRs = toNumber(get(row, h.map.minimoRs));
    // mínimo em kWh = R$ ÷ tarifa; arredonda para 30/50/100 quando bate
    let minimo: number | null = tarifa > 0 && minRs > 0 ? minRs / tarifa : null;
    if (minimo != null) minimo = [30, 50, 100].find((m) => Math.abs(m - minimo!) <= 1.5) ?? Math.round(minimo);
    const antiga = text(get(row, h.map.antiga));
    ucs.push({
      key: ucKey(nova),
      keyAlt: antiga && /\d/.test(antiga) ? ucKey(antiga) : undefined,
      usina,
      idUnidade: text(get(row, h.map.id)),
      instalacao: nova,
      apelido: text(get(row, h.map.empresa)),
      subgrupo: "",
      pctAtual: toPct(get(row, h.map.pct)),
      saldoKwh: 0,
      compensavelKwh: Math.max(0, consumo - (minimo ?? 0)),
      compensadoKwh: toNumber(get(row, h.map.compensada)),
      consumoMinimoKwh: minimo,
    });
  }
  if (!consumoTotal) consumoTotal = ucs.reduce((a, u) => a + u.compensavelKwh + (u.consumoMinimoKwh ?? 0), 0);
  return ucs.length ? { usina, competencia, consumoTotal, ucs } : null;
}

export function parseUcs(grid: Grid): UcAtual[] | null {
  const h = findHeader(grid, UC_FIELDS, ["instalacao", "pct", "compensavel"]);
  if (!h) return null;
  const out: UcAtual[] = [];
  for (let r = h.row + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const inst = text(get(row, h.map.instalacao));
    if (!inst || !/\d/.test(inst)) continue;
    out.push({
      key: ucKey(inst),
      usina: text(get(row, h.map.usina)),
      idUnidade: text(get(row, h.map.idUnidade)),
      instalacao: inst,
      apelido: text(get(row, h.map.apelido)),
      subgrupo: text(get(row, h.map.subgrupo)),
      pctAtual: toPct(get(row, h.map.pct)),
      saldoKwh: toNumber(get(row, h.map.saldo)),
      compensavelKwh: toNumber(get(row, h.map.compensavel)),
      compensadoKwh: toNumber(get(row, h.map.compensado)),
      consumoMinimoKwh: consumoMinimoUc(toNumber(get(row, h.map.consMin)), text(get(row, h.map.ligacao)), text(get(row, h.map.subgrupo))),
    });
  }
  // percentual em fração (0,0245) em vez de 2,45
  const soma = out.reduce((a, u) => a + u.pctAtual, 0);
  if (out.length && soma > 0 && soma <= 1.001) for (const u of out) u.pctAtual *= 100;
  return out;
}

// ---------------------------------------------------------------------------
// Candidatas

export function parseCandidatas(grid: Grid): Candidata[] | null {
  const h = findHeader(grid, CAND_FIELDS, ["instalacao", "media"]);
  if (!h) return null;
  const out: Candidata[] = [];
  for (let r = h.row + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const inst = text(get(row, h.map.instalacao));
    if (!inst || !/\d/.test(inst)) continue;
    const ligOrig = text(get(row, h.map.ligacao));
    const ligacao = parseLigacao(ligOrig);
    const media = toNumber(get(row, h.map.media));
    const minInformado = toNumber(get(row, h.map.consMin));
    const consumoMinimoKwh = minInformado > 0 ? minInformado : ligacao ? CONSUMO_MINIMO[ligacao] : CONSUMO_MINIMO.tri;
    out.push({
      key: ucKey(inst),
      instalacao: inst,
      apelido: text(get(row, h.map.apelido)),
      concessionaria: text(get(row, h.map.concessionaria)),
      mesReferencia: text(get(row, h.map.mes)),
      ligacao,
      ligacaoOriginal: ligOrig,
      mercado: text(get(row, h.map.mercado)),
      status: text(get(row, h.map.status)),
      mediaKwh: media,
      consumoMinimoKwh,
      compensavelKwh: Math.max(0, media - consumoMinimoKwh),
      naUsinaGd: text(get(row, h.map.naUsinaGd)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cabeçalho da planilha modelo ("Análise do Rateio")

export interface DadosUsinaPlanilha {
  nome: string;
  periodoInicio: string;
  periodoFim: string;
  meses: number;
  energiaContratadaPeriodo: number;
  energiaGeradaPeriodo: number;
  energiaInjetadaPeriodo: number;
  consumoMensal: ConsumoMes[];
  maximoCompensavel: number | null;
  demanda: { contratadaKw: number | null; registradaKw: number | null; despesaUltrapassagem: number | null } | null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dateText(c: Cell): string {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  if (typeof c === "number" && c > 20000 && c < 80000) {
    // número de série do Excel
    return new Date(Date.UTC(1899, 11, 30) + c * 86400000).toISOString().slice(0, 10);
  }
  return text(c);
}

/** Lê o cabeçalho da planilha modelo de rateio. Retorna null se a aba não for desse formato. */
export function parseDadosUsina(grid: Grid): DadosUsinaPlanilha | null {
  let found = 0;
  const d: DadosUsinaPlanilha = { nome: "", periodoInicio: "", periodoFim: "", meses: 0, energiaContratadaPeriodo: 0, energiaGeradaPeriodo: 0, energiaInjetadaPeriodo: 0, consumoMensal: [], maximoCompensavel: null, demanda: null };
  const limit = Math.min(grid.length, 30);
  const vistos = new Set<string>();
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const label = norm(text(row[c]));
      if (!label) continue;
      // primeiro número à direita do rótulo
      const num = () => {
        for (let k = c + 1; k < Math.min(row.length, c + 5); k++) {
          const v = row[k];
          if (typeof v === "number") return v;
          if (typeof v === "string" && /^[\d.,]+$/.test(v.trim())) return toNumber(v);
        }
        return 0;
      };
      // cada rótulo vale só na primeira vez (células mescladas repetem o texto)
      const once = (campo: string, fn: () => void) => {
        if (vistos.has(campo)) return;
        vistos.add(campo);
        fn();
        found++;
      };
      if (label.startsWith("periodo da analise")) {
        once("periodo", () => {
          d.periodoInicio = dateText(row[c + 2]);
          d.periodoFim = dateText(row[c + 3]);
        });
      } else if (label.startsWith("numero de meses")) {
        once("meses", () => (d.meses = num()));
      } else if (label.startsWith("energia contratada no")) {
        once("contratada", () => (d.energiaContratadaPeriodo = num()));
      } else if (label.startsWith("energia gerada no")) {
        once("gerada", () => (d.energiaGeradaPeriodo = num()));
      } else if (label.startsWith("energia injetada no")) {
        once("injetada", () => (d.energiaInjetadaPeriodo = num()));
      } else if (/^(demanda contratada|demanda registrada|despesa com ultrapassagem)/.test(label) && !vistos.has(label)) {
        vistos.add(label);
        const v = num();
        if (v > 0) {
          d.demanda ??= { contratadaKw: null, registradaKw: null, despesaUltrapassagem: null };
          if (label.startsWith("demanda contratada")) d.demanda.contratadaKw = v;
          else if (label.startsWith("demanda registrada")) d.demanda.registradaKw = v;
          else d.demanda.despesaUltrapassagem = v;
        }
      } else if (label.startsWith("maximo compensavel") && !vistos.has("maximo")) {
        vistos.add("maximo");
        const v = num();
        if (v > 0) d.maximoCompensavel = v > 1 ? v / 100 : v;
      } else if (MESES.includes(label) && typeof row[c + 1] === "number" && !vistos.has(`mes${r}`)) {
        vistos.add(`mes${r}`);
        d.consumoMensal.push({ mes: label.toUpperCase(), kwh: row[c + 1] as number });
      }
    }
    // título: primeira célula de texto longo das linhas 2-4 que não é rótulo
    if (!d.nome && r >= 1 && r <= 4) {
      const t = text(row[0]);
      if (t && !/^(analise|periodo|numero|energia)/i.test(norm(t)) && t.length > 6) d.nome = t;
    }
  }
  // modelo em branco: rótulos sem valores não viram usina
  if (found < 3 || !(d.meses > 0 || d.energiaInjetadaPeriodo > 0 || d.energiaGeradaPeriodo > 0 || d.energiaContratadaPeriodo > 0)) return null;
  d.consumoMensal.reverse(); // a planilha lista do mês mais recente para o mais antigo
  return d;
}

/** Nome curto da usina: "#299 - TIM CAMERGE CELESC CGH BOTELHO" -> "CGH BOTELHO". */
export function nomeCurtoUsina(nome: string): string {
  const s = nome.replace(/^#\d+\s*-\s*/, "").replace(/\(.*\)/, "").trim();
  const m = /(UFV|CGH|PCH|EOL|UTE|UFV\.)\s+.+$/i.exec(s);
  return (m ? m[0] : s).trim();
}

// ---------------------------------------------------------------------------
// Calendário de rateio (TIM)

export interface ItemCalendario {
  id: string;
  mesCiclo: string;
  concessionaria: string;
  usina: string;
  ucs: number;
  grupo: number;
  fornecedor: string;
  responsavel: string;
  idReplace: string;
  versao: string;
  etapasOk: number;
  pctConcluido: number;
  etapaAtual: string;
  status: string;
  prazo: string;
  diasAtraso: number;
  resultado: string;
  motivo: string;
  proximaAcao: string;
}

export function parseCalendario(grid: Grid): ItemCalendario[] | null {
  const h = findHeader(grid, CAL_FIELDS, ["usina", "concessionaria", "etapa"]);
  if (!h) return null;
  const out: ItemCalendario[] = [];
  for (let r = h.row + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const usina = text(get(row, h.map.usina));
    if (!usina) continue;
    out.push({
      id: `${r}`,
      mesCiclo: dateText(get(row, h.map.mes)),
      concessionaria: text(get(row, h.map.concessionaria)),
      usina,
      ucs: toNumber(get(row, h.map.ucs)),
      grupo: toNumber(get(row, h.map.grupo)),
      fornecedor: text(get(row, h.map.fornecedor)),
      responsavel: text(get(row, h.map.responsavel)),
      idReplace: text(get(row, h.map.idReplace)),
      versao: text(get(row, h.map.versao)),
      etapasOk: toNumber(get(row, h.map.etapasOk)),
      pctConcluido: toNumber(get(row, h.map.pct)),
      etapaAtual: text(get(row, h.map.etapa)),
      status: text(get(row, h.map.status)),
      prazo: dateText(get(row, h.map.prazo)),
      diasAtraso: toNumber(get(row, h.map.atraso)),
      resultado: text(get(row, h.map.resultado)),
      motivo: text(get(row, h.map.motivo)),
      proximaAcao: text(get(row, h.map.proxima)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Importação de um arquivo inteiro

export interface Importacao {
  usinas: Usina[];
  candidatas: Candidata[];
  calendario: ItemCalendario[];
  maximoCompensavel: number | null;
  avisos: string[];
}

let seq = 0;
export function novoId(): string {
  seq++;
  return `u${Date.now().toString(36)}${seq}`;
}

export function usinaVazia(nome = "Nova usina"): Usina {
  return {
    id: novoId(),
    nome,
    distribuidora: "",
    fornecedor: "",
    ucsCalendario: null,
    periodoInicio: "",
    periodoFim: "",
    meses: 0,
    energiaContratadaPeriodo: 0,
    energiaGeradaPeriodo: 0,
    energiaInjetadaPeriodo: 0,
    injecaoMensalProjetada: null,
    perfilSazonal: [],
    consumoMensal: [],
    ucs: [],
  };
}

/** Classifica cada aba e monta usinas, candidatas e calendário. */
export function importarSheets(sheets: Sheet[]): Importacao {
  const imp: Importacao = { usinas: [], candidatas: [], calendario: [], maximoCompensavel: null, avisos: [] };
  for (const { name, grid } of sheets) {
    const cal = parseCalendario(grid);
    if (cal && cal.length) {
      imp.calendario.push(...cal);
      imp.avisos.push(`"${name}": calendário com ${cal.length} usinas`);
      continue;
    }
    // Relatório Gerencial GD: cria/completa a usina com as UCs da competência e o consumo total
    const rel = parseRelatorioGerencial(grid);
    if (rel) {
      const u = usinaVazia(nomeCurtoUsina(rel.usina || name));
      u.ucs = rel.ucs;
      u.fonteUcs = "relatorio";
      if (rel.competencia) u.consumoMensal = [{ mes: rel.competencia, kwh: rel.consumoTotal }];
      const dist = /\b(CELESC|CEMIG|COPEL|CPFL[\w ]*|ENEL[\w ]*|EDP[\w ]*|LIGHT|EQUATORIAL[\w ]*?|ENERGISA[\w ]*|NEOENERGIA[\w ]*|RGE)\b/i.exec(rel.usina);
      if (dist) u.distribuidora = dist[1].toUpperCase().replace(/\s+(AL|UFV.*)$/, "").trim();
      imp.usinas.push(u);
      imp.avisos.push(
        `"${name}": Relatório Gerencial GD ${rel.competencia ? `${rel.competencia.slice(5)}/${rel.competencia.slice(0, 4)} ` : ""}da ${u.nome}: ${rel.ucs.length} UCs, consumo da competência ${Math.round(rel.consumoTotal).toLocaleString("pt-BR")} kWh (vai para Energia consumida). O relatório não traz saldo: importe também a lista Unidade Rateio GD para os saldos.`,
      );
      continue;
    }
    const ucs = parseUcs(grid);
    if (ucs && ucs.length) {
      const dados = parseDadosUsina(grid);
      if (dados?.maximoCompensavel) imp.maximoCompensavel = dados.maximoCompensavel;
      // separa por usina quando o export traz mais de uma
      const grupos = new Map<string, UcAtual[]>();
      const titulo = nomeNoTitulo(grid);
      for (const uc of ucs) {
        const k = uc.usina || dados?.nome || titulo || name;
        grupos.set(k, [...(grupos.get(k) ?? []), uc]);
      }
      for (const [nomeUsina, lista] of grupos) {
        // percentual em fração (0,0245) em vez de 2,45, conferido por usina
        const somaPct = lista.reduce((a, uc) => a + uc.pctAtual, 0);
        if (grupos.size > 1 && somaPct > 0 && somaPct <= 1.001) for (const uc of lista) uc.pctAtual *= 100;
        const u = usinaVazia(nomeCurtoUsina(nomeUsina));
        u.ucs = lista;
        if (dados && grupos.size === 1) {
          Object.assign(u, {
            periodoInicio: dados.periodoInicio,
            periodoFim: dados.periodoFim,
            meses: dados.meses,
            energiaContratadaPeriodo: dados.energiaContratadaPeriodo,
            energiaGeradaPeriodo: dados.energiaGeradaPeriodo,
            energiaInjetadaPeriodo: dados.energiaInjetadaPeriodo,
            consumoMensal: dados.consumoMensal,
            maximoCompensavelPlanilha: dados.maximoCompensavel,
            demanda: dados.demanda
              ? { ...dados.demanda, ultrapassagemKw: dados.demanda.registradaKw != null && dados.demanda.contratadaKw != null ? Math.max(0, dados.demanda.registradaKw - dados.demanda.contratadaKw) : null, fonte: "planilha" as const }
              : null,
          });
          if (/celesc/i.test(nomeUsina + dados.nome)) u.distribuidora = "CELESC";
        }
        const dist = /\b(CELESC|CEMIG|COPEL|CPFL[\w ]*|ENEL[\w ]*|EDP[\w ]*|LIGHT|EQUATORIAL[\w ]*|ENERGISA[\w ]*|NEOENERGIA[\w ]*)\b/i.exec(nomeUsina);
        if (!u.distribuidora && dist) u.distribuidora = dist[1].toUpperCase().trim();
        imp.usinas.push(u);
        imp.avisos.push(`"${name}": ${lista.length} UCs da ${u.nome}${dados && grupos.size === 1 ? " com dados da usina" : ""}`);
      }
      continue;
    }
    const cand = parseCandidatas(grid);
    if (cand && cand.length) {
      imp.candidatas.push(...cand);
      imp.avisos.push(`"${name}": ${cand.length} UCs candidatas`);
      continue;
    }
    if (cand) {
      imp.avisos.push(`"${name}": lista de novas UCs vazia`);
      continue;
    }
    const dados = parseDadosUsina(grid);
    if (dados) {
      const u = usinaVazia(nomeCurtoUsina(dados.nome || name));
      Object.assign(u, dados);
      imp.usinas.push(u);
      imp.avisos.push(`"${name}": dados da usina, sem lista de UCs`);
      continue;
    }
    if (grid.some((r) => r.some((c) => text(c)))) imp.avisos.push(`"${name}": formato não reconhecido, ignorada`);
  }
  imp.usinas = juntarRepetidas(imp.usinas, imp.avisos);
  return imp;
}

/** Nome da usina num título da aba (ex.: "Rateio Otimizado GD — UFV Safira (#399 …)" → "UFV SAFIRA"). */
function nomeNoTitulo(grid: Grid): string {
  for (let r = 0; r < Math.min(6, grid.length); r++)
    for (const c of grid[r] ?? []) {
      const m = /\b(UFV|CGH|PCH|EOL|UTE)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .'-]*?)(?=\s*[(\-—–,|]|$)/i.exec(text(c));
      if (m) return `${m[1].toUpperCase()} ${m[2].trim().toUpperCase()}`;
    }
  return "";
}

/**
 * A mesma usina pode vir em mais de uma aba ou arquivo (ex.: aba de análise e aba de
 * cálculo com as mesmas UCs). Junta usinas com o mesmo nome ou com 80%+ das UCs em comum,
 * ficando com a versão mais completa (dados da usina e mais UCs).
 */
function juntarRepetidas(usinas: Usina[], avisos: string[]): Usina[] {
  const out: Usina[] = [];
  const completude = (u: Usina) => (u.meses > 0 ? 1e6 : 0) + u.ucs.length;
  for (const u of usinas) {
    const chaves = new Set(u.ucs.map((c) => c.key));
    const igual = out.find((o) => {
      if (norm(o.nome) === norm(u.nome)) return true;
      if (!o.ucs.length || !u.ucs.length) return false;
      const comuns = o.ucs.filter((c) => chaves.has(c.key)).length;
      return comuns / Math.min(o.ucs.length, u.ucs.length) >= 0.8;
    });
    if (!igual) {
      out.push(u);
      continue;
    }
    const [melhor, outra] = completude(u) > completude(igual) ? [u, igual] : [igual, u];
    // nome mais informativo: o que parece nome de usina (UFV/CGH…), senão o da versão mais completa
    const nome = [melhor.nome, outra.nome].find((n) => /^(UFV|CGH|PCH|EOL|UTE)\s/i.test(n)) ?? melhor.nome;
    const junta: Usina = {
      ...melhor,
      id: igual.id,
      nome,
      ucs: melhor.ucs.length ? melhor.ucs : outra.ucs,
      distribuidora: melhor.distribuidora || outra.distribuidora,
      ...(melhor.meses > 0 ? {} : outra.meses > 0 ? { periodoInicio: outra.periodoInicio, periodoFim: outra.periodoFim, meses: outra.meses, energiaContratadaPeriodo: outra.energiaContratadaPeriodo, energiaGeradaPeriodo: outra.energiaGeradaPeriodo, energiaInjetadaPeriodo: outra.energiaInjetadaPeriodo, consumoMensal: outra.consumoMensal } : {}),
    };
    out[out.indexOf(igual)] = junta;
    const aviso = norm(outra.nome) === norm(melhor.nome) ? `${nome} veio em mais de uma aba ou arquivo: considerada uma usina só (${junta.ucs.length} UCs)` : `${outra.nome} e ${melhor.nome} têm as mesmas UCs: consideradas uma usina só, ${nome}`;
    if (!avisos.includes(aviso)) avisos.push(aviso);
  }
  return out;
}

/** Converte texto colado (tabulação, ponto e vírgula ou vírgula) em grade. */
export function textoParaGrid(txt: string): Grid {
  const linhas = txt.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = linhas[0].includes("\t") ? "\t" : linhas[0].includes(";") ? ";" : ",";
  const dividir = (l: string) => {
    const out: string[] = [];
    let campo = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) {
        out.push(campo.trim());
        campo = "";
      } else campo += ch;
    }
    out.push(campo.trim());
    return out;
  };
  return linhas.map(dividir);
}
