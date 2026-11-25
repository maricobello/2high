/**
 * Resumo da análise para o parecer técnico. Só números agregados e apelidos de UC:
 * nenhum número de instalação ou endereço sai do navegador.
 */
import { z } from "zod";
import type { Parametros, ResultadoUsina, Usina } from "./types";

export const resumoParecerSchema = z.object({
  usina: z.string().max(120),
  distribuidora: z.string().max(80),
  fornecedor: z.string().max(80),
  cobertura_alvo_pct: z.number(),
  horizonte_saldo_meses: z.number(),
  meses_projecao: z.number(),
  injecao_mensal_kwh: z.number(),
  compensavel_mensal_kwh: z.number(),
  saldo_hoje_kwh: z.number(),
  saldo_fim_rateio_atual_kwh: z.number(),
  saldo_fim_rateio_proposto_kwh: z.number(),
  consumo_sem_credito_atual_kwh: z.number(),
  consumo_sem_credito_proposto_kwh: z.number(),
  ucs_atuais: z.number(),
  ucs_propostas: z.number(),
  ucs_incluidas: z.number(),
  ucs_retiradas: z.number(),
  compensavel_agregado_kwh: z.number(),
  maiores_mudancas: z.array(z.object({ apelido: z.string().max(40), pct_atual: z.number(), pct_proposto: z.number(), acao: z.string().max(12) })).max(10),
  alertas: z.array(z.string().max(200)).max(12),
});
export type ResumoParecer = z.infer<typeof resumoParecerSchema>;

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function montarResumo(u: Usina, r: ResultadoUsina, p: Parametros): ResumoParecer {
  const mudancas = [...r.linhas]
    .filter((l) => l.acao !== "manter")
    .sort((a, b) => Math.abs(b.pctProposto - b.pctAtual) - Math.abs(a.pctProposto - a.pctAtual))
    .slice(0, 8)
    .map((l) => ({ apelido: (l.apelido || "UC").slice(0, 40), pct_atual: r2(l.pctAtual), pct_proposto: r2(l.pctProposto), acao: l.acao }));
  return {
    usina: r.usinaNome,
    distribuidora: u.distribuidora,
    fornecedor: u.fornecedor,
    cobertura_alvo_pct: r0(p.cobertura * 100),
    horizonte_saldo_meses: p.horizonteSaldoMeses,
    meses_projecao: p.mesesSimulacao,
    injecao_mensal_kwh: r0(r.indicadores.injecaoMensal),
    compensavel_mensal_kwh: r0(r.indicadores.compensavelTotal),
    saldo_hoje_kwh: r0(r.atual.saldoInicial),
    saldo_fim_rateio_atual_kwh: r0(r.atual.saldoFinal),
    saldo_fim_rateio_proposto_kwh: r0(r.proposto.saldoFinal),
    consumo_sem_credito_atual_kwh: r0(r.atual.consumoDescobertoTotal),
    consumo_sem_credito_proposto_kwh: r0(r.proposto.consumoDescobertoTotal),
    ucs_atuais: r.indicadores.ucsAtuais,
    ucs_propostas: r.indicadores.ucsPropostas,
    ucs_incluidas: r.indicadores.incluidas,
    ucs_retiradas: r.indicadores.retiradas,
    compensavel_agregado_kwh: r0(r.indicadores.compensavelAgregado),
    maiores_mudancas: mudancas,
    alertas: r.alertas.slice(0, 12).map((a) => a.titulo.slice(0, 200)),
  };
}

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/** Parecer padrão, sem IA. Também é o texto de reserva quando a IA falha. */
export function parecerPadrao(s: ResumoParecer): string {
  const partes: string[] = [];
  partes.push(
    `Estudo de revisão do rateio da ${s.usina}${s.distribuidora ? ` (${s.distribuidora}${s.fornecedor ? `, ${s.fornecedor}` : ""})` : ""}. A usina injeta em média ${n(s.injecao_mensal_kwh)} kWh/mês, para ${n(s.compensavel_mensal_kwh)} kWh/mês de consumo compensável nas ${s.ucs_atuais} UCs atuais, que somam ${n(s.saldo_hoje_kwh)} kWh de saldo.`,
  );
  const variacaoAtual = s.saldo_fim_rateio_atual_kwh - s.saldo_hoje_kwh;
  partes.push(
    `Mantido o rateio atual, a projeção de ${s.meses_projecao} meses indica saldo de ${n(s.saldo_fim_rateio_atual_kwh)} kWh (${variacaoAtual >= 0 ? "alta" : "queda"} de ${n(Math.abs(variacaoAtual))} kWh) e ${n(s.consumo_sem_credito_atual_kwh)} kWh de consumo sem crédito.`,
  );
  partes.push(
    `O rateio proposto distribui a injeção pela necessidade de cada UC: até ${s.cobertura_alvo_pct}% do consumo compensável, descontando o uso do saldo acima da reserva em ${s.horizonte_saldo_meses} meses. Com ele, a estimativa é de saldo de ${n(s.saldo_fim_rateio_proposto_kwh)} kWh e ${n(s.consumo_sem_credito_proposto_kwh)} kWh de consumo sem crédito no mesmo período.`,
  );
  const mov: string[] = [];
  if (s.ucs_incluidas) mov.push(`inclusão de ${s.ucs_incluidas} UCs (${n(s.compensavel_agregado_kwh)} kWh/mês de compensável)`);
  if (s.ucs_retiradas) mov.push(`retirada de ${s.ucs_retiradas} UCs com saldo suficiente`);
  if (mov.length) partes.push(`A proposta prevê ${mov.join(" e ")}, passando de ${s.ucs_atuais} para ${s.ucs_propostas} UCs.`);
  if (s.alertas.length) partes.push(`Pontos de atenção: ${s.alertas.slice(0, 4).join("; ")}.`);
  partes.push("Valores estimados a partir das médias informadas, sujeitos à validação na fatura após a aplicação pela distribuidora.");
  return partes.join("\n\n");
}
