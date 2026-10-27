// Junta o jogo num HTML único (JS, CSS e fonte embutidos).
// dist/                site e app nativo (com modo offline no site)
// dist/artifact.html   prévia jogável, sem o esqueleto <html>/<head>
// RAJADA_ANALYTICS_URL (opcional): endereço para estatísticas anônimas.
import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const read = (p, enc = "utf8") => readFile(join(root, p), enc);
const exists = (p) => access(join(root, p)).then(() => true, () => false);
const analyticsUrl = process.env.RAJADA_ANALYTICS_URL ?? "";

async function bundle(pwa) {
  const out = await build({
    entryPoints: [join(root, "src/main.js")],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020", "safari14"],
    define: { __PWA__: String(pwa), __ANALYTICS_URL__: JSON.stringify(analyticsUrl) },
    legalComments: "none",
    write: false,
  });
  return out.outputFiles[0].text;
}

let css = await read("style.css");
const fonts = [...css.matchAll(/url\("(fonts\/[^"]+\.woff2)"\)/g)].map((m) => m[1]);
if (!fonts.length) throw new Error("style.css sem fontes para embutir");
for (const file of fonts) {
  const data = (await read(file, null)).toString("base64");
  css = css.replace(`url("${file}")`, () => `url(data:font/woff2;base64,${data})`);
}
const html = await read("index.html");
const STYLE_TAG = '<link rel="stylesheet" href="style.css">';
const SCRIPT_TAG = '<script type="module" src="src/main.js"></script>';
for (const tag of [STYLE_TAG, SCRIPT_TAG]) {
  if (!html.includes(tag)) throw new Error(`index.html sem ${tag}`);
}
const inline = (page, js) =>
  page.replace(STYLE_TAG, () => `<style>${css}</style>`).replace(SCRIPT_TAG, () => `<script>${js}</script>`);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const site = inline(html, await bundle(true));
await writeFile(join(dist, "index.html"), site);

// Prévia: só o corpo, com título e descrição; sem modo offline.
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const description = html.match(/<meta name="description"[^>]*>/)[0];
const artifact = inline(
  `<title>RAJADA</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${description}\n${STYLE_TAG}\n${body}`,
  await bundle(false),
);
await writeFile(join(dist, "artifact.html"), artifact);

const hash = createHash("sha256").update(site).digest("hex").slice(0, 10);
await writeFile(join(dist, "sw.js"), (await read("sw.js")).replace("__CACHE__", `rajada-${hash}`));
for (const file of ["manifest.webmanifest", "icon.svg", "privacidade.html", "og.png"]) {
  if (await exists(file)) await cp(join(root, file), join(dist, file));
}
if (await exists("icons")) await cp(join(root, "icons"), join(dist, "icons"), { recursive: true });

console.log(`dist/index.html ${(site.length / 1024).toFixed(0)} KB · versão ${hash}`);
