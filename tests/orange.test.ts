import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/secrets", () => ({ getSecret: async () => null }));
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

import { competenciaAnterior, preencher } from "@/modules/orange/coleta";
describe("coleta do Orange", () => {
  it("preenche os campos da receita com usina e competência", () => {
    expect(preencher("/GD/Exportar?usina={usina}&ref={mesAno}", { id: "323", nome: "UFV X" }, "2026-09")).toBe("/GD/Exportar?usina=323&ref=09/2026");
    expect(preencher("{ano}-{mes}|{competencia}", { id: "1", nome: "" }, "2026-01")).toBe("2026-01|2026-01");
  });
  it("competência padrão = mês fechado anterior", () => {
    expect(competenciaAnterior(new Date("2026-12-06T12:00:00Z"))).toBe("2026-11");
    expect(competenciaAnterior(new Date("2027-01-06T12:00:00Z"))).toBe("2026-12");
  });
});

describe("login do Orange", () => {
  it("lê a mensagem de erro da tela de login e limpa a credencial colada", async () => {
    const { mensagemDoOrange, limparCredencial, dicaUsuario } = await import("@/modules/orange/cliente");
    expect(mensagemDoOrange(`<form id="loginform"><label id="msgerro">O usu&#xE1;rio ou senha inv&#xE1;lida</label></form>`)).toBe("O usuário ou senha inválida");
    expect(mensagemDoOrange(`<label id="msgerro"></label>`)).toBeNull();
    expect(limparCredencial(' "fulano@replace.com.br"\n')).toBe("fulano@replace.com.br");
    expect(dicaUsuario("a@b.com")).toMatch(/e-mail/);
    expect(dicaUsuario("usuario.replace")).toMatch(/nome de usuário/);
  });
});
