import { formatBRL } from "@/lib/utils";
import { SOLUTION_LABELS, type SolutionCode } from "@/modules/leads/types";
import type { AuditResult } from "@/modules/rules-engine/types";

/**
 * Textos padrão (determinísticos). São usados quando a IA está indisponível
 * ou quando o texto gerado pela IA é reprovado pelas guardas.
 */

export function templateExecutiveSummary(audit: AuditResult, company: string | null): string {
  const m = audit.metrics;
  const who = company ? `da ${company}` : "da sua empresa";
  const parts: string[] = [];
  parts.push(
    audit.basedOnInvoice
      ? `Analisamos a fatura ${who}${m.distributor ? ` (${m.distributor})` : ""}${m.totalAmount ? `, no valor de ${formatBRL(m.totalAmount)}` : ""}.`
      : `Fizemos uma análise preliminar ${who} com base nas informações do formulário${m.totalAmount ? ` (conta média de referência ${formatBRL(m.totalAmount, { cents: false })})` : ""}.`,
  );
  const { attention, analysis, opportunity } = audit.counts;
  if (attention + analysis + opportunity === 0) {
    parts.push("Não identificamos pontos de atenção relevantes com os dados disponíveis. Uma análise com mais meses de histórico pode trazer outras conclusões.");
  } else {
    const bits: string[] = [];
    if (attention) bits.push(`${attention} ${attention === 1 ? "ponto de atenção" : "pontos de atenção"}`);
    if (analysis) bits.push(`${analysis} ${analysis === 1 ? "análise recomendada" : "análises recomendadas"}`);
    if (opportunity) bits.push(`${opportunity} ${opportunity === 1 ? "oportunidade identificada" : "oportunidades identificadas"}`);
    parts.push(`O diagnóstico preliminar encontrou ${joinPt(bits)}.`);
  }
  if (audit.solutions.length) {
    parts.push(`Soluções que podem fazer sentido: ${joinPt(audit.solutions.map((s) => SOLUTION_LABELS[s]))}.`);
  }
  parts.push("Todos os resultados são estimativas preliminares, sujeitas à validação técnica.");
  return parts.join(" ");
}

export interface FollowUpContext {
  name: string;
  company: string | null;
  protocol: string;
  diagnosticUrl: string;
  solutions: SolutionCode[];
  temperature: string | null;
}

export const FOLLOW_UP_STEPS = [
  { step: 1, delayHours: 2, goal: "Lembrar que o diagnóstico preliminar está disponível e oferecer conversa com especialista." },
  { step: 2, delayHours: 24, goal: "Explicar brevemente como funciona a validação técnica e o próximo passo, sem pressão." },
  { step: 3, delayHours: 72, goal: "Trazer um benefício da solução recomendada e convidar para uma conversa de 15 minutos." },
  { step: 4, delayHours: 168, goal: "Última mensagem cordial, deixando o canal aberto e informando como parar de receber mensagens." },
] as const;

export function templateFollowUp(step: number, ctx: FollowUpContext): string {
  const first = ctx.name.split(" ")[0];
  const sol = ctx.solutions[0] ? SOLUTION_LABELS[ctx.solutions[0]] : null;
  switch (step) {
    case 1:
      return `Olá, ${first}! O diagnóstico preliminar de energia${ctx.company ? ` da ${ctx.company}` : ""} (protocolo ${ctx.protocol}) está disponível: ${ctx.diagnosticUrl}. Se quiser, um especialista pode explicar os pontos identificados.`;
    case 2:
      return `Oi, ${first}. Um lembrete: o diagnóstico que você recebeu é preliminar. Na validação técnica conferimos histórico, contrato e condições da unidade consumidora antes de qualquer recomendação. Quer agendar essa conversa? ${ctx.diagnosticUrl}`;
    case 3:
      return `${first}, ${sol ? `a solução com mais aderência ao seu perfil parece ser ${sol}. ` : ""}Podemos fazer uma conversa rápida de 15 minutos para avaliar se faz sentido para a sua empresa? Protocolo ${ctx.protocol}.`;
    default:
      return `Olá, ${first}. Não queremos incomodar: esta é nossa última mensagem sobre o diagnóstico ${ctx.protocol}. Quando quiser retomar, é só responder. Para não receber mais mensagens, responda SAIR.`;
  }
}

export function confirmationMessage(ctx: { name: string; protocol: string; diagnosticUrl: string; hot: boolean }): string {
  const first = ctx.name.split(" ")[0];
  return ctx.hot
    ? `Olá, ${first}! Recebemos sua fatura (protocolo ${ctx.protocol}). Seu diagnóstico preliminar identificou oportunidades que merecem uma análise comercial: ${ctx.diagnosticUrl}`
    : `Olá, ${first}! Recebemos sua solicitação (protocolo ${ctx.protocol}). Seu diagnóstico preliminar está disponível em: ${ctx.diagnosticUrl}`;
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1020">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e5e8f0">
<tr><td style="padding:28px 32px;border-bottom:1px solid #eef0f5"><strong style="font-size:16px">${escapeHtml(title)}</strong></td></tr>
<tr><td style="padding:24px 32px;font-size:15px;line-height:1.6">${bodyHtml}
${cta ? `<p style="margin:28px 0 8px"><a href="${cta.url}" style="background:#2f5bff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 32px;font-size:12px;color:#6b7280;border-top:1px solid #eef0f5">Análise preliminar, sujeita à validação técnica. Você recebeu este e-mail porque solicitou um diagnóstico.</td></tr>
</table></td></tr></table></body></html>`;
}
