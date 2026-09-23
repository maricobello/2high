import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { getSql } from "@/modules/db/postgres";

/**
 * Armazenamento de faturas. Supabase Storage (bucket PRIVADO) em produção;
 * disco local em desenvolvimento. Arquivos nunca ficam públicos: o admin
 * acessa via URL assinada de curta duração ou rota autenticada.
 */
export interface FileStorage {
  save(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
  remove(key: string): Promise<void>;
}

class SupabaseStorage implements FileStorage {
  private client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
  async save(key: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(env.storageBucket).upload(key, data, { contentType, upsert: false });
    if (error) throw new Error(`[storage] upload: ${error.message}`);
  }
  async read(key: string) {
    const { data, error } = await this.client.storage.from(env.storageBucket).download(key);
    if (error || !data) throw new Error(`[storage] download: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(key: string) {
    const { error } = await this.client.storage.from(env.storageBucket).remove([key]);
    if (error) throw new Error(`[storage] remove: ${error.message}`);
  }
  async signedUrl(key: string, expiresInSeconds = 300) {
    const { data } = await this.client.storage.from(env.storageBucket).createSignedUrl(key, expiresInSeconds);
    return data?.signedUrl ?? null;
  }
}

class LocalStorage implements FileStorage {
  private root = path.resolve(env.localDataDir, "uploads");
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root)) throw new Error("Caminho inválido");
    return p;
  }
  async save(key: string, data: Buffer) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async read(key: string) {
    return readFile(this.resolve(key));
  }
  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async signedUrl(key: string) {
    return `/api/admin/files?key=${encodeURIComponent(key)}`;
  }
}

/** Faturas guardadas no próprio Postgres (tabela invoice_files). */
class PostgresStorage implements FileStorage {
  private get sql() {
    return getSql(env.databaseUrl);
  }
  async save(key: string, data: Buffer, contentType: string) {
    await this.sql`insert into invoice_files (key, mime_type, content) values (${key}, ${contentType}, ${data}) on conflict (key) do nothing`;
  }
  async read(key: string) {
    const [r] = await this.sql`select content from invoice_files where key = ${key}`;
    if (!r) throw new Error("[storage] arquivo não encontrado");
    return Buffer.from(r.content as Uint8Array);
  }
  async remove(key: string) {
    await this.sql`delete from invoice_files where key = ${key}`;
  }
  async signedUrl(key: string) {
    return `/api/admin/files?key=${encodeURIComponent(key)}`;
  }
}

let instance: FileStorage | null = null;
export function storage(): FileStorage {
  if (!instance) instance = env.dataDriver === "postgres" ? new PostgresStorage() : env.dataDriver === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return instance;
}
