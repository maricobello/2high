/**
 * Demanda da usina (fatura da UC geradora, grupo A): contratada, registrada (medida),
 * ultrapassagem e o que foi cobrado por isso. Calibrado na fatura CELESC A4 de GD.
 */
import { norm, toNumber } from "./normalize";

export interface ItemDemanda {
  codigo: string;
  descricao: string;
  kw: number;
  valor: number;
}

export interface Demanda {
  /** Demanda contratada (de injeção, quando a fatura traz; senão a de consumo), kW. */
  contratadaKw: number | null;
  /** Demanda de consumo contratada, kW. */
  contratadaConsumoKw: number | null;
  /** Maior demanda registrada (medida) de injeção no mês, kW. */
  registradaKw: number | null;
  /** Maior demanda registrada de consumo no mês, kW. */
  registradaConsumoKw: number | null;
  /** Ultrapassagem faturada, kW. */
  ultrapassagemKw: number | null;
  /** R$ cobrados por ultrapassagem no mês. */
  despesaUltrapassagem: number | null;
  /** Todos os itens de demanda da conta (demanda, diferença, ultrapassagem). */
  itens: ItemDemanda[];
}

const kw = (s: string) => toNumber(s.replace(/kw/i, ""));

/** Lê o bloco de demandas e os itens faturados em kW. null quando a fatura não tem demanda. */
export function lerDemanda(linhas: string[]): Demanda | null {
  const d: Demanda = { contratadaKw: null, contratadaConsumoKw: null, registradaKw: null, registradaConsumoKw: null, ultrapassagemKw: null, despesaUltrapassagem: null, itens: [] };
  let achou = false;
  linhas.forEach((bruta, i) => {
    const l = bruta.replace(/\s+/g, " ").trim();
    const n = norm(l);
    // itens da conta em kW: "(65) Ultrapassagem de Demanda Injetada KW 2.219,840 9,053580 20.097,51 ..."
    // ou "Demanda [kW] - TUSD JUL/26 kW 24,9600 28,55 29,955 747,68 ..." (o valor é o que bate com qtd × tarifa)
    const it = /^(?:\((\w{2,3})\)\s+)?(.*?(?:demanda|ultrapassagem).*?)\s+\(?kw\)?\s+([\d.,]+)\s+(.*)$/i.exec(l);
    if (it && !/^demanda\s+[\d.,]+\s*kw/i.test(l)) {
      const qtd = toNumber(it[3]);
      const resto = (it[4].match(/-?[\d.]+,\d+|-?\d+/g) ?? []).map(toNumber);
      const tarifas = resto.slice(0, 2);
      const valor = resto.slice(1).find((v) => tarifas.some((t) => t > 0 && qtd > 0 && Math.abs(v - qtd * t) / (qtd * t) < 0.05));
      if (qtd > 0 && valor != null) {
        d.itens.push({ codigo: it[1] ?? "", descricao: it[2].replace(/\s*\[kw\]\s*/i, " ").trim(), kw: qtd, valor });
        achou = true;
      }
    }
    // Equatorial: "Dem. de Geração (kW): 2.500,00", "Demanda Contratada Única (kW): 30,00"
    let q = /dem(?:anda)?\.? de gera[cç][aã]o \(kw\):\s*([\d.,]+)/i.exec(l);
    if (q) {
      d.contratadaKw = kw(q[1]);
      achou = true;
    }
    q = /demanda contratada (?:[uú]nica|fora ponta)? ?\(kw\):\s*([\d.,]+)/i.exec(l);
    if (q && d.contratadaConsumoKw == null) {
      d.contratadaConsumoKw = kw(q[1]);
      achou = true;
    }
    // medição "Demanda Geração FP Reg 0 1.476 1,6800 2.479,68 kW" / "Demanda Ativa NP Reg 0 4 1,6800 6,72 kW"
    q = /demanda gera[cç][aã]o (?:fp|np|ponta|fora ponta) reg\s+[\d.]+\s+[\d.]+\s+[\d.,]+\s+([\d.,]+)\s*kw/i.exec(l);
    if (q) {
      d.registradaKw = Math.max(d.registradaKw ?? 0, kw(q[1]));
      achou = true;
    }
    q = /demanda ativa (?:fp|np|ponta|fora ponta) reg\s+[\d.]+\s+[\d.]+\s+[\d.,]+\s+([\d.,]+)\s*kw/i.exec(l);
    if (q) d.registradaConsumoKw = Math.max(d.registradaConsumoKw ?? 0, kw(q[1]));
    // contratadas no formato RGE/CPFL: "... Demanda kW 30" e "... Geração kW 1.000"
    let m = /gera[cç][aã]o\s+kw\s+([\d.,]+)\s*$/i.exec(l);
    if (m) {
      d.contratadaKw = kw(m[1]);
      achou = true;
    }
    m = /\bdemanda\s+kw\s+([\d.,]+)\s*$/i.exec(l);
    if (m) {
      d.contratadaConsumoKw = kw(m[1]);
      achou = true;
    }
    m = /demanda de inje[cç][aã]o\s+([\d.,]+)\s*kw/i.exec(l);
    if (m) {
      d.contratadaKw = kw(m[1]);
      achou = true;
    }
    m = /^demanda\s+([\d.,]+)\s*kw/i.exec(l);
    if (m) {
      d.contratadaConsumoKw = kw(m[1]);
      achou = true;
    }
    // "Medida G 0KW 3.220KW" (geração/injeção) e "Medida 13KW 13KW" (consumo): ponta e fora ponta
    m = /medida g\s+([\d.,]+)\s*kw\s+([\d.,]+)\s*kw/i.exec(l);
    if (m) {
      d.registradaKw = Math.max(kw(m[1]), kw(m[2]));
      achou = true;
    } else {
      m = /medida\s+([\d.,]+)\s*kw\s+([\d.,]+)\s*kw/i.exec(l);
      if (m) d.registradaConsumoKw = Math.max(kw(m[1]), kw(m[2]));
    }
    // medidor: "Demanda Ativa - kW Ponta 000008 000008 0,60000 5" (último número = registrado)
    m = /demanda ativa.*?(?:fora (?:de )?ponta|ponta)\s+\d+\s+\d+\s+[\d.,]+\s+([\d.,]+)\s*$/i.exec(l);
    if (m) d.registradaConsumoKw = Math.max(d.registradaConsumoKw ?? 0, kw(m[1]));
    m = /demanda (?:injetada|gera[cç][aã]o).*?(?:fora (?:de )?ponta|ponta)\s+\d+\s+\d+\s+[\d.,]+\s+([\d.,]+)\s*$/i.exec(l);
    if (m) d.registradaKw = Math.max(d.registradaKw ?? 0, kw(m[1]));
    // "Ultrapassagem" com o valor na mesma linha ou na seguinte
    if (/^ultrapassagem\b/.test(n) && !/demanda/.test(n)) {
      const aqui = /([\d.,]+)\s*kw/i.exec(l);
      const prox = /^([\d.,]+)\s*kw$/i.exec((linhas[i + 1] ?? "").trim());
      const v = aqui ? kw(aqui[1]) : prox ? kw(prox[1]) : null;
      if (v != null) d.ultrapassagemKw = v;
    }
  });
  if (!achou) return null;
  if (d.contratadaKw == null) d.contratadaKw = d.contratadaConsumoKw;
  const ultra = d.itens.filter((x) => /ultrapassagem/i.test(x.descricao));
  if (ultra.length) {
    d.despesaUltrapassagem = Math.round(ultra.reduce((a, x) => a + x.valor, 0) * 100) / 100;
    if (d.ultrapassagemKw == null) d.ultrapassagemKw = Math.max(...ultra.map((x) => x.kw));
  } else d.despesaUltrapassagem = 0;
  if (d.ultrapassagemKw == null && d.registradaKw != null && d.contratadaKw != null) d.ultrapassagemKw = Math.max(0, d.registradaKw - d.contratadaKw);
  return d;
}

/** Demanda contratada sugerida para não pagar ultrapassagem: a registrada, arredondada para cima (múltiplos de 10 kW). */
export function demandaSugerida(d: Pick<Demanda, "registradaKw">): number | null {
  return d.registradaKw != null && d.registradaKw > 0 ? Math.ceil(d.registradaKw / 10) * 10 : null;
}
