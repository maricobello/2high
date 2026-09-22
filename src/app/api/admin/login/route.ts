import { cookies } from "next/headers";
import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeEqual, SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/modules/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000).ok) return json({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
    if (!env.adminPassword || !env.authSecret || !env.adminEmail) {
      return json({ error: "Painel não configurado: defina ADMIN_EMAIL, ADMIN_PASSWORD e AUTH_SECRET." }, 503);
    }
    const { email, password } = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(await req.json());
    const ok = safeEqual(email, env.adminEmail) && safeEqual(password, env.adminPassword);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 500));
      return json({ error: "Credenciais inválidas." }, 401);
    }
    const token = await signSession({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }, env.authSecret);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
