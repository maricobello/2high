import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { A_POINTS as SITE_A, BOLT_POINTS as SITE_BOLT } from "@/components/site/logo";
import { A_POINTS, BOLT_POINTS, colors } from "../studio/src/brand";

/** Os vídeos e imagens do estúdio usam as mesmas cores e logo do site. */
describe("estúdio de vídeos", () => {
  const css = readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf8");
  // primeiro bloco :root (paleta "confiança"), antes do tema guardado "verde"
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const token = (name: string) => root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

  it.each([
    ["ink", colors.ink],
    ["background", colors.background],
    ["card", colors.card],
    ["foreground", colors.foreground],
    ["muted", colors.muted],
    ["border", colors.border],
    ["primary", colors.primary],
    ["primary-text", colors.primaryText],
    ["primary-foreground", colors.primaryForeground],
    ["volt", colors.volt],
    ["opportunity", colors.opportunity],
    ["attention", colors.attention],
  ])("cor --%s igual à do site", (name, value) => {
    expect(value).toBe(token(name));
  });

  it("logo com a mesma geometria", () => {
    expect(A_POINTS).toBe(SITE_A);
    expect(BOLT_POINTS).toBe(SITE_BOLT);
  });
});
