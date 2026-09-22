import { z } from "zod";
import { BILL_RANGES, FREE_MARKET_STATUS, SOLAR_STATUS, UFS } from "./types";

/** Validação de CNPJ (dígitos verificadores). */
export function isValidCnpj(value: string): boolean {
  const c = value.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(c[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const enumOf = <T extends readonly { value: string }[]>(list: T) => z.enum(list.map((i) => i.value) as [T[number]["value"], ...T[number]["value"][]]);

const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 10 || v.length === 11, "Informe um WhatsApp com DDD");

const cnpj = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido");

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  company: z.string().trim().min(2, "Informe a empresa").max(160),
  cnpj,
  phone,
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  state: z.enum(UFS, { message: "Selecione o estado" }),
  city: z.string().trim().min(2, "Informe a cidade").max(120),
  consent: z.literal(true, { message: "É necessário aceitar a política de privacidade" }),
  marketingConsent: z.boolean().optional().default(false),
  /** honeypot anti-bot: deve vir vazio */
  website: z.string().max(0).optional().default(""),
  utm: z.record(z.string(), z.string().max(200)).optional(),
});

export const heroLeadSchema = contactSchema.extend({
  billRange: enumOf(BILL_RANGES),
  solarStatus: enumOf(SOLAR_STATUS),
  freeMarketStatus: enumOf(FREE_MARKET_STATUS),
});
export type HeroLeadInput = z.infer<typeof heroLeadSchema>;

export const gdSimulationSchema = z.object({
  monthlyBill: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  consumptionKwh: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  distributor: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.enum(UFS).optional().nullable(),
  customerClass: z.string().trim().max(60).optional().nullable(),
  consumerUnit: z.string().trim().max(40).optional().nullable(),
  tariffGroup: z.enum(["A", "B"]).optional().nullable(),
});
export type GdSimulationInput = z.infer<typeof gdSimulationSchema>;

export const freeMarketSimulationSchema = z.object({
  distributor: z.string().trim().max(120).optional().nullable(),
  monthlyConsumptionKwh: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  demandKw: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  tariffGroup: z.enum(["A", "B"]).optional().nullable(),
  tariffModality: z.string().trim().max(40).optional().nullable(),
  voltage: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.enum(UFS).optional().nullable(),
  operatingHours: z.enum(["comercial", "estendido", "24h"]).optional().nullable(),
  consumptionProfile: z.enum(["estavel", "sazonal", "variavel"]).optional().nullable(),
  monthlyBill: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
});
export type FreeMarketSimulationInput = z.infer<typeof freeMarketSimulationSchema>;

export const simulatorLeadSchema = contactSchema.extend({
  kind: z.enum(["gd", "free_market"]),
  simulation: z.record(z.string(), z.unknown()),
});
