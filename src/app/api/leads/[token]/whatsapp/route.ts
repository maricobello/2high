import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { db } from "@/modules/db";
import { addIntentSignal } from "@/modules/crm/service";

export const runtime = "nodejs";

/** Registra o clique (intenção) e redireciona para o WhatsApp comercial com mensagem pronta. */
export async function GET(req: Request, ctx: RouteContext<"/api/leads/[token]/whatsapp">) {
  const { token } = await ctx.params;
  const lead = await db().getLeadByToken(token);
  const text = lead
    ? `Olá! Sou ${lead.name}${lead.company ? `, da ${lead.company}` : ""}. Recebi o diagnóstico preliminar de energia (protocolo ${lead.protocol}) e gostaria de falar com um especialista.`
    : "Olá! Gostaria de falar com um especialista sobre a conta de energia da minha empresa.";
  if (lead) {
    try {
      await db().addActivity({
        leadId: lead.id,
        type: "whatsapp_click",
        channel: "whatsapp",
        content: "Lead clicou em falar com especialista no WhatsApp.",
        meta: { userAgent: req.headers.get("user-agent")?.slice(0, 200) },
        author: "lead",
      });
      await addIntentSignal(lead.id, "whatsapp_click");
    } catch (err) {
      console.error("[whatsapp-click]", err);
    }
  }
  const target = brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}` : `/contato-indisponivel`;
  return NextResponse.redirect(new URL(target, req.url), 302);
}
