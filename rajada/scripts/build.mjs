// Junta o jogo num HTML único (JS, CSS e fonte embutidos).
// dist/                site e app nativo (com modo offline no site)
// dist/artifact.html   prévia jogável, sem o esqueleto <html>/<head>
// dist/privacidade.html e suporte.html: páginas que as lojas pedem (contato em store/config.json)
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
const { version } = JSON.parse(await read("package.json")); // vale para site, Android e iOS

async function bundle(pwa) {
  const out = await build({
    entryPoints: [join(root, "src/main.js")],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020", "safari14"],
    define: { __PWA__: String(pwa), __ANALYTICS_URL__: JSON.stringify(analyticsUrl), __VERSION__: JSON.stringify(version) },
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
const html = (await read("index.html")).replaceAll("{{VERSAO}}", version);
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

// Privacidade e suporte com o contato e a data de store/config.json.
const config = JSON.parse(await read("store/config.json"));
const email = String(config.email ?? "").trim();
if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) throw new Error(`store/config.json: e-mail inválido (${email})`);
const contato = email
  ? `Escreva para <a href="mailto:${email}">${email}</a>.`
  : "O e-mail de contato será publicado aqui em breve.";
const pages = {};
for (const page of ["privacidade.html", "suporte.html"]) {
  pages[page] = (await read(page)).replaceAll("{{CONTATO}}", () => contato).replaceAll("{{ATUALIZADO}}", () => config.atualizado);
  await writeFile(join(dist, page), pages[page]);
}
if (!email) console.warn("aviso: store/config.json sem e-mail. Preencha antes de enviar às lojas.");

// O nome do cache muda quando qualquer página muda: o modo offline nunca fica com a versão velha.
const pagesCss = await read("paginas.css");
const hash = createHash("sha256").update(site).update(pagesCss).update(Object.values(pages).join("")).digest("hex").slice(0, 10);
const sw = (await read("sw.js")).replace("__CACHE__", `rajada-${hash}`);
if (!sw.includes(`const CACHE = "rajada-${hash}"`)) throw new Error("sw.js: o nome do cache não foi trocado");
await writeFile(join(dist, "sw.js"), sw);
await writeFile(join(dist, "paginas.css"), pagesCss);
for (const file of ["manifest.webmanifest", "icon.svg", "og.png"]) {
  if (await exists(file)) await cp(join(root, file), join(dist, file));
}
if (await exists("icons")) await cp(join(root, "icons"), join(dist, "icons"), { recursive: true });

console.log(`dist/index.html ${(site.length / 1024).toFixed(0)} KB · versão ${hash}`);
