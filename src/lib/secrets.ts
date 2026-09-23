import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Lê um segredo: variável de ambiente primeiro; se ausente, tabela privada
 * `app_secrets` no Supabase (acesso só com service role). Cache de 10 min.
 */
const cache = new Map<string, { value: string | null; at: number }>();
const TTL = 10 * 60_000;

export async function getSecret(key: string): Promise<string | null> {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: string | null = null;
  if (env.dataDriver === "postgres") {
    try {
      const { getSql } = await import("@/modules/db/postgres");
      const [r] = await getSql(env.databaseUrl)`select value from app_secrets where key = ${key}`;
      value = (r?.value as string | undefined) ?? null;
    } catch (err) {
      console.warn(`[secrets] falha ao ler ${key}:`, err instanceof Error ? err.message : err);
    }
  } else if (env.dataDriver === "supabase") {
    try {
      const db = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
      const { data } = await db.from("app_secrets").select("value").eq("key", key).maybeSingle();
      value = (data?.value as string | undefined) ?? null;
    } catch (err) {
      console.warn(`[secrets] falha ao ler ${key}:`, err instanceof Error ? err.message : err);
    }
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}
