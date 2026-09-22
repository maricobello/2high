import type { SolutionCode } from "./types";

/**
 * Catálogo de soluções exibidas no site. O módulo 4 está previsto, mas oculto
 * no lançamento (status "hidden"). Para exibir, mude o status e ligue a flag.
 */
export interface SolutionCatalogItem {
  code: SolutionCode;
  title: string;
  description: string;
  href: string;
  status: "active" | "coming_soon" | "hidden";
}

export const SOLUTIONS: SolutionCatalogItem[] = [
  {
    code: "auditoria",
    title: "Auditoria de fatura",
    description: "Leitura técnica da conta: demanda, energia reativa, estrutura tarifária, variações e compensação.",
    href: "/#analisar",
    status: "active",
  },
  {
    code: "gd_assinatura",
    title: "GD por assinatura",
    description: "Energia de geração compartilhada, sem instalar painéis, quando disponível e aplicável ao seu perfil.",
    href: "/gd-por-assinatura",
    status: "active",
  },
  {
    code: "mercado_livre",
    title: "Mercado Livre de Energia",
    description: "Análise preliminar de perfil para contratar energia diretamente de comercializadoras.",
    href: "/mercado-livre",
    status: "active",
  },
  {
    code: "antecipacao",
    title: "Antecipação de benefício econômico",
    description: "Transforme economia futura em recursos hoje.",
    href: "#",
    status: "hidden",
  },
];

export const visibleSolutions = () => SOLUTIONS.filter((s) => s.status !== "hidden");
