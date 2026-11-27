import "server-only";
/**
 * Robô do Orange System (sistema.orangesystem.com.br): entra com o usuário da Replace,
 * mantém a sessão (cookies) e lê páginas e exportações, sem navegador.
 *
 * Credenciais: segredos ORANGE_USUARIO e ORANGE_SENHA (variável de ambiente na Vercel ou
 * tabela privada app_secrets). Nunca aparecem em log, resposta ou código.
 */
import { getSecret } from "@/lib/secrets";

export const ORANGE_URL = "https://sistema.orangesystem.com.br";

export class ErroOrange extends Error {}

export class ClienteOrange {
  private cookies = new Map<string, string>();

  constructor(private base = ORANGE_URL) {}

  private cabecalhoCookie() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private guardarCookies(res: Response) {
    const lista = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
    for (const c of lista) {
      const [par] = c.split(";");
      const i = par.indexOf("=");
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }

  /** Requisição com a sessão; segue redirecionamentos guardando os cookies de cada passo. */
  async pedir(caminho: string, init: RequestInit = {}, passos = 6): Promise<Response> {
    let url = new URL(caminho, this.base).toString();
    let opcoes: RequestInit = init;
    for (let i = 0; i < passos; i++) {
      const res = await fetch(url, {
        ...opcoes,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (rateio-gd)", ...(opcoes.headers as Record<string, string>), Cookie: this.cabecalhoCookie() },
        signal: AbortSignal.timeout(45_000),
      });
      this.guardarCookies(res);
      const destino = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && destino) {
        url = new URL(destino, url).toString();
        opcoes = { method: "GET" };
        continue;
      }
      return res;
    }
    throw new ErroOrange("Redirecionamentos demais no Orange.");
  }

  async texto(caminho: string): Promise<{ url: string; status: number; html: string }> {
    const res = await this.pedir(caminho);
    return { url: res.url || caminho, status: res.status, html: await res.text() };
  }

  async baixar(caminho: string, init: RequestInit = {}): Promise<{ tipo: string; nome: string | null; dados: ArrayBuffer }> {
    const res = await this.pedir(caminho, init);
    if (!res.ok) throw new ErroOrange(`Orange respondeu ${res.status} em ${caminho}.`);
    const disp = res.headers.get("content-disposition") ?? "";
    const nome = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disp)?.[1] ?? null;
    return { tipo: res.headers.get("content-type") ?? "", nome: nome ? decodeURIComponent(nome) : null, dados: await res.arrayBuffer() };
  }

  /** Login pelo formulário (/Login/Login). Confere que a tela de login não voltou. */
  async entrar(usuario: string, senha: string): Promise<void> {
    await this.pedir("/Login/Index");
    const corpo = new URLSearchParams({ U: "", Tx_Email: usuario, Tx_Senha: senha });
    const res = await this.pedir("/Login/Login", { method: "POST", body: corpo.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    const html = await res.text();
    if (/id="loginform"/.test(html)) {
      const msg = mensagemDoOrange(html);
      throw new ErroOrange(`O Orange recusou o login${msg ? ` ("${msg}")` : ""}. ${dicaUsuario(usuario)}`);
    }
  }
}

const decodificar = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .trim();

/** Mensagem que o Orange mostra na tela de login (ex.: "O usuário ou senha inválida"). */
export function mensagemDoOrange(html: string): string | null {
  const m = /<label[^>]*id="msgerro"[^>]*>([\s\S]*?)<\/label>/i.exec(html)?.[1];
  const t = m ? decodificar(m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : "";
  return t || null;
}

/** Dica sem expor o valor: o formato do usuário guardado. */
export function dicaUsuario(usuario: string): string {
  return usuario.includes("@")
    ? "O usuário guardado é um e-mail; se a sua conta entra pelo botão “Entrar com Microsoft”, a senha do formulário pode não existir: teste no navegador em sistema.orangesystem.com.br com usuário e senha (sem o botão Microsoft)."
    : "O usuário guardado é um nome de usuário (sem @); confira se é o mesmo que você digita no campo Usuário do Orange.";
}

/** Tira espaços, quebras de linha e aspas que entram ao colar o valor na Vercel. */
export const limparCredencial = (v: string) => v.replace(/^[\s"'\u200b\ufeff]+|[\s"'\u200b\ufeff]+$/g, "");

/** Cliente já logado com as credenciais guardadas. */
export async function clienteLogado(): Promise<ClienteOrange> {
  const [u, s] = await Promise.all([getSecret("ORANGE_USUARIO"), getSecret("ORANGE_SENHA")]);
  const usuario = limparCredencial(u ?? "");
  const senha = (s ?? "").replace(/^[\r\n]+|[\r\n]+$/g, "");
  if (!usuario || !senha) throw new ErroOrange("Faltam as credenciais do Orange: configure ORANGE_USUARIO e ORANGE_SENHA na Vercel.");
  const c = new ClienteOrange();
  await c.entrar(usuario, senha);
  return c;
}

export async function credenciaisConfiguradas(): Promise<boolean> {
  const [u, s] = await Promise.all([getSecret("ORANGE_USUARIO"), getSecret("ORANGE_SENHA")]);
  return Boolean(u && s);
}
