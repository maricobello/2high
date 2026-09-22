import "server-only";
import { env } from "@/lib/env";

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
    private apiKey: string,
    private models: Record<ModelTier, string>,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const tier = opts.tier ?? "text";
    const body: Record<string, unknown> = {
      model: this.models[tier],
      messages,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 1500,
    };
    if (opts.json) body.response_format = { type: "json_object" };

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
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
  if (env.llmProvider === "none" || !env.llmApiKey) {
    cached = new NullProvider();
  } else {
    cached = new OpenAICompatibleProvider(env.llmProvider, env.llmBaseUrl, env.llmApiKey, {
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
