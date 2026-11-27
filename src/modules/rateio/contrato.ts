/**
 * Carga da usina pelo contrato: as UCs devem consumir até a meta (90% da energia contratada).
 * A TIM não aloca carga além disso só porque a usina gera pouco: performance baixa é do
 * fornecedor, não motivo para pôr mais UCs. Mesma conta da planilha modelo (D12,
 * "Quantidade Ideal de Consumo a ser agregado"):
 *   se 90% × contratada > consumida → agregar = 90% × contratada − compensável + 10% × saldo
 */
import { estimativaConsumo, resumoConsumo } from "./consumo";
import type { Usina } from "./types";

export const META_CONTRATO_PADRAO = 0.9;

export interface CargaContrato {
  /** Há energia contratada e meses do período para fazer a conta. */
  temContrato: boolean;
  /** Energia contratada por mês (Estimada do Orange ÷ meses). */
  contratadaMes: number;
  /** Meta de carga: fração da contratada (padrão 90%). */
  meta: number;
  metaKwh: number;
  /** Consumo médio das UCs (Relatório Gerencial; sem ele, estimado pela lista de UCs). */
  consumidaKwh: number;
  consumoEstimado: boolean;
  /** Consumo compensável das UCs atuais por mês. */
  compensavelKwh: number;
  saldoKwh: number;
  /** kWh/mês de consumo compensável que o contrato ainda comporta (0 = não agregar). */
  espacoKwh: number;
  /** Consumida ÷ contratada. */
  cargaSobreContrato: number | null;
}

export function cargaContrato(u: Usina, meta = META_CONTRATO_PADRAO): CargaContrato {
  const contratadaMes = u.meses > 0 && u.energiaContratadaPeriodo > 0 ? u.energiaContratadaPeriodo / u.meses : 0;
  const res = resumoConsumo(u);
  const consumoEstimado = res.informados === 0;
  const consumidaKwh = consumoEstimado ? estimativaConsumo(u) : res.media;
  const compensavelKwh = u.ucs.reduce((a, c) => a + Math.max(0, c.compensavelKwh), 0);
  const saldoKwh = u.ucs.reduce((a, c) => a + Math.max(0, c.saldoKwh), 0);
  const metaKwh = meta * contratadaMes;
  const espacoKwh = contratadaMes > 0 && metaKwh - consumidaKwh > 0 ? Math.max(0, metaKwh - compensavelKwh + 0.1 * saldoKwh) : 0;
  return {
    temContrato: contratadaMes > 0,
    contratadaMes,
    meta,
    metaKwh,
    consumidaKwh,
    consumoEstimado,
    compensavelKwh,
    saldoKwh,
    espacoKwh,
    cargaSobreContrato: contratadaMes > 0 ? consumidaKwh / contratadaMes : null,
  };
}

/** Limite de compensável de novas UCs na usina; null quando não há contrato (vale só a injeção). */
export function limiteNovasPeloContrato(u: Usina, meta = META_CONTRATO_PADRAO): number | null {
  const c = cargaContrato(u, meta);
  return c.temContrato ? c.espacoKwh : null;
}
