import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseInvoiceText } from "@/modules/invoice/regex-parser";
import { runAudit } from "@/modules/rules-engine/engine";
import { simulateGd } from "@/modules/simulators/gd";
import { analyzeFreeMarket } from "@/modules/simulators/free-market";
import { scoreLead } from "@/modules/scoring/score";

const now = new Date("2026-09-22T12:00:00Z");
const lead = { billRange: "10k_50k" as const, solarStatus: "nao" as const, freeMarketStatus: "nao_sei" as const, state: "MG", city: "Contagem" };

describe("motor de auditoria — Grupo A", () => {
  const inv = parseInvoiceText(readFileSync("tests/fixtures/fatura-grupo-a.txt", "utf8")).data;
  const audit = runAudit({ invoice: inv, lead, now });
  const codes = audit.findings.map((f) => f.code);

  it("identifica ultrapassagem, reativo, estrutura tarifária e mercado livre", () => {
    expect(codes).toContain("demand_overrun");
    expect(codes).toContain("reactive_energy");
    expect(codes).toContain("tariff_structure");
    expect(codes).toContain("free_market_opportunity");
    expect(audit.metrics.profile).toBe("A");
    expect(audit.solutions[0]).toBe("mercado_livre");
  });
  it("todo achado tem título, explicação, dados, confiança e aviso", () => {
    for (const f of audit.findings) {
      expect(f.title).toBeTruthy();
      expect(f.explanation.length).toBeGreaterThan(20);
      expect(f.disclaimer).toBeTruthy();
      expect(["alta", "média", "baixa"]).toContain(f.confidence);
    }
  });
  it("não usa linguagem absoluta", () => {
    const all = audit.findings.map((f) => `${f.title} ${f.explanation}`).join(" ").toLowerCase();
    expect(all).not.toMatch(/roubad|garantimos|cobrando errado|dinheiro para receber/);
  });
  it("gera score HOT", () => {
    const s = scoreLead({ billRange: lead.billRange, audit, completeness: 0.9, intentSignals: ["uploaded_invoice"], hasInvoice: true });
    expect(s.score).toBeGreaterThanOrEqual(65);
    expect(s.temperature).toBe("HOT");
    expect(s.potentialValue).toBeGreaterThan(0);
  });
});

describe("motor de auditoria — sem fatura legível", () => {
  it("usa a faixa informada e ainda gera diagnóstico", () => {
    const audit = runAudit({ invoice: null, lead: { ...lead, billRange: "1k_4k" }, now });
    expect(audit.metrics.totalAmountSource).toBe("faixa_informada");
    expect(audit.basedOnInvoice).toBe(false);
    expect(audit.gd.fit).toBe("compativel");
  });
});

describe("simulador GD", () => {
  it("retorna faixa, nunca valor único", () => {
    const r = simulateGd({ monthlyBill: 3000, consumptionKwh: 3000, distributor: "Cemig", tariffGroup: "B", year: 2026 });
    expect(r.savingsMin).not.toBeNull();
    expect(r.savingsMax!).toBeGreaterThan(r.savingsMin!);
    expect(r.savingsMax!).toBeLessThan(3000 * 0.2);
    expect(r.fit).toBe("compativel");
  });
  it("sem dados retorna insuficiente", () => {
    expect(simulateGd({ monthlyBill: null }).fit).toBe("dados_insuficientes");
  });
});

describe("Mercado Livre", () => {
  it("Grupo B não é declarado elegível", () => {
    const r = analyzeFreeMarket({ tariffGroup: "B", monthlyBill: 5000 });
    expect(r.status).toBe("fora_do_perfil_atual");
  });
  it("Grupo A é perfil compatível para avaliação, não elegível", () => {
    const r = analyzeFreeMarket({ tariffGroup: "A", demandKw: 300, monthlyBill: 40000 });
    expect(r.status).toBe("perfil_compativel");
    expect(r.statusLabel.toLowerCase()).not.toContain("elegível");
    expect(r.savingsMin).toBeGreaterThan(0);
  });
});
