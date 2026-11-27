import { expect, test } from "@playwright/test";

/**
 * Rateio GD (/admin/rateio): exemplo fictício, tabela, parecer e exportação.
 * Precisa das credenciais do admin (as mesmas do servidor).
 */
const email = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;

test.describe("admin: rateio GD", () => {
  test.skip(!email || !password, "defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD (as mesmas do servidor)");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin$/);
    // estes testes cobrem o modo completo; o simples tem o seu teste no fim
    await page.addInitScript(() => localStorage.setItem("aferi:rateio:modo", "completo"));
    await page.goto("/admin/rateio");
  });

  test("exemplo fictício gera estudo completo, sem rolagem lateral", async ({ page }) => {
    // otimização, busca do máximo compensável e recálculo rodam de verdade no navegador
    test.setTimeout(120_000);
    await page.getByRole("button", { name: "Ver exemplo fictício" }).click();
    await expect(page.getByRole("heading", { name: "Saldo de créditos projetado" })).toBeVisible();
    await expect(page.getByText("Soma: 100%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pontos de atenção" })).toBeVisible();
    // máximo compensável: ótimo calculado em segundo plano e linha na comparação
    await expect(page.getByRole("heading", { name: "Máximo compensável" })).toBeVisible();
    await expect(page.getByText("Planilha modelo (célula M8)")).toBeVisible();
    await expect(page.getByText("Máximo compensável efetivo").first()).toBeVisible();
    await expect(page.getByText("Do limite físico possível")).toBeVisible();
    // status geral, recalcular e registro do cálculo
    const status = page.getByRole("button", { name: /Status do estudo/ });
    await expect(status).not.toHaveText(/Calculando/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Recalcular" }).click();
    await expect(status).not.toHaveText(/Calculando/, { timeout: 30_000 });
    await status.click();
    await expect(page.getByRole("list", { name: "Registro do cálculo" })).toContainText("Recálculo pedido");

    await page.getByRole("button", { name: "Gerar parecer" }).click();
    await expect(page.getByLabel("Texto do parecer")).toHaveValue(/Estudo de revisão do rateio|rateio/i, { timeout: 30_000 });

    // popup de exportação: PDF executivo e Excel completo (todas as usinas)
    await page.getByRole("button", { name: "Exportar estudo" }).click();
    await expect(page.getByRole("dialog", { name: "Exportar estudo" })).toBeVisible();
    const pdf = page.waitForEvent("download");
    await page.getByRole("button", { name: /PDF executivo/ }).click();
    expect((await pdf).suggestedFilename()).toMatch(/^Estudo-de-rateio_.*\.pdf$/);

    await page.getByRole("button", { name: "Exportar estudo" }).click();
    const excel = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel completo/ }).click();
    expect((await excel).suggestedFilename()).toMatch(/^Estudo-de-rateio_.*\.xlsx$/);

    // da usina: inclui a planilha modelo
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    const modelo = page.waitForEvent("download");
    await page.getByRole("button", { name: /Planilha modelo/ }).click();
    expect((await modelo).suggestedFilename()).toMatch(/^Modelo_Rateio_.*\.xlsx$/);

    await page.getByRole("button", { name: "Como fazer" }).click();
    await expect(page.getByRole("heading", { name: "Rateio passo a passo" })).toBeVisible();

    const [scroll, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(largura);
  });

  test("exportar escolhendo usinas, concluir e reabrir", async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByRole("button", { name: "Ver exemplo fictício" }).click();
    await expect(page.getByRole("heading", { name: "Saldo de créditos projetado" })).toBeVisible();
    const status = page.getByRole("button", { name: /Status do estudo/ });
    await expect(status).not.toHaveText(/Calculando/, { timeout: 60_000 });

    // duas usinas marcadas: planilha modelo aparece e sai num .zip
    await page.getByRole("button", { name: "Exportar estudo" }).click();
    const dlg = page.getByRole("dialog", { name: "Exportar estudo" });
    await expect(dlg.getByRole("checkbox")).toHaveCount(2);
    const zip = page.waitForEvent("download");
    await dlg.getByRole("button", { name: /Planilha modelo/ }).click();
    expect((await zip).suggestedFilename()).toMatch(/^Modelos_Rateio_.*\.zip$/);

    // só uma marcada: planilha modelo .xlsx
    await page.getByRole("button", { name: "Exportar estudo" }).click();
    await dlg.getByRole("checkbox").first().uncheck();
    const um = page.waitForEvent("download");
    await dlg.getByRole("button", { name: /Planilha modelo/ }).click();
    expect((await um).suggestedFilename()).toMatch(/^Modelo_Rateio_.*\.xlsx$/);

    // concluir: sai das abas e vai para Concluídos, de onde ainda exporta
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByRole("heading", { name: "Rateios concluídos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Concluídos (1)" })).toBeVisible();
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    const pdf = page.waitForEvent("download");
    await dlg.getByRole("button", { name: /PDF executivo/ }).click();
    expect((await pdf).suggestedFilename()).toMatch(/^Estudo-de-rateio_.*\.pdf$/);

    // reabrir volta para as abas
    await page.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("button", { name: /Concluídos/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Saldo de créditos projetado" })).toBeVisible();
  });

  test("colar tabela de UCs cria a usina", async ({ page }) => {
    await page.getByRole("button", { name: "Colar tabela" }).click();
    await page.getByLabel("Destino").selectOption("nova");
    await page
      .getByLabel("Tabela colada")
      .fill(["Nome da Usina\tN° de Instalação\t% do Rateio\tSaldo kWh\tConsumo Compensável kWh", "UFV TESTE\t111\t60\t0\t900", "UFV TESTE\t222\t40\t5000\t300"].join("\n"));
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "UFV TESTE" })).toBeVisible();
    await expect(page.getByText("Falta a injeção da usina")).toBeVisible();

    // energia consumida: o período abre uma competência por mês; colar a coluna preenche em sequência
    await page.getByLabel("Início do período").fill("2026-01");
    await page.getByLabel("Fim do período").fill("2026-03");
    await expect(page.getByLabel(/Energia consumida em/)).toHaveCount(3);
    await page.getByLabel("Energia consumida em jan/26").fill("1000");
    await page.getByLabel("Energia consumida em fev/26").fill("2000");
    await expect(page.getByText(/Total 3\.000 kWh · média 1\.500 kWh\/mês/)).toBeVisible();
  });

  test("modo simples: um gráfico, baixar planilha e base de UCs", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => localStorage.setItem("aferi:rateio:modo", "simples"));
    await page.goto("/admin/rateio");
    await page.getByRole("button", { name: "Ver exemplo fictício" }).click();
    await expect(page.getByText("Contrato, geração e carga")).toBeVisible();
    await expect(page.getByText("Rateio pronto · soma 100%")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Novas UCs", { exact: true })).toBeVisible();
    // poucos botões: sem colar tabela, recalcular ou exportar estudo no topo
    await expect(page.getByRole("button", { name: "Colar tabela" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exportar estudo" })).toHaveCount(0);
    const modelo = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar planilha" }).click();
    expect((await modelo).suggestedFilename()).toMatch(/^Modelo_Rateio_.*\.xlsx$/);

    await page.getByRole("button", { name: /Base de UCs/ }).click();
    await expect(page.getByRole("heading", { name: "Base de UCs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar desligadas" })).toBeVisible();

    // detalhes: volta ao modo completo e dá para voltar
    await page.getByRole("navigation", { name: "Seções do estudo" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Ver detalhes do cálculo" }).click();
    await expect(page.getByRole("heading", { name: "Saldo de créditos projetado" })).toBeVisible();
    await page.getByRole("button", { name: "Modo simples" }).click();
    await expect(page.getByText("Contrato, geração e carga")).toBeVisible();

    const [scroll, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(largura);
  });
});
