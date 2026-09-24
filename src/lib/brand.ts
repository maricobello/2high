/**
 * Identidade pública da marca. Tudo aqui é seguro para o frontend
 * (somente variáveis NEXT_PUBLIC_*). Troque o nome em NEXT_PUBLIC_BRAND_NAME.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Aferi",
  tagline: "Inteligência de energia para empresas",
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000"),
  /** Número comercial em formato internacional, só dígitos (ex.: 5511999999999). */
  whatsapp: (process.env.NEXT_PUBLIC_COMMERCIAL_WHATSAPP || "").replace(/\D/g, ""),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@example.com",
  dpoEmail: process.env.NEXT_PUBLIC_DPO_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || "privacidade@example.com",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "",
  legalCnpj: process.env.NEXT_PUBLIC_LEGAL_CNPJ || "",
  /** Honorário de êxito exibido na página (ex.: "30%"). Vazio = "uma parte". */
  successFee: (process.env.NEXT_PUBLIC_SUCCESS_FEE || "").trim(),
};

/** Frase do modelo de êxito: só cobra sobre o que for recuperado. */
export function successFeeText(): string {
  return brand.successFee ? `ficamos com ${brand.successFee} do valor recuperado` : "ficamos só com uma parte do valor recuperado";
}

export function whatsappLink(message: string): string | null {
  if (!brand.whatsapp) return null;
  return `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`;
}
