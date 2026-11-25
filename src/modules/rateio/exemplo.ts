/** Dados FICTÍCIOS para demonstrar a ferramenta sem expor dados de cliente. */
import { usinaVazia, type ItemCalendario } from "./grid";
import { CONSUMO_MINIMO } from "./normalize";
import type { Candidata, Ligacao, UcAtual, Usina } from "./types";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function instalacao(rand: () => number): string {
  const d = Array.from({ length: 12 }, () => Math.floor(rand() * 10)).join("");
  return `${d.slice(0, 1)}.${d.slice(1, 4)}.${d.slice(4, 7)}.${d.slice(7, 10)}-${d.slice(10)}`;
}

function usinaExemplo(nome: string, seed: number, n: number, injecao: number): Usina {
  const rand = prng(seed);
  const ucs: UcAtual[] = [];
  const pesos: number[] = [];
  for (let i = 0; i < n; i++) {
    const comp = Math.round(300 + rand() ** 2.2 * 7000);
    // rateio antigo, desalinhado do consumo
    const w = comp * (0.6 + rand() * 0.9);
    pesos.push(w);
    const saldoMeses = rand() < 0.08 ? 14 + rand() * 40 : rand() * 4;
    const inst = instalacao(rand);
    ucs.push({ key: inst.replace(/\D/g, "").replace(/^0+/, ""), usina: nome, idUnidade: String(90000 + seed * 10 + i), instalacao: inst, apelido: `EXEMPLO_${String(i + 1).padStart(4, "0")}`, subgrupo: "B3", pctAtual: 0, saldoKwh: Math.round(comp * saldoMeses), compensavelKwh: comp, compensadoKwh: Math.round(comp * (0.8 + rand() * 0.15)) });
  }
  const soma = pesos.reduce((a, b) => a + b, 0);
  let acc = 0;
  ucs.forEach((u, i) => {
    u.pctAtual = i === n - 1 ? Math.round((100 - acc) * 100) / 100 : Math.round((pesos[i] / soma) * 10000) / 100;
    acc += u.pctAtual;
  });
  return {
    ...usinaVazia(nome),
    distribuidora: "CELESC",
    fornecedor: "FORNECEDOR EXEMPLO",
    periodoInicio: "2026-01-01",
    periodoFim: "2026-09-01",
    meses: 9,
    energiaContratadaPeriodo: Math.round(injecao * 9 * 1.04),
    energiaGeradaPeriodo: Math.round(injecao * 9 * 1.02),
    energiaInjetadaPeriodo: Math.round(injecao * 9),
    ucs,
  };
}

export function exemplo(): { usinas: Usina[]; candidatas: Candidata[]; calendario: ItemCalendario[] } {
  const a = usinaExemplo("UFV EXEMPLO NORTE", 7, 120, 255000);
  const b = usinaExemplo("UFV EXEMPLO SUL", 11, 90, 200000);
  const rand = prng(99);
  const ligs: Ligacao[] = ["mono", "bi", "tri"];
  const candidatas: Candidata[] = Array.from({ length: 70 }, (_, i) => {
    const lig = ligs[Math.floor(rand() * 3)];
    const media = Math.round(60 + rand() ** 2 * 6000);
    const inst = instalacao(rand);
    const provisorio = rand() < 0.1;
    return {
      key: inst.replace(/\D/g, "").replace(/^0+/, ""),
      instalacao: inst,
      apelido: provisorio ? "PROVISORIO" : `EXEMPLO_N${String(i + 1).padStart(3, "0")}`,
      concessionaria: "CELESC",
      mesReferencia: "09/2026",
      ligacao: lig,
      ligacaoOriginal: lig === "mono" ? "MONOFÁSICO" : lig === "bi" ? "BIFÁSICO" : "TRIFÁSICO",
      mercado: "Cativo",
      status: "",
      mediaKwh: media,
      consumoMinimoKwh: CONSUMO_MINIMO[lig],
      compensavelKwh: Math.max(0, media - CONSUMO_MINIMO[lig]),
      naUsinaGd: "",
    };
  });
  const item = (u: Usina, id: string): ItemCalendario => ({
    id,
    mesCiclo: "2026-11-01",
    concessionaria: "CELESC",
    usina: u.nome,
    ucs: u.ucs.length,
    grupo: 3,
    fornecedor: u.fornecedor,
    responsavel: "Responsável",
    idReplace: "202611-CELESC",
    versao: "V1",
    etapasOk: 0,
    pctConcluido: 0,
    etapaAtual: "Solicitação à Replace",
    status: "⬜ A solicitar à Replace",
    prazo: "2026-11-30",
    diasAtraso: 0,
    resultado: "",
    motivo: "",
    proximaAcao: "",
  });
  a.ucsCalendario = a.ucs.length;
  b.ucsCalendario = b.ucs.length;
  return { usinas: [a, b], candidatas, calendario: [item(a, "ex1"), item(b, "ex2")] };
}
