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
    await page.goto("/admin/rateio");
  });

  test("exemplo fictício gera estudo completo, sem rolagem lateral", async ({ page }) => {
    await page.getByRole("button", { name: "Ver exemplo fictício" }).click();
    await expect(page.getByRole("heading", { name: "Saldo de créditos projetado" })).toBeVisible();
    await expect(page.getByText("Soma: 100%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pontos de atenção" })).toBeVisible();

    await page.getByRole("button", { name: "Gerar parecer" }).click();
    await expect(page.getByLabel("Texto do parecer")).toHaveValue(/Estudo de revisão do rateio|rateio/i, { timeout: 30_000 });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar estudo" }).click();
    expect((await download).suggestedFilename()).toMatch(/^estudo-rateio_.*\.xlsx$/);

    const [scroll, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(largura);
  });

  test("colar tabela de UCs cria a usina", async ({ page }) => {
    await page.getByRole("button", { name: "Colar tabela" }).click();
    await page.getByLabel("Destino").selectOption("nova");
    await page
      .getByLabel("Tabela colada")
      .fill(["Nome da Usina\tN° de Instalação\t% do Rateio\tSaldo kWh\tConsumo Compensável kWh", "UFV TESTE\t111\t60\t0\t900", "UFV TESTE\t222\t40\t5000\t300"].join("\n"));
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "UFV TESTE" })).toBeVisible();
    await expect(page.getByText("Falta a injeção")).toBeVisible();
  });
});
