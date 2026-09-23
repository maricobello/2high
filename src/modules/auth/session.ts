/**
 * Sessão do painel administrativo: cookie assinado com HMAC-SHA256 (Web Crypto),
 * compatível com o proxy e com as rotas. Sem dependências externas.
 * Para múltiplos usuários/perfis, evoluir para Supabase Auth mantendo esta interface.
 */
export const SESSION_COOKIE = "adm_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface AdminSession {
  email: string;
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(session: AdminSession, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(session)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(token: string | undefined | null, secret: string): Promise<AdminSession | null> {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(secret, payload))) return null;
  try {
    const session = JSON.parse(fromB64url(payload)) as AdminSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export { safeEqual };
