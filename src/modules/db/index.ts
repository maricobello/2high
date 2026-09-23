import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { LocalRepository } from "./local";
import { getSql, PostgresRepository } from "./postgres";
import { SupabaseRepository } from "./supabase";
import type { Repository } from "./types";

let repo: Repository | null = null;

export function db(): Repository {
  if (repo) return repo;
  if (env.dataDriver === "postgres") {
    repo = new PostgresRepository(getSql(env.databaseUrl));
  } else if (env.dataDriver === "supabase") {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    repo = new SupabaseRepository(env.supabaseUrl, env.supabaseServiceRoleKey);
  } else {
    if (env.isVercel) console.warn("[db] Driver local em ambiente Vercel: dados são efêmeros. Configure o Supabase.");
    repo = new LocalRepository(path.resolve(env.localDataDir));
  }
  return repo;
}

export type * from "./types";
