import "server-only";
import type { InvoiceData } from "@/modules/invoice/types";
import { getLLM, parseJsonResponse } from "../provider";

/**
 * IA como INTERPRETADORA: lê o documento e devolve campos estruturados.
 * Os valores passam depois pela fusão com o regex, conferência no texto e validação.
 */
const SCHEMA_DESCRIPTION = `{
  "distributor": string|null,            // nome da distribuidora
  "consumerUnit": string|null,           // nº da unidade consumidora/instalação
  "customerClass": string|null,          // Comercial, Industrial, Residencial, Rural, Poder Público
  "tariffGroup": "A"|"B"|null,
  "tariffSubgroup": string|null,         // A4, A3, B3...
  "tariffModality": "convencional"|"branca"|"verde"|"azul"|null,
  "voltage": string|null,
  "consumptionKwh": number|null,         // consumo total do período (kWh)
  "consumptionPeakKwh": number|null,
  "consumptionOffPeakKwh": number|null,
  "contractedDemandKw": number|null,
  "measuredDemandKw": number|null,
  "billedDemandKw": number|null,
  "demandOverrunKw": number|null,
  "demandOverrunAmount": number|null,    // R$
  "reactiveEnergyKvarh": number|null,
  "reactiveAmount": number|null,         // R$
  "powerFactor": number|null,            // entre 0 e 1
  "tariffTeKwh": number|null,            // R$/kWh
  "tariffTusdKwh": number|null,          // R$/kWh
  "icmsAmount": number|null,
  "pisCofinsAmount": number|null,
  "publicLightingAmount": number|null,
  "tariffFlag": "verde"|"amarela"|"vermelha_1"|"vermelha_2"|"escassez_hidrica"|null,
  "injectedEnergyKwh": number|null,
  "compensatedEnergyKwh": number|null,
  "creditBalanceKwh": number|null,
  "history": [{"month": "AAAA-MM", "kwh": number}],
  "totalAmount": number|null,            // total a pagar (R$)
  "referenceMonth": "AAAA-MM"|null,
  "billingPeriodStart": "AAAA-MM-DD"|null,
  "billingPeriodEnd": "AAAA-MM-DD"|null,
  "dueDate": "AAAA-MM-DD"|null
}`;

const SYSTEM = `Você é um extrator de dados de faturas de energia elétrica brasileiras.
Responda SOMENTE com um objeto JSON no formato abaixo.
Regras:
- Copie os valores exatamente como aparecem no documento, convertidos para número (ponto como separador decimal).
- NÃO calcule, NÃO estime e NÃO invente valores. Se o campo não estiver explícito, use null.
- Não confunda o CNPJ da distribuidora com dados do cliente.
- Valores monetários em reais, sem símbolo.
Formato:
${SCHEMA_DESCRIPTION}`;

export async function extractInvoiceWithLLM(text: string): Promise<Partial<InvoiceData> | null> {
  const llm = getLLM();
  if (!llm.available || text.trim().length < 50) return null;
  const clipped = text.length > 24000 ? text.slice(0, 24000) : text;
  const raw = await llm.chat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Texto extraído da fatura:\n"""\n${clipped}\n"""` },
    ],
    { tier: "text", json: true, temperature: 0, maxTokens: 1800 },
  );
  return parseJsonResponse<Partial<InvoiceData>>(raw);
}

export async function extractInvoiceWithVision(dataUrl: string): Promise<Partial<InvoiceData> | null> {
  const llm = getLLM();
  if (!llm.available) return null;
  const raw = await llm.chat(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia os dados desta fatura de energia. Responda apenas com JSON." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    { tier: "vision", json: true, temperature: 0, maxTokens: 1800 },
  );
  return parseJsonResponse<Partial<InvoiceData>>(raw);
}
