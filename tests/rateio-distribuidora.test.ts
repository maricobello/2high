import { describe, expect, it } from "vitest";
import { canonDistribuidora, mesmaDistribuidora, ufDaUsina } from "@/modules/rateio/distribuidora";

const usina = (distribuidora: string, aps: string[]) => ({ distribuidora, ucs: aps.map((apelido) => ({ apelido })) }) as never;
const cand = (concessionaria: string, apelido: string) => ({ concessionaria, apelido });

describe("distribuidora canônica", () => {
  it("reconhece nomes diferentes da mesma distribuidora", () => {
    expect(canonDistribuidora("ENEL-SP").id).toBe("ENEL SP");
    expect(canonDistribuidora("Eletropaulo").id).toBe("ENEL SP");
    expect(canonDistribuidora("RGE-SUL").id).toBe("RGE");
    expect(canonDistribuidora("NEOENERGIA", "PE").id).toBe("CELPE");
    expect(canonDistribuidora("EQUATORIAL").id).toBeNull();
  });

  it("usina da fatura Neoenergia aceita UCs da Celpe/Coelba pelo estado", () => {
    const pajeu = usina("NEOENERGIA", ["PEGLR_0029", "PERCE_0660", "PEREC_0001"]);
    expect(ufDaUsina(pajeu)).toBe("PE");
    expect(mesmaDistribuidora(cand("CELPE", "PERCE_0999"), pajeu)).toBe(true);
    expect(mesmaDistribuidora(cand("COELBA", "BASSA_0001"), pajeu)).toBe(false);
  });

  it("não mistura estados do mesmo grupo", () => {
    const alagoas = usina("EQUATORIAL", ["ALMCZ_0001", "ALARA_0002"]);
    expect(mesmaDistribuidora(cand("EQUATORIAL-AL", "ALMCZ_0100"), alagoas)).toBe(true);
    expect(mesmaDistribuidora(cand("EQUATORIAL-GO", "GOGNA_0578"), alagoas)).toBe(false);
    expect(mesmaDistribuidora(cand("ENEL-SP", "SPSPO_0001"), usina("ENEL SP", []))).toBe(true);
    expect(mesmaDistribuidora(cand("CEMIG", "MGBHE_1"), usina("CELESC", []))).toBe(false);
  });
});
