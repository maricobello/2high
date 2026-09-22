import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Armazenamento de faturas. Supabase Storage (bucket PRIVADO) em produção;
 * disco local em desenvolvimento. Arquivos nunca ficam públicos: o admin
 * acessa via URL assinada de curta duração ou rota autenticada.
 */
export interface FileStorage {
  save(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
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
  async signedUrl(key: string) {
    return `/api/admin/files?key=${encodeURIComponent(key)}`;
  }
}

let instance: FileStorage | null = null;
export function storage(): FileStorage {
  if (!instance) instance = env.dataDriver === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return instance;
}
