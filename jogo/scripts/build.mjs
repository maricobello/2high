// Junta o jogo num HTML único (JS, CSS e fonte embutidos).
// dist/        site e app nativo (com modo offline)
// dist/artifact.html  prévia jogável, sem o esqueleto <html>/<head>
import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const read = (p, enc = "utf8") => readFile(join(root, p), enc);

async function bundle(pwa) {
  const out = await build({
    entryPoints: [join(root, "src/main.js")],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020", "safari14"],
    define: { __PWA__: String(pwa) },
    write: false,
  });
  return out.outputFiles[0].text;
}

const font = (await read("fonts/unbounded-latin.woff2", null)).toString("base64");
const css = (await read("style.css")).replace(
  'url("fonts/unbounded-latin.woff2")',
  () => `url(data:font/woff2;base64,${font})`,
);
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

const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const description = html.match(/<meta name="description"[^>]*>/)[0];
const artifact = inline(
  `<title>PRUMO</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${description}\n${STYLE_TAG}\n${body}`,
  await bundle(false),
);
await writeFile(join(dist, "artifact.html"), artifact);

const hash = createHash("sha256").update(site).digest("hex").slice(0, 10);
await writeFile(join(dist, "sw.js"), (await read("sw.js")).replace("__CACHE__", `prumo-${hash}`));
await cp(join(root, "manifest.webmanifest"), join(dist, "manifest.webmanifest"));
await cp(join(root, "icon.svg"), join(dist, "icon.svg"));
await cp(join(root, "icons"), join(dist, "icons"), { recursive: true });

console.log(`dist/index.html ${(site.length / 1024).toFixed(0)} KB · versão ${hash}`);
