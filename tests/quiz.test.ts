import { describe, expect, it } from "vitest";
import { diagnose, quizSummary } from "@/modules/quiz/diagnosis";

describe("quiz diagnosis", () => {
  it("indústria Grupo A sem auditoria: nível alto, ICMS e 60 faturas", () => {
    const d = diagnose({ bill: "10k_50k", segment: "industria", audited: "nunca", tenure: "mais_5", voltage: "a" });
    expect(d.level).toBe("ALTO");
    expect(d.months).toBe(60);
    expect(d.auditableVolume).toBe(25_000 * 60);
    expect(d.icmsEmbedded).toBe(Math.round(25_000 * 60 * 0.17));
    expect(d.fronts.map((f) => f.code)).toEqual(["cobrancas", "demanda_reativo", "icms_demanda", "icms_credito", "mercado_livre"]);
  });

  it("comércio Grupo B auditado recentemente: moderado, sem ICMS, com GD", () => {
    const d = diagnose({ bill: "1k_4k", segment: "comercio", audited: "recente", tenure: "menos_1", voltage: "b" });
    expect(d.level).toBe("MODERADO");
    expect(d.icmsEmbedded).toBeNull();
    expect(d.fronts.some((f) => f.code === "icms_credito" || f.code === "demanda_reativo")).toBe(false);
    expect(d.fronts[0].detail).toContain("12 faturas");
  });

  it("resume respostas com rótulos", () => {
    expect(quizSummary({ segment: "agro", voltage: "nao_sei" })).toEqual({ segment: "Agronegócio", voltage: "Não sei" });
  });
});
