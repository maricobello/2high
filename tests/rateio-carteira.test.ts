import { describe, expect, it } from "vitest";
import { planoCarteira } from "@/modules/rateio/carteira";
import { usinaVazia } from "@/modules/rateio/grid";
import { PARAMETROS_PADRAO, type UcAtual, type Usina } from "@/modules/rateio/types";

const uc = (n: number, comp: number, uf = "PE"): UcAtual => ({ key: String(n), usina: "", idUnidade: "", instalacao: String(n), apelido: `${uf}REC_${n}`, subgrupo: "B3", pctAtual: 0, saldoKwh: 0, compensavelKwh: comp, compensadoKwh: 0 });
function usina(nome: string, dist: string, ucs: UcAtual[], contratoMes: number, injecaoMes: number): Usina {
  const u = usinaVazia(nome);
  const pct = 100 / ucs.length;
  return { ...u, distribuidora: dist, meses: 1, energiaContratadaPeriodo: contratoMes, energiaInjetadaPeriodo: injecaoMes, ucs: ucs.map((x) => ({ ...x, pctAtual: pct })) };
}

describe("carteira: carga acima do contrato vai para usina com espaço", () => {
  it("move o excesso para a usina da mesma distribuidora com espaço", () => {
    // origem: contrato 1000 (meta 900), gera 500, carga 2000 → pode sair 1100
    const origem = usina("ORIGEM", "CELPE", [uc(1, 600), uc(2, 500), uc(3, 400), uc(4, 300), uc(5, 200)], 1000, 500);
    // destino: contrato 2000 (meta 1800), gera 2000, carga 300 → espaço 1500
    const destino = usina("DESTINO", "NEOENERGIA", [uc(10, 300)], 2000, 2000);
    const outraUf = usina("BAHIA", "COELBA", [uc(20, 100, "BA")], 5000, 5000);
    const plano = planoCarteira([origem, destino, outraUf], PARAMETROS_PADRAO);
    const ex = plano.excessos.find((e) => e.usina === "ORIGEM")!;
    expect(ex.excessoKwh).toBe(1100);
    expect(ex.movido).toBeGreaterThan(0);
    expect(ex.movido).toBeLessThanOrEqual(1500);
    expect(plano.transferencias.every((t) => t.para !== "BAHIA")).toBe(true);
    expect(plano.transferencias.some((t) => t.para === "DESTINO")).toBe(true);
  });

  it("sem usina com espaço: aponta o excesso sem destino", () => {
    const origem = usina("ORIGEM", "CELPE", [uc(1, 600), uc(2, 500)], 500, 300);
    const plano = planoCarteira([origem], PARAMETROS_PADRAO);
    expect(plano.excessos[0].semDestino).toBeGreaterThan(0);
    expect(plano.transferencias.every((t) => t.para === null)).toBe(true);
  });
});
