import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { endpointsDe, estruturaHtml } from "@/modules/orange/mapear";

describe("mapa do Orange", () => {
  it("lê links, filtros e endereços sem levar tokens", () => {
    const html = `<title>Relatório Gerencial</title>
      <a href="/GestaoUsinaGD/RelatorioGerencial">Relatório Gerencial</a><a href="#">x</a>
      <form action="/GestaoUsinaGD/Exportar" method="post"><input type="hidden" name="__RequestVerificationToken" value="SEGREDO">
      <select name="IdUsina"><option>UFV ALTO DO PAJEU I</option><option>UFV RAJADA I</option></select>
      <input name="Competencia" type="month"></form>
      <button id="btnExportar">Exportar Excel</button>
      <table><tr><th>UC</th><th>Consumo</th></tr></table>
      <script>$.ajax({ url: "/GestaoUsinaGD/ListarUnidades?id=1" }); var u = '/Usina/Buscar';</script>`;
    const m = estruturaHtml("/x", 200, html);
    expect(m.titulo).toBe("Relatório Gerencial");
    expect(m.links[0]).toEqual({ texto: "Relatório Gerencial", href: "/GestaoUsinaGD/RelatorioGerencial" });
    const campos = m.formularios[0].campos;
    expect(campos.find((c) => c.nome === "IdUsina")?.exemplos).toEqual(["UFV ALTO DO PAJEU I", "UFV RAJADA I"]);
    expect(JSON.stringify(m)).not.toContain("SEGREDO");
    expect(m.botoes.some((b) => /Exportar/.test(b))).toBe(true);
    expect(m.tabelas[0]).toEqual(["UC", "Consumo"]);
    expect(endpointsDe(html)).toEqual(expect.arrayContaining(["/GestaoUsinaGD/ListarUnidades", "/Usina/Buscar"]));
  });
});
