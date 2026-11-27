import "server-only";
/**
 * Mapa da estrutura do Orange (para programar a extração): menus, formulários, campos,
 * opções dos filtros (ex.: lista de usinas) e endereços que as telas chamam via JavaScript.
 * Não leva valores escondidos, tokens nem conteúdo de tabelas: só a forma das telas.
 */
import { ClienteOrange } from "./cliente";

export interface CampoMapa {
  nome: string;
  tipo: string;
  opcoes?: number;
  exemplos?: string[];
}
export interface PaginaMapa {
  caminho: string;
  status: number;
  titulo: string;
  links: { texto: string; href: string }[];
  formularios: { action: string; method: string; campos: CampoMapa[] }[];
  botoes: string[];
  tabelas: string[][];
  scripts: string[];
  endpoints: string[];
}

const limpa = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const attr = (tag: string, nome: string) => new RegExp(`${nome}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1] ?? "";

export function estruturaHtml(caminho: string, status: number, html: string): Omit<PaginaMapa, "endpoints"> {
  const titulo = limpa(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const links = new Map<string, string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], "href");
    if (!href || href.startsWith("#") || href.startsWith("javascript") || /^https?:\/\//i.test(href) && !href.includes("orangesystem")) continue;
    const texto = limpa(m[2]).slice(0, 80);
    if (!links.has(href)) links.set(href, texto);
  }
  const formularios: PaginaMapa["formularios"] = [];
  for (const f of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const campos: CampoMapa[] = [];
    for (const i of f[2].matchAll(/<input\b([^>]*)>/gi)) {
      const nome = attr(i[1], "name") || attr(i[1], "id");
      const tipo = attr(i[1], "type") || "text";
      if (nome && !/verificationtoken/i.test(nome)) campos.push({ nome, tipo });
    }
    for (const s of f[2].matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
      const ops = [...s[2].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => limpa(o[1])).filter(Boolean);
      campos.push({ nome: attr(s[1], "name") || attr(s[1], "id"), tipo: "select", opcoes: ops.length, exemplos: ops.slice(0, 8) });
    }
    formularios.push({ action: attr(f[1], "action"), method: (attr(f[1], "method") || "get").toUpperCase(), campos });
  }
  // selects fora de formulário (filtros montados por JavaScript)
  const soltos: CampoMapa[] = [];
  const semForms = html.replace(/<form\b[\s\S]*?<\/form>/gi, "");
  for (const s of semForms.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const ops = [...s[2].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => limpa(o[1])).filter(Boolean);
    soltos.push({ nome: attr(s[1], "name") || attr(s[1], "id"), tipo: "select", opcoes: ops.length, exemplos: ops.slice(0, 8) });
  }
  for (const i of semForms.matchAll(/<input\b([^>]*)>/gi)) {
    const nome = attr(i[1], "name") || attr(i[1], "id");
    const tipo = attr(i[1], "type") || "text";
    if (nome && tipo !== "hidden") soltos.push({ nome, tipo });
  }
  if (soltos.length) formularios.push({ action: "(sem formulário: filtros da tela)", method: "-", campos: soltos.slice(0, 40) });
  const botoes = [...new Set([...html.matchAll(/<(?:button|a)\b([^>]*)>([\s\S]*?)<\/(?:button|a)>/gi)].map((b) => `${limpa(b[2]).slice(0, 40)} ${attr(b[1], "id") ? `#${attr(b[1], "id")}` : ""}`.trim()).filter((t) => /export|excel|xls|csv|baixar|download|gerar|pesquis|buscar|filtrar/i.test(t)))].slice(0, 30);
  const tabelas = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].slice(0, 5).map((t) => [...t[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((h) => limpa(h[1])).filter(Boolean).slice(0, 40));
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((s) => /controllers|\/js\//i.test(s) && !/jquery|bootstrap|plugins|vendor/i.test(s));
  return { caminho, status, titulo, links: [...links.entries()].map(([href, texto]) => ({ texto, href })).slice(0, 300), formularios, botoes, tabelas, scripts };
}

/** Endereços de ações (/Controller/Acao) citados no HTML ou no JavaScript da tela. */
export function endpointsDe(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(/["'`](\/[A-Z][A-Za-z0-9]+\/[A-Za-z0-9_]+)(?:\?[^"'`]*)?["'`]/g)) out.add(m[1]);
  for (const m of texto.matchAll(/url\s*:\s*["'`]([^"'`]+)["'`]/gi)) if (m[1].startsWith("/")) out.add(m[1].split("?")[0]);
  return [...out].slice(0, 80);
}

export async function mapearPagina(c: ClienteOrange, caminho: string): Promise<PaginaMapa> {
  const { status, html } = await c.texto(caminho);
  const base = estruturaHtml(caminho, status, html);
  const eps = new Set(endpointsDe(html));
  for (const s of base.scripts.slice(0, 6)) {
    try {
      const js = await c.texto(s);
      for (const e of endpointsDe(js.html)) eps.add(e);
    } catch {
      /* script inacessível: segue */
    }
  }
  return { ...base, endpoints: [...eps] };
}

/** Telas de GD e rateio que interessam ao robô. */
const ALVOS = /usina|rateio|unidade|gerencial|gd\b|geracao|energia|fatura|credito|saldo/i;

export async function mapearOrange(c: ClienteOrange, extras: string[] = []): Promise<{ inicio: PaginaMapa; paginas: PaginaMapa[] }> {
  const inicio = await mapearPagina(c, "/");
  const alvos = [...new Set([...extras, "/GestaoUsinaGD/RelatorioGerencial", ...inicio.links.filter((l) => ALVOS.test(`${l.texto} ${l.href}`)).map((l) => l.href)])]
    .filter((h) => h.startsWith("/") && !/logout|sair|login/i.test(h))
    .slice(0, 14);
  const paginas: PaginaMapa[] = [];
  for (const a of alvos) {
    try {
      paginas.push(await mapearPagina(c, a));
    } catch (e) {
      paginas.push({ caminho: a, status: 0, titulo: `erro: ${e instanceof Error ? e.message : "falha"}`, links: [], formularios: [], botoes: [], tabelas: [], scripts: [], endpoints: [] });
    }
  }
  return { inicio, paginas };
}
