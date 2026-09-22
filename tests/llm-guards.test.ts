import { describe, expect, it } from "vitest";
import { classifyIntentByRules } from "@/modules/llm/tasks/messaging";
import { collectAllowedNumbers, extractNumbers, guardGeneratedText } from "@/modules/llm/guards";
import { isValidCnpj } from "@/modules/leads/schema";

describe("guardas de texto gerado por IA", () => {
  const allowed = collectAllowedNumbers({ total: 48732.18, faixa: { min: 2339, max: 5263 }, texto: "demanda 300 kW" });
  it("aceita números fornecidos", () => {
    expect(guardGeneratedText("A conta de R$ 48.732,18 tem potencial de R$ 2.339 a R$ 5.263 por mês, com demanda de 300 kW.", allowed).ok).toBe(true);
  });
  it("reprova números inventados", () => {
    const r = guardGeneratedText("Você pode economizar R$ 9.999 por mês.", allowed);
    expect(r.ok).toBe(false);
  });
  it("reprova linguagem absoluta", () => {
    expect(guardGeneratedText("Garantimos 30% de economia na sua conta.", allowed).ok).toBe(false);
    expect(guardGeneratedText("Sua concessionária está cobrando errado e você foi roubado.", allowed).ok).toBe(false);
  });
  it("extrai números em formato brasileiro", () => {
    expect(extractNumbers("R$ 1.234,56 e 57.120 kWh")).toEqual([1234.56, 57120]);
  });
});

describe("classificação de intenção por regras", () => {
  it("detecta opt-out, reunião e interesse", () => {
    expect(classifyIntentByRules("SAIR")).toBe("opt_out");
    expect(classifyIntentByRules("Podemos agendar uma reunião amanhã?")).toBe("agendar_reuniao");
    expect(classifyIntentByRules("Tenho interesse, pode mandar a proposta")).toBe("interessado");
  });
});

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});
