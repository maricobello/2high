import { expect, test, type Page } from "@playwright/test";
import { REPORT_COMPANY, REPORT_PROTOCOL, REPORT_TOKEN } from "./support/seed-report";

/**
 * Relatório pós-análise (/diagnostico/[token]) e painel "Uso da IA" do admin.
 * O lead de teste é semeado no banco local pelo globalSetup.
 */

const SECTIONS = ["Resumo", "Indicadores", "Próximos passos", "Principais achados", "Histórico de consumo", "Dados e metodologia"];

async function openReport(page: Page) {
  await page.goto(`/diagnostico/${REPORT_TOKEN}`);
  await expect(page.getByRole("heading", { level: 1, name: "Análise preliminar de energia" })).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe("relatório da análise", () => {
  test("mostra todas as seções, sem rolagem lateral e sem citar IA", async ({ page }) => {
    await openReport(page);
    for (const name of SECTIONS) await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.getByText(`#${REPORT_PROTOCOL}`).first()).toBeVisible();
    await expect(page.getByText(REPORT_COMPANY)).toBeVisible();
    // unidade consumidora mascarada: só os 4 últimos dígitos
    await expect(page.getByText(/^•••\d{4}$/)).toBeVisible();
    await expect(page.getByRole("meter", { name: "Confiança da análise" }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bIA\b|intelig[êe]ncia artificial/i);
  });

  test("no celular, indicadores e próximos passos vêm antes dos achados", async ({ page }) => {
    await openReport(page);
    const y = async (name: string) => (await page.getByRole("heading", { level: 2, name }).boundingBox())!;
    const [resumo, indicadores, achados] = [await y("Resumo"), await y("Indicadores"), await y("Principais achados")];
    const width = page.viewportSize()!.width;
    if (width >= 1280) {
      // computador: lateral à direita, na altura do resumo
      expect(indicadores.x).toBeGreaterThan(resumo.x + 300);
      expect(Math.abs(indicadores.y - resumo.y)).toBeLessThan(40);
    } else {
      expect(indicadores.y).toBeGreaterThan(resumo.y);
      expect(indicadores.y).toBeLessThan(achados.y);
    }
  });

  test("tablet, notebook e ultrawide: sem rolagem lateral e conteúdo centralizado", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "larguras testadas no projeto desktop");
    for (const [width, height] of [[768, 1024], [1024, 768], [1920, 1080], [3440, 1440]]) {
      await page.setViewportSize({ width, height });
      await openReport(page);
      await expectNoHorizontalScroll(page);
      const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      // no ultrawide o relatório fica limitado a 1600px e centralizado
      if (width > 1600) expect(h1.x).toBeGreaterThan((width - 1600) / 2);
    }
  });

  test("pedir o diagnóstico completo registra o interesse", async ({ page }) => {
    let signal: unknown = null;
    await page.route(`**/api/leads/${REPORT_TOKEN}/intent`, async (route) => {
      signal = route.request().postDataJSON().signal;
      await route.fulfill({ json: { ok: true } });
    });
    await openReport(page);
    await page.getByRole("button", { name: "Solicitar diagnóstico completo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido recebido" })).toBeVisible();
    expect(signal).toBe("requested_full_diagnostic");
  });

  test("versão para PDF esconde menu, botões e chamadas", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "impressão testada no desktop");
    await openReport(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("heading", { name: "Principais achados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar PDF" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Próximos passos" })).toBeHidden();
    await expect(page.locator("body > header, header.sticky").first()).toBeHidden();
  });
});

test.describe("admin: uso da IA", () => {
  const email = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;

  test("painel mostra chamadas, relatórios e erros, sem rolagem lateral", async ({ page }) => {
    test.skip(!email || !password, "defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD (as mesmas do servidor)");
    await page.goto("/admin/login");
    await page.getByLabel("E-mail", { exact: true }).fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/ia?dias=7");
    await expect(page.getByRole("heading", { level: 1, name: "Uso da IA" })).toBeVisible();
    await expect(page.getByText("Chamadas à IA")).toBeVisible();
    await expect(page.getByRole("link", { name: REPORT_COMPANY })).toBeVisible();
    await expect(page.getByText("LLM 429: rate limit exceeded").first()).toBeVisible();
    await page.getByRole("link", { name: "90 dias" }).click();
    await expect(page).toHaveURL(/dias=90/);
    await expect(page.getByRole("link", { name: "90 dias" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  });
});
