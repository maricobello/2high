/**
 * Espaço para agregar novas UCs: a energia que a usina tem no horizonte (injeção + saldo
 * acima da reserva, gasto ao longo do período) contra o que as UCs atuais conseguem
 * consumir. Sobra = consumo compensável que dá para agregar sem tirar crédito de ninguém.
 */
import { cargaContrato, type CargaContrato } from "./contrato";
import { injecaoMensal } from "./engine";
import type { Candidata, Parametros, Usina } from "./types";

export interface EspacoNovasUcs {
  nivel: "sim" | "pouco" | "nao" | "sem-dados";
  /** kWh/mês de consumo compensável que dá para agregar (negativo = falta energia). */
  folgaKwh: number;
  injecaoKwh: number;
  consumoAtualKwh: number;
  saldoUsavelKwh: number;
  /** UCs do tamanho médio (das candidatas, ou das UCs atuais) que cabem. */
  ucsQueCabem: number;
  tamanhoMedioKwh: number;
  texto: string;
}

export function espacoNovasUcs(u: Usina, p: Parametros, candidatas: Candidata[] = []): EspacoNovasUcs {
  const E = injecaoMensal(u);
  const ucs = u.ucs.filter((c) => c.compensavelKwh > 0);
  const consumo = ucs.reduce((a, c) => a + c.compensavelKwh, 0);
  const T = Math.max(1, p.mesesSimulacao);
  // saldo acima da reserva de cada UC, que ela mesma gasta ao longo do horizonte
  const saldoUsavel = u.ucs.reduce((a, c) => a + Math.min(Math.max(0, c.saldoKwh - p.reservaSaldoMeses * Math.max(0, c.compensavelKwh)), Math.max(0, c.compensavelKwh) * T), 0) / T;
  const vazio = { injecaoKwh: E, consumoAtualKwh: consumo, saldoUsavelKwh: saldoUsavel, ucsQueCabem: 0, tamanhoMedioKwh: 0 };
  if (!(E > 0) || !ucs.length) return { nivel: "sem-dados", folgaKwh: 0, texto: "Falta a injeção ou as UCs para avaliar.", ...vazio };
  // o saldo cobre parte do consumo das próprias UCs: libera injeção para outras
  const folga = E - Math.max(0, consumo - saldoUsavel);
  const cands = candidatas.filter((c) => c.compensavelKwh > 0);
  const base = cands.length ? cands : ucs;
  const tamanho = base.reduce((a, c) => a + c.compensavelKwh, 0) / base.length;
  const cabem = folga > 0 && tamanho > 0 ? Math.floor(folga / tamanho) : 0;
  const n = (v: number) => Math.round(v).toLocaleString("pt-BR");
  const pctFolga = folga / E;
  const nivel: EspacoNovasUcs["nivel"] = pctFolga > 0.05 ? "sim" : folga > 0 ? "pouco" : "nao";
  const texto =
    nivel === "nao"
      ? `Sem espaço: as UCs atuais consomem ${n(-folga)} kWh/mês a mais do que a usina tem (injeção + saldo). Agregar UCs só dividiria o crédito.`
      : `Cabem cerca de ${n(folga)} kWh/mês de consumo compensável${cabem ? ` (≈ ${cabem} UC${cabem > 1 ? "s" : ""} de ${n(tamanho)} kWh/mês)` : ""} sem tirar crédito das UCs atuais.${nivel === "pouco" ? " Folga pequena: só UCs pequenas." : ""}`;
  return { nivel, folgaKwh: folga, injecaoKwh: E, consumoAtualKwh: consumo, saldoUsavelKwh: saldoUsavel, ucsQueCabem: cabem, tamanhoMedioKwh: tamanho, texto };
}

export interface VagaNovasUcs {
  /** kWh/mês de compensável que dá para agregar (0 = não agregar). */
  kwh: number;
  limitadoPor: "contrato" | "geracao";
  ucsQueCabem: number;
  tamanhoMedioKwh: number;
  contrato: CargaContrato;
  geracao: EspacoNovasUcs;
  texto: string;
}

/**
 * Quanto agregar: o menor entre o espaço do contrato (meta de 90% da contratada) e a folga da
 * geração (injeção + saldo usável − consumo). Não põe carga além do contrato nem numa usina
 * que não gera energia para ela.
 */
export function vagaNovasUcs(u: Usina, p: Parametros, candidatas: Candidata[] = []): VagaNovasUcs | null {
  const geracao = espacoNovasUcs(u, p, candidatas);
  if (geracao.nivel === "sem-dados") return null;
  const contrato = cargaContrato(u, p.metaContrato);
  const folgaGer = Math.max(0, geracao.folgaKwh);
  const porContrato = contrato.temContrato && contrato.espacoKwh <= folgaGer;
  const kwh = contrato.temContrato ? Math.min(contrato.espacoKwh, folgaGer) : folgaGer;
  const tam = geracao.tamanhoMedioKwh;
  const cabem = kwh > 0 && tam > 0 ? Math.floor(kwh / tam) : 0;
  const n = (v: number) => Math.round(v).toLocaleString("pt-BR");
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  let texto: string;
  if (!contrato.temContrato) texto = kwh > 0 ? `${geracao.texto} Sem energia contratada informada: a conta usa só a geração.` : geracao.texto;
  else if (kwh <= 0)
    texto = porContrato
      ? `A carga das UCs (${n(contrato.consumidaKwh)} kWh/mês) já está em ${pct(contrato.cargaSobreContrato ?? 0)} do contrato. A meta é ${pct(contrato.meta)}: não agregar.`
      : `O contrato ainda comporta carga, mas a usina não gera energia para ela: não agregar.`;
  else
    texto = `Cabem ${n(kwh)} kWh/mês${cabem ? ` (≈ ${cabem} UC${cabem > 1 ? "s" : ""} de ${n(tam)} kWh)` : ""}. ${
      porContrato ? `Limite do contrato: meta de ${pct(contrato.meta)} de ${n(contrato.contratadaMes)} kWh/mês.` : "Limite da geração: a usina não gera para a meta inteira do contrato."
    }`;
  return { kwh, limitadoPor: porContrato ? "contrato" : "geracao", ucsQueCabem: cabem, tamanhoMedioKwh: tam, contrato, geracao, texto };
}
