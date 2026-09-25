import { expect, test, type Page } from "@playwright/test";
import { QUESTIONS } from "../src/modules/quiz/diagnosis";

/**
 * Regressões práticas do funil do hero: quiz → resultado → contato → fatura.
 * A API de leads é simulada (o teste não grava nada no banco).
 */

// Conta de R$ 10 mil a R$ 50 mil, indústria, nunca auditada, mais de 5 anos, "não sei" o grupo:
// a combinação que gera o resultado mais longo (5 pontos, ICMS e textos condicionais).
const LONGEST = [3, 0, 0, 2, 2];
const TOKEN = "tok_e2e_123";

const card = (page: Page) => page.getByRole("region", { name: "Diagnóstico em 5 perguntas" });
const hero = (page: Page) => page.locator("#analisar");

async function open(page: Page) {
  await page.route("**/api/leads/start", (route) => route.fulfill({ json: { token: TOKEN } }));
  await page.goto("/");
  await expect(card(page)).toBeVisible();
}

async function answerQuiz(page: Page, picks = LONGEST) {
  for (const [i, pick] of picks.entries()) {
    // espera a pergunta nova montar (a anterior sai com animação)
    const group = page.getByRole("radiogroup", { name: QUESTIONS[i].title });
    await expect(group).toBeVisible();
    await group.getByRole("radio").nth(pick).click();
  }
  await expect(page.getByRole("heading", { name: /pontos? para revisar na sua conta/ })).toBeVisible();
}

async function goToContact(page: Page) {
  await answerQuiz(page);
  await page.getByRole("button", { name: "Receber o relatório completo" }).click();
  await expect(page.getByRole("heading", { name: "Para onde enviamos o relatório?" })).toBeVisible();
}

async function fillContact(page: Page) {
  await page.getByRole("textbox", { name: "Seu nome" }).fill("Maria da Silva Souza");
  await page.getByRole("textbox", { name: "E-mail" }).fill("maria@empresa.com.br");
  await page.getByRole("textbox", { name: "WhatsApp" }).fill("11987654321");
  await page.getByRole("checkbox", { name: /Autorizo o uso dos meus dados/ }).check();
}

/** O card do quiz fica dentro do hero, sem rolagem lateral e (quando pedido) cabendo na tela. */
async function expectCardFits(page: Page, { fitsViewport }: { fitsViewport: boolean }) {
  const c = (await card(page).boundingBox())!;
  const h = (await hero(page).boundingBox())!;
  expect(c.y + c.height).toBeLessThanOrEqual(h.y + h.height);
  const { scrollWidth, innerWidth, innerHeight } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  // 80px = cabeçalho fixo (scroll-mt-20 do card)
  if (fitsViewport) expect(c.height).toBeLessThanOrEqual(innerHeight - 80);
}

test.describe("funil do hero", () => {
  test.beforeEach(async ({ page }) => open(page));

  test("nome completo pode ser digitado letra a letra sem perder o foco", async ({ page }) => {
    await goToContact(page);
    const name = page.getByRole("textbox", { name: "Seu nome" });
    await name.click();
    await page.keyboard.type("Maria da Silva Souza", { delay: 20 });
    await expect(name).toHaveValue("Maria da Silva Souza");
    await expect(name).toBeFocused();

    const email = page.getByRole("textbox", { name: "E-mail" });
    await email.click();
    await page.keyboard.type("maria@empresa.com.br", { delay: 10 });
    await expect(email).toHaveValue("maria@empresa.com.br");

    const phone = page.getByRole("textbox", { name: "WhatsApp" });
    await phone.click();
    await page.keyboard.type("11987654321", { delay: 10 });
    await expect(phone).toHaveValue("(11) 98765-4321");
    await expect(phone).toBeFocused();
  });

  test("resultado destaca o total pago e a devolução em dobro", async ({ page }, info) => {
    await answerQuiz(page);
    const result = card(page);
    await expect(result.getByText("Pago nas últimas 60 faturas (estimativa)")).toBeVisible();
    // R$ 25 mil (ponto médio da faixa) × 60 faturas
    await expect(result.getByText("R$ 1.500.000")).toBeVisible({ timeout: 10_000 });
    await expect(result.getByText(/pode voltar em dobro \(CDC, art\. 42\), pedido direto à distribuidora/)).toBeVisible();
    await expect(result.getByText("+ 2 no relatório completo")).toBeVisible();
    // o resultado entra na tela; o botão principal também, exceto em telas muito baixas (360×640)
    await expect(result.getByText("R$ 1.500.000")).toBeInViewport();
    if (info.project.name !== "mobile-small") await expect(page.getByRole("button", { name: "Receber o relatório completo" })).toBeInViewport();
  });

  test("fluxo completo até o envio da fatura", async ({ page }) => {
    await goToContact(page);
    await expect(card(page).getByText("R$ 1,5 milhão pagos · 5 pontos a verificar")).toBeVisible();

    // envio vazio: mostra os erros e leva o foco ao primeiro campo inválido
    await page.getByRole("button", { name: "Reservar meu diagnóstico" }).click();
    await expect(page.getByText("Informe seu nome")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Seu nome" })).toBeFocused();

    await fillContact(page);
    const request = page.waitForRequest("**/api/leads/start");
    await page.getByRole("button", { name: "Reservar meu diagnóstico" }).click();
    const body = (await request).postDataJSON();
    expect(body).toMatchObject({ name: "Maria da Silva Souza", email: "maria@empresa.com.br", consent: true, billRange: "10k_50k" });

    await expect(page.getByRole("heading", { name: "Maria, falta só a fatura." })).toBeVisible();
    // a faixa de valor já foi respondida no quiz: não pergunta de novo
    await expect(page.getByText("Valor médio mensal da conta")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pelo WhatsApp" })).toHaveAttribute("href", new RegExp(`diagnostico%2F${TOKEN}`));
    await expect(page.getByRole("link", { name: "Enviar depois" })).toHaveAttribute("href", `/diagnostico/${TOKEN}`);
    await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(0);
  });

  test("voltar preserva as respostas", async ({ page }) => {
    await goToContact(page);
    await page.getByRole("textbox", { name: "Seu nome" }).fill("Maria");
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page.getByRole("button", { name: "Receber o relatório completo" })).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    const last = page.getByRole("radiogroup", { name: QUESTIONS[4].title });
    await expect(last.getByRole("radio", { checked: true })).toHaveText(/Não sei/);
    await last.getByRole("radio").nth(2).click();
    await page.getByRole("button", { name: "Receber o relatório completo" }).click();
    await expect(page.getByRole("textbox", { name: "Seu nome" })).toHaveValue("Maria");
  });

  test("setas do teclado navegam entre as opções", async ({ page }) => {
    const group = page.getByRole("radiogroup", { name: QUESTIONS[0].title });
    await group.getByRole("radio").first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio").nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(group.getByRole("radio").last()).toBeFocused();
  });
});

test.describe("tamanho do card no hero", () => {
  test("cada tela do funil cabe no hero, sem rolagem lateral", async ({ page }, info) => {
    // nas telas muito baixas (360×640) o card pode passar da altura da tela, mas não do hero
    const fitsViewport = info.project.name !== "mobile-small";
    await open(page);
    await expectCardFits(page, { fitsViewport });
    await answerQuiz(page);
    await expect(card(page).getByText("R$ 1.500.000")).toBeVisible({ timeout: 10_000 });
    await expectCardFits(page, { fitsViewport });
    await page.getByRole("button", { name: "Receber o relatório completo" }).click();
    await expect(page.getByRole("heading", { name: "Para onde enviamos o relatório?" })).toBeVisible();
    await expectCardFits(page, { fitsViewport });
    await fillContact(page);
    await page.getByRole("button", { name: "Reservar meu diagnóstico" }).click();
    await expect(page.getByRole("button", { name: "Gerar meu Raio-X" })).toBeVisible();
    await expectCardFits(page, { fitsViewport });
  });
});

test.describe("hero", () => {
  test.beforeEach(async ({ page }) => open(page));

  test("aviso de cookies não cobre as opções do quiz nem o título", async ({ page }) => {
    const banner = page.getByRole("region", { name: "Aviso de cookies" });
    await expect(banner).toBeVisible();
    const b = (await banner.boundingBox())!;
    const h1 = (await page.locator("h1").boundingBox())!;
    expect(h1.y < b.y + b.height && h1.y + h1.height > b.y, "título coberto pelo aviso").toBe(false);
    for (const radio of await page.getByRole("radio").all()) {
      const r = (await radio.boundingBox())!;
      const overlaps = r.y < b.y + b.height && r.y + r.height > b.y;
      expect(overlaps, `opção "${await radio.textContent()}" coberta pelo aviso`).toBe(false);
    }
  });

  test("faixa de distribuidoras pode ser pausada", async ({ page }) => {
    const track = page.locator("#analisar .animate-marquee").first();
    await expect(track).toHaveCSS("animation-play-state", "running");
    await page.getByRole("button", { name: "Pausar animação da lista de distribuidoras" }).click();
    await expect(track).toHaveCSS("animation-play-state", "paused");
    await page.getByRole("button", { name: "Retomar animação da lista de distribuidoras" }).click();
    await expect(track).toHaveCSS("animation-play-state", "running");
  });
});

test("com 'reduzir movimento', o valor aparece direto, sem contagem", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await open(page);
  await answerQuiz(page);
  await expect(card(page).getByText("R$ 1.500.000")).toBeVisible({ timeout: 1_000 });
  await context.close();
});

test("atalho discreto volta ao quiz onde a pessoa parou", async ({ page }) => {
  await open(page);
  for (const i of [0, 1]) {
    const group = page.getByRole("radiogroup", { name: QUESTIONS[i].title });
    await expect(group).toBeVisible();
    await group.getByRole("radio").first().click();
  }
  await expect(page.getByRole("radiogroup", { name: QUESTIONS[2].title })).toBeVisible();
  const shortcut = page.getByRole("link", { name: "Continuar diagnóstico · 3/5" }).locator("visible=true");
  await expect(shortcut).toHaveCount(0);

  await page.locator("#faq").scrollIntoViewIfNeeded();
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.getByRole("radiogroup", { name: QUESTIONS[2].title })).toBeInViewport();
  await expect(shortcut).toHaveCount(0);
});

test("áudio do especialista toca e pausa no topo", async ({ page }) => {
  await open(page);
  const play = page.getByRole("button", { name: /Ouvir o especialista/ });
  await expect(play).toBeVisible();
  await play.click();
  const pause = page.getByRole("button", { name: "Pausar o áudio do especialista" });
  await expect(pause).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector("audio")?.currentTime ?? 0), { timeout: 10_000 }).toBeGreaterThan(0.3);
  await pause.click();
  await expect(page.getByRole("button", { name: /Ouvir o especialista/ })).toBeVisible();
});
