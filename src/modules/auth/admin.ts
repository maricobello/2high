import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySession, type AdminSession } from "./session";

/** Defesa em profundidade: além do proxy, cada rota/página admin verifica a sessão. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, env.authSecret);
}

export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Não autorizado");
  }
}
