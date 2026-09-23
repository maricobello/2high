import "server-only";
import { env } from "@/lib/env";
import { getSecret } from "@/lib/secrets";

/**
 * Camada de inferência desacoplada. Qualquer provedor compatível com a API
 * OpenAI Chat Completions funciona (Groq é o padrão). Para trocar de modelo
 * ou provedor, altere apenas variáveis de ambiente ou implemente LLMProvider.
 */
export type ModelTier = "text" | "fast" | "vision";

export type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface ChatOptions {
  tier?: ModelTier;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly available: boolean;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

class OpenAICompatibleProvider implements LLMProvider {
  readonly available = true;
  constructor(
    readonly name: string,
    private baseUrl: string,
    private apiKey: () => Promise<string | null>,
    private models: Record<ModelTier, string>,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const key = await this.apiKey();
    if (!key) throw new Error("Chave de IA não configurada (GROQ_API_KEY).");
    const tier = opts.tier ?? "text";
    const body: Record<string, unknown> = {
      model: this.models[tier],
      messages,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 1500,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    Object.assign(body, reasoningParams(body.model as string));

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(env.llmTimeoutMs),
        });
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
          const retryAfter = Number(res.headers.get("retry-after")) || 0;
          await sleep(Math.min(8000, retryAfter * 1000 || 800 * 2 ** attempt));
          continue;
        }
        if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 500)}`);
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
        const content = json.choices?.[0]?.message?.content ?? "";
        if (env.nodeEnv !== "production") console.info(`[llm] ${this.name}/${this.models[tier]} ok`, json.usage ?? "");
        return content;
      } catch (err) {
        lastError = err;
        if (err instanceof Error && /LLM 4\d\d/.test(err.message) && !/LLM 429/.test(err.message)) break;
        await sleep(600 * 2 ** attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Falha no provedor de IA");
  }
}

class NullProvider implements LLMProvider {
  readonly name = "none";
  readonly available = false;
  async chat(): Promise<string> {
    throw new Error("Nenhum provedor de IA configurado (defina GROQ_API_KEY).");
  }
}

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;
  // Chave: variável de ambiente ou, na falta, tabela app_secrets do Supabase
  const canUseStoredKey = env.dataDriver !== "local";
  if (process.env.LLM_PROVIDER === "none" || (!env.llmApiKey && !canUseStoredKey)) {
    cached = new NullProvider();
  } else {
    const provider = env.llmProvider === "none" ? "groq" : env.llmProvider;
    const keyFn = async () => env.llmApiKey || (await getSecret("GROQ_API_KEY"));
    cached = new OpenAICompatibleProvider(provider, env.llmBaseUrl, keyFn, {
      text: env.llmModelText,
      fast: env.llmModelFast,
      vision: env.llmModelVision,
    });
  }
  return cached;
}

/** Extrai JSON de uma resposta (tolerante a cercas de código). */
export function parseJsonResponse<T = unknown>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = /\{[\s\S]*\}/.exec(cleaned);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Modelos com raciocínio (gpt-oss, qwen3) gastam tokens pensando antes de
 * responder; sem limitar isso, o JSON pode vir vazio ou truncado.
 */
function reasoningParams(model: string): Record<string, string> {
  if (/gpt-oss/i.test(model)) return { reasoning_effort: "low" };
  if (/qwen3|deepseek-r1/i.test(model)) return { reasoning_format: "hidden" };
  return {};
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
