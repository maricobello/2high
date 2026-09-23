import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseInvoiceText, looksLikeEnergyBill } from "@/modules/invoice/regex-parser";
import { parseBrNumber, textContainsNumber } from "@/modules/invoice/numbers";
import { mergeExtractions } from "@/modules/invoice/merge";
import { validateInvoice } from "@/modules/invoice/validate";

const grupoA = readFileSync("tests/fixtures/fatura-grupo-a.txt", "utf8");
const grupoB = readFileSync("tests/fixtures/fatura-grupo-b.txt", "utf8");

describe("parseBrNumber", () => {
  it("converte formatos brasileiros", () => {
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("1.234")).toBe(1234);
    expect(parseBrNumber("0,87")).toBe(0.87);
    expect(parseBrNumber("R$ 48.732,18")).toBe(48732.18);
    expect(parseBrNumber("abc")).toBeNull();
  });
  it("confere números no texto", () => {
    expect(textContainsNumber(grupoA, 48732.18)).toBe(true);
    expect(textContainsNumber(grupoA, 99999.99)).toBe(false);
    expect(textContainsNumber(grupoA, 57120)).toBe(true);
  });
});

describe("parser regex — Grupo A", () => {
  const { data } = parseInvoiceText(grupoA);
  it("extrai campos principais", () => {
    expect(looksLikeEnergyBill(grupoA)).toBe(true);
    expect(data.distributor).toBe("Cemig Distribuição");
    expect(data.consumerUnit).toBe("3001234567");
    expect(data.customerClass).toBe("Industrial");
    expect(data.tariffGroup).toBe("A");
    expect(data.tariffSubgroup).toBe("A4");
    expect(data.tariffModality).toBe("verde");
    expect(data.consumptionPeakKwh).toBe(4820);
    expect(data.consumptionOffPeakKwh).toBe(52300);
    expect(data.consumptionKwh).toBe(57120);
    expect(data.contractedDemandKw).toBe(300);
    expect(data.measuredDemandKw).toBe(342);
    expect(data.billedDemandKw).toBe(342);
    expect(data.demandOverrunAmount).toBe(3150.4);
    expect(data.reactiveEnergyKvarh).toBe(1230);
    expect(data.reactiveAmount).toBe(412.55);
    expect(data.powerFactor).toBe(0.87);
    expect(data.tariffFlag).toBe("amarela");
    expect(data.totalAmount).toBe(48732.18);
    expect(data.referenceMonth).toBe("2026-09");
    expect(data.dueDate).toBe("2026-10-15");
    expect(data.history.length).toBe(6);
    expect(data.publicLightingAmount).toBe(250);
  });
});

describe("parser regex — Grupo B", () => {
  const { data } = parseInvoiceText(grupoB);
  it("extrai campos principais", () => {
    expect(data.distributor).toBe("Enel São Paulo");
    expect(data.tariffGroup).toBe("B");
    expect(data.tariffSubgroup).toBe("B3");
    expect(data.consumptionKwh).toBe(2450);
    expect(data.totalAmount).toBe(2618.44);
    expect(data.tariffFlag).toBe("verde");
    expect(data.referenceMonth).toBe("2026-08");
    expect(data.publicLightingAmount).toBe(45.9);
    expect(data.history.length).toBe(4);
  });
});

describe("merge regex + IA", () => {
  it("descarta número da IA que não aparece no documento", () => {
    const regex = parseInvoiceText(grupoB);
    const merged = mergeExtractions(regex, { contractedDemandKw: 999, consumerUnit: "123456789" }, { sourceText: grupoB, llmSource: "llm" });
    expect(merged.data.contractedDemandKw).toBeNull();
    expect(merged.meta.consumerUnit?.source).toBe("regex+llm");
  });
  it("aumenta confiança quando IA e regex concordam", () => {
    const regex = parseInvoiceText(grupoB);
    const merged = mergeExtractions(regex, { totalAmount: 2618.44 }, { sourceText: grupoB, llmSource: "llm" });
    expect(merged.meta.totalAmount?.confidence).toBeGreaterThan(0.9);
  });
});

describe("validação", () => {
  it("calcula completude e anula valores implausíveis", () => {
    const { data, meta } = parseInvoiceText(grupoA);
    data.powerFactor = 7;
    const { data: v, result } = validateInvoice(data, meta, { looksLikeEnergyBill: true });
    expect(v.powerFactor).toBeNull();
    expect(result.usable).toBe(true);
    expect(result.completeness).toBeGreaterThan(0.8);
  });
});
