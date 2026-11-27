/**
 * Carteira: carga acima do contrato numa usina vai para outra usina da mesma distribuidora que
 * tenha espaço (contrato e geração). Regras:
 *  - sai da usina de origem só o que passa da meta de 90% do contrato E não deixa a usina com
 *    menos carga do que gera (senão a energia dela vira saldo parado);
 *  - entra na usina de destino só até o espaço dela (o menor entre contrato e geração);
 *  - mesma distribuidora (o crédito só vale na mesma área de concessão);
 *  - UCs maiores primeiro (menos movimentações), cada uma inteira numa usina só.
 */
import { vagaNovasUcs } from "./agregar";
import { cargaContrato } from "./contrato";
import { mesmaDistribuidora } from "./distribuidora";
import { injecaoMensal } from "./engine";
import type { Parametros, Usina } from "./types";

export interface Transferencia {
  instalacao: string;
  apelido: string;
  kwh: number;
  deId: string;
  de: string;
  /** null = nenhuma usina carregada da mesma distribuidora tem espaço. */
  paraId: string | null;
  para: string | null;
}

export interface ExcessoUsina {
  usinaId: string;
  usina: string;
  /** kWh/mês de carga acima da meta que pode sair sem deixar energia parada na origem. */
  excessoKwh: number;
  movido: number;
  semDestino: number;
}

export interface PlanoCarteira {
  transferencias: Transferencia[];
  excessos: ExcessoUsina[];
}

export function planoCarteira(usinas: Usina[], p: Parametros): PlanoCarteira {
  const meta = p.metaContrato;
  // espaço livre de cada usina (contrato e geração)
  const espaco = new Map<string, number>();
  for (const u of usinas) espaco.set(u.id, Math.max(0, vagaNovasUcs(u, p)?.kwh ?? 0));

  const transferencias: Transferencia[] = [];
  const excessos: ExcessoUsina[] = [];
  for (const u of usinas) {
    const c = cargaContrato(u, meta);
    if (!c.temContrato) continue;
    const E = injecaoMensal(u);
    // o que pode sair: acima da meta e sem deixar a usina com menos carga do que gera
    const piso = Math.max(c.metaKwh, E);
    const excesso = Math.max(0, c.compensavelKwh - piso);
    if (excesso <= 0) continue;
    let resto = excesso;
    let movido = 0;
    let semDestino = 0;
    const ucs = [...u.ucs].filter((x) => x.compensavelKwh > 0).sort((a, b) => b.compensavelKwh - a.compensavelKwh);
    for (const uc of ucs) {
      if (resto <= 0) break;
      if (uc.compensavelKwh > resto * 1.05) continue; // não tira mais do que o excesso
      const destinos = usinas
        .filter((d) => d.id !== u.id && (espaco.get(d.id) ?? 0) >= uc.compensavelKwh && mesmaDistribuidora({ concessionaria: u.distribuidora, apelido: uc.apelido }, d))
        .sort((a, b) => (espaco.get(b.id) ?? 0) - (espaco.get(a.id) ?? 0));
      const d = destinos[0] ?? null;
      if (d) {
        espaco.set(d.id, (espaco.get(d.id) ?? 0) - uc.compensavelKwh);
        movido += uc.compensavelKwh;
      } else semDestino += uc.compensavelKwh;
      transferencias.push({ instalacao: uc.instalacao, apelido: uc.apelido, kwh: uc.compensavelKwh, deId: u.id, de: u.nome, paraId: d?.id ?? null, para: d?.nome ?? null });
      resto -= uc.compensavelKwh;
    }
    excessos.push({ usinaId: u.id, usina: u.nome, excessoKwh: excesso, movido, semDestino });
  }
  return { transferencias, excessos };
}
