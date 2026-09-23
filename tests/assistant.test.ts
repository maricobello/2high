import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruleBasedAnswer } from "@/modules/assistant/engine";
import { searchKnowledge } from "@/modules/assistant/knowledge";
import { parseInvoiceText } from "@/modules/invoice/regex-parser";
import { runAudit } from "@/modules/rules-engine/engine";
import { guardGeneratedText, collectAllowedNumbers } from "@/modules/llm/guards";

describe("atendimento sem IA (fallback)", () => {
  it("encontra resposta no FAQ", () => {
    expect(searchKnowledge("precisa instalar placas solares?")?.q).toBe("Preciso instalar placas?");
    const r = ruleBasedAnswer("é gratuito mesmo?", { channel: "site" });
    expect(r.reply).toMatch(/gratuita/);
  });
  it("encaminha para humano quando pedido", () => {
    expect(ruleBasedAnswer("quero falar com um atendente", { channel: "site" }).handoff).toBe(true);
  });
  it("explica o Raio-X do lead sem inventar números", () => {
    const inv = parseInvoiceText(readFileSync("tests/fixtures/fatura-grupo-a.txt", "utf8")).data;
    const audit = runAudit({ invoice: inv, lead: { billRange: null, solarStatus: null, freeMarketStatus: null } });
    const r = ruleBasedAnswer("qual o resultado da minha fatura?", { channel: "site", hasInvoice: true, diagnostic: { summary: "", audit } });
    expect(r.reply).toMatch(/48\.732,18/);
    expect(guardGeneratedText(r.reply, collectAllowedNumbers(audit)).ok).toBe(true);
  });
  it("sugere envio da fatura para quem ainda não enviou", () => {
    expect(ruleBasedAnswer("como faço para enviar a conta?", { channel: "site", hasInvoice: false }).suggestUpload).toBe(true);
  });
});
