import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/secrets", () => ({ getSecret: async () => null }));
const guardado = new Map<string, Buffer>();
vi.mock("@/modules/storage", () => ({
  storage: () => ({
    save: async (k: string, d: Buffer) => void guardado.set(k, d),
    read: async (k: string) => {
      const d = guardado.get(k);
      if (!d) throw new Error("não existe");
      return d;
    },
    remove: async (k: string) => void guardado.delete(k),
    signedUrl: async () => null,
  }),
}));

import { coletar, filtrarUsinas, resumoEconomia } from "@/modules/orange/coleta";
import { camposSimples, lerFiltroGestao, lerUcs, lerUsinas, linhasGerencial, numeroOrange, planilhaGerencial, planilhaUcs, regrasGerencial, somarGerencial, somasGerencial } from "@/modules/orange/gd";
import { parseRelatorioGerencial, parseUcs } from "@/modules/rateio/grid";
import { lerXlsx } from "@/modules/rateio/xlsx";
import type { ClienteOrange } from "@/modules/orange/cliente";

const USINAS = { data: [{ Id_Usina: 10, Tx_NomeUsina: "UFV IBITITA", Tx_Apelido: "IBT", DistribuidoraNome: "COELBA" }, { Id_Usina: 20, Tx_NomeUsina: "UFV ALTO DO PAJEU I", Tx_Apelido: "", DistribuidoraNome: "CELPE" }, { Id_Usina: 10, Tx_NomeUsina: "UFV IBITITA" }] };
const UCS = {
  data: [
    { id_Usina: 10, Id_Empresa: 1, Nr_Numero_Instalacao: "7001234", Tx_Apelido: "BA-0001", Tx_SubGrupo: "B3", Nr_Percentual: 60, Nr_Saldo_Kwh: 1200, Nr_MediaConsumoCompensavel_Kwh: 3000, Nr_MediaEnergiaCompensada_Kwh: 2900, Nr_RsKwh: 0.88 },
    { id_Usina: 10, Id_Empresa: 2, Nr_Numero_Instalacao: "7005678", Tx_Apelido: "BA-0002", Tx_SubGrupo: "B3", Nr_Percentual_F: "40,00", Nr_Saldo_Kwh_F: "1.500,50", Nr_MediaConsumoCompensavel_Kwh_F: "2.000,00", Nr_MediaEnergiaCompensada_Kwh_F: "1.950,00" },
    { id_Usina: 20, Id_Empresa: 3, Nr_Numero_Instalacao: "3009999", Tx_Apelido: "PE-0001", Tx_SubGrupo: "B1", Nr_Percentual: 100, Nr_Saldo_Kwh: 0, Nr_MediaConsumoCompensavel_Kwh: 500, Nr_MediaEnergiaCompensada_Kwh: 480 },
  ],
};
const LISTA = {
  data: {
    tabelaAtual: true,
    list: [
      {
        TipoRemuneracaoVariavel: 46,
        aaData: [
          { Id_Empresa: 1, Nr_Instalacao: "7001234", Tx_Apelido: "BA-0001", PercentualRateioCompetencia: 60, NrEnergiaTotalConsumida: 3100, NrEnergiaCompensada: 3000, NrSaldoMensal: 100, NrFaturaSimulada: 2700, NrFaturaRecebida: 300, NrEconomiaUC: 400, Nr_DespesaTotal_Final: 2000, NrTarifaCativo: 0.87 },
          { Id_Empresa: 2, Nr_Instalacao: "7005678", Tx_Apelido: "BA-0002", PercentualRateioCompetencia: 40, NrEnergiaTotalConsumida: 2050, NrEnergiaCompensada: 2000, NrSaldoMensal: 50, NrFaturaSimulada: 1800, NrFaturaRecebida: 200, NrEconomiaUC: 250, Nr_DespesaTotal_Final: 1350, NrTarifaCativo: 0.87 },
        ],
      },
    ],
    validacoes: [],
    cargasRemovidas: [],
  },
};

describe("dados de GD do Orange", () => {
  it("lê números do Orange (formatados ou não)", () => {
    expect(numeroOrange("1.234,56")).toBeCloseTo(1234.56);
    expect(numeroOrange("R$ 2.000,00")).toBe(2000);
    expect(numeroOrange(12.5)).toBe(12.5);
    expect(numeroOrange("-")).toBe(0);
  });

  it("lê usinas sem repetir e UCs do rateio com valores formatados", () => {
    const usinas = lerUsinas(USINAS);
    expect(usinas.map((u) => u.id)).toEqual([10, 20]);
    const ucs = lerUcs(UCS, usinas);
    expect(ucs).toHaveLength(3);
    expect(ucs[1]).toMatchObject({ usina: "UFV IBITITA", pct: 40, saldoKwh: 1500.5, compensavelKwh: 2000, compensadoKwh: 1950 });
  });

  it("soma o Relatório Gerencial (economia, compensado, consumo)", () => {
    const t = somarGerencial(LISTA);
    expect(t).toMatchObject({ ucs: 2, consumoKwh: 5150, compensadoKwh: 5000, economiaRs: 650, custoCativoRs: 4500 });
    expect(linhasGerencial(LISTA)[0]).toMatchObject({ nova: "7001234", consumoKwh: 3100, tarifa: 0.87 });
    // modelo TIM (linha real da Ibotirama 10/2026): custo cativo = consumo × tarifa; economia = cativo − (recebida + demanda + arrendamento)
    const tim = somarGerencial({ data: { list: [{ TipoRemuneracaoVariavel: 41, aaData: [{ NrEnergiaTotalConsumida: 3749, NrTarifaDefault: 0.94502, NrFaturaSimulada: 0, NrFaturaRecebida: 1579.09, NrFaturaUsina: 1011.99, Locacao: 2823.6 }] }] } });
    expect(tim.custoCativoRs).toBeCloseTo(3542.88, 1);
    expect(tim.custoGdRs).toBeCloseTo(3835.59, 2);
    expect(tim.economiaRs).toBeCloseTo(3542.88 - 1579.09 - 3835.59, 1);
    const somas = somasGerencial({ data: { list: [{ TipoRemuneracaoVariavel: 41, aaData: [{ Id: 1, NrFaturaSimulada: "3.542,86", Locacao: 2823.6, Tx_Apelido: "X" }, { Id: 2, NrFaturaSimulada: "531,10", Locacao: 235.3 }] }] } });
    expect(somas).toEqual({ NrFaturaSimulada: 4073.96, Locacao: 3058.9 });
    expect(regrasGerencial({ data: { list: [{ TipoRemuneracaoVariavel: 41, aaData: [] }] } })).toEqual([41]);
  });

  it("gera planilhas que o rateio importa como estão", async () => {
    const usinas = lerUsinas(USINAS);
    const ucs = lerUcs(UCS, usinas).filter((u) => u.usinaId === 10);
    const [aba] = await lerXlsx(new Uint8Array(await planilhaUcs(ucs)).buffer);
    const lidas = parseUcs(aba.grid);
    expect(lidas?.map((u) => [u.instalacao, u.pctAtual, u.compensavelKwh, u.saldoKwh])).toEqual([
      ["7001234", 60, 3000, 1200],
      ["7005678", 40, 2000, 1500.5],
    ]);
    const [rel] = await lerXlsx(new Uint8Array(await planilhaGerencial("UFV IBITITA", "2026-10", linhasGerencial(LISTA))).buffer);
    const r = parseRelatorioGerencial(rel.grid);
    expect(r).toMatchObject({ usina: "UFV IBITITA", competencia: "2026-10", consumoTotal: 5150 });
    expect(r?.ucs).toHaveLength(2);
  });

  it("filtra usinas por nome ou id", () => {
    const usinas = lerUsinas(USINAS);
    expect(filtrarUsinas(usinas, ["pajeu"]).map((u) => u.id)).toEqual([20]);
    expect(filtrarUsinas(usinas, ["10"]).map((u) => u.id)).toEqual([10]);
    expect(filtrarUsinas(usinas, [])).toHaveLength(2);
  });
});

describe("coleta automática", () => {
  function clienteFalso(chamadas: string[], statusPajeu = 2) {
    const resp = (corpo: unknown) => new Response(JSON.stringify(corpo), { headers: { "content-type": "application/json; charset=utf-8" } });
    return {
      pedir: async (caminho: string, init: RequestInit = {}) => {
        chamadas.push(`${init.method ?? "GET"} ${caminho.split("?")[0]}`);
        if (caminho.startsWith("/cadastrousinagd/usinausuario")) return resp(USINAS);
        if (caminho.startsWith("/unidaderateiogd/getpercentualrateiobyidsusina")) {
          expect(JSON.parse(String(init.body))).toEqual({ usinaIds: [10, 20], competencia: "10/2026" });
          return resp(UCS);
        }
        if (caminho.startsWith("/gestaousinagd/resumoprocessamentocompetencia")) return resp({ data: { Nr_Status: caminho.includes("id_usina=20") ? statusPajeu : 2 } });
        if (caminho.startsWith("/GestaoUsinaGD/GetClientesUsina/")) return resp({ data: [{ Id: 5, Titulo: "OUTRO" }, { Id: 7, Titulo: "TIM S.A." }] });
        if (caminho.startsWith("/GestaoUsinaGD/List")) {
          expect(caminho).toContain("ClienteId=7");
          return resp(LISTA);
        }
        throw new Error(`não esperado: ${caminho}`);
      },
    } as unknown as ClienteOrange;
  }

  it("baixa UCs e Relatório Gerencial só com endereços de consulta e soma a economia", async () => {
    guardado.clear();
    const chamadas: string[] = [];
    const ind = await coletar(null, "2026-10", { cliente: clienteFalso(chamadas, 1) });
    expect(chamadas.every((c) => /^(GET|POST) \/(cadastrousinagd\/usinausuario|unidaderateiogd\/getpercentualrateiobyidsusina|gestaousinagd\/resumoprocessamentocompetencia|GestaoUsinaGD\/(GetClientesUsina\/\d+|List))$/.test(c))).toBe(true);
    expect(ind.arquivos.filter((a) => a.tipo === "ucs").map((a) => a.usina)).toEqual(["UFV IBITITA", "UFV ALTO DO PAJEU I"]);
    expect(ind.gerencial?.find((g) => g.usinaId === 20)?.status).toBe("nao_processado");
    expect(resumoEconomia(ind)).toMatchObject({ usinas: 1, economiaRs: 650, compensadoKwh: 5000 });
    expect([...guardado.keys()]).toContain("orange/coletas/2026-10/UFV_IBITITA_relatorio_2026-10.xlsx");

    // segunda execução: não baixa as UCs de novo e só relê a usina que faltava
    const chamadas2: string[] = [];
    const ind2 = await coletar(null, "2026-10", { cliente: clienteFalso(chamadas2, 2) });
    expect(chamadas2.some((c) => c.includes("unidaderateiogd"))).toBe(false);
    expect(chamadas2.filter((c) => c.includes("/List"))).toHaveLength(1);
    expect(resumoEconomia(ind2)).toMatchObject({ usinas: 2, economiaRs: 1300 });
  });

  it("para dentro do tempo e deixa o resto pendente", async () => {
    guardado.clear();
    const ind = await coletar(null, "2026-10", { cliente: clienteFalso([]), orcamentoMs: -1 });
    expect(ind.pendentes).toBe(2);
    expect(ind.pendentesUcs).toBe(2);
    // a rodada seguinte, com tempo, completa tudo
    const ind2 = await coletar(null, "2026-10", { cliente: clienteFalso([]) });
    expect(ind2).toMatchObject({ pendentes: 0, pendentesUcs: 0 });
    expect(ind2.arquivos.filter((a) => a.tipo === "ucs")).toHaveLength(2);
  });
});

describe("coleta com o banco fora do ar", () => {
  it("devolve a economia e avisa, sem quebrar", async () => {
    guardado.clear();
    const { storage } = await import("@/modules/storage");
    const s = storage() as unknown as { save: (k: string, d: Buffer) => Promise<void> };
    const original = s.save;
    const mod = await import("@/modules/storage");
    vi.spyOn(mod, "storage").mockReturnValue({ ...(storage() as object), save: async () => { throw new Error("tenant not found"); } } as never);
    const resp = (corpo: unknown) => new Response(JSON.stringify(corpo), { headers: { "content-type": "application/json" } });
    const cliente = {
      pedir: async (c: string) =>
        c.startsWith("/cadastrousinagd") ? resp(USINAS) : c.startsWith("/unidaderateiogd") ? resp(UCS) : c.startsWith("/gestaousinagd/resumo") ? resp({ data: { Nr_Status: 2 } }) : c.startsWith("/GestaoUsinaGD/GetClientesUsina") ? resp({ data: [{ Id: 7, Titulo: "TIM" }] }) : resp(LISTA),
    } as unknown as ClienteOrange;
    const ind = await coletar(null, "2026-10", { cliente });
    expect(resumoEconomia(ind).economiaRs).toBe(1300);
    expect(ind.erros.some((e) => /banco/.test(e))).toBe(true);
    vi.restoreAllMocks();
    void original;
  });
});

describe("filtro de usinas", () => {
  it("ignora acento, caixa e o prefixo UFV, e não confunde I com II", () => {
    const u = [
      { id: 1, nome: "UFV IBITITA", apelido: "", distribuidora: "" },
      { id: 2, nome: "UFV ALTO DO PAJEU I", apelido: "", distribuidora: "" },
      { id: 3, nome: "UFV ALTO DO PAJEU II", apelido: "", distribuidora: "" },
    ];
    expect(filtrarUsinas(u, ["Ibititá"]).map((x) => x.id)).toEqual([1]);
    expect(filtrarUsinas(u, ["Alto do Pajeú I"]).map((x) => x.id)).toEqual([2]);
    expect(filtrarUsinas(u, ["alto do pajeu"]).map((x) => x.id)).toEqual([2, 3]);
  });
});

describe("tela Gestão de Usinas de GD", () => {
  it("acha o endereço do filtro e os campos escondidos na página", () => {
    const html = `<form data-main-form-filter data-url="/GestaoUsinaGD/Buscar" data-showload="true"><input type="hidden" id="geracaoGD" name="geracaoGD" value="1"><input type="hidden" name="ViewType" value="2"></form>`;
    expect(lerFiltroGestao(html)).toEqual({ url: "/GestaoUsinaGD/Buscar", campos: { geracaoGD: "1", ViewType: "2" } });
    expect(lerFiltroGestao("<form></form>")).toBeNull();
  });
  it("guarda só números e textos curtos da resposta", () => {
    expect(camposSimples({ EnergiaInjetada: 3239006, EnergiaInjetadaContratada_F: "3.744.000", Nome: "UFV X", Sub: { Saldo: 10 }, Lista: [1, 2] })).toEqual({ EnergiaInjetada: 3239006, EnergiaInjetadaContratada_F: "3.744.000", "Sub.Saldo": 10 });
  });
});
