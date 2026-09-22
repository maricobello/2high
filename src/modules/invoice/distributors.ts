/**
 * Principais distribuidoras do Brasil e padrões de identificação no texto da fatura.
 * A lista é usada para normalizar o nome; ampliar conforme a operação crescer.
 */
export interface DistributorInfo {
  code: string;
  name: string;
  states: string[];
  patterns: RegExp[];
}

export const DISTRIBUTORS: DistributorInfo[] = [
  { code: "CEMIG", name: "Cemig Distribuição", states: ["MG"], patterns: [/\bcemig\b/i] },
  { code: "ENEL_SP", name: "Enel São Paulo", states: ["SP"], patterns: [/enel\s+(distribui[cç][aã]o\s+)?s[aã]o\s+paulo/i, /eletropaulo/i] },
  { code: "ENEL_RJ", name: "Enel Rio", states: ["RJ"], patterns: [/enel\s+(distribui[cç][aã]o\s+)?rio/i, /\bampla\b/i] },
  { code: "ENEL_CE", name: "Enel Ceará", states: ["CE"], patterns: [/enel\s+(distribui[cç][aã]o\s+)?cear[aá]/i, /\bcoelce\b/i] },
  { code: "ENEL_GO", name: "Equatorial Goiás", states: ["GO"], patterns: [/equatorial\s+goi[aá]s/i, /enel\s+(distribui[cç][aã]o\s+)?goi[aá]s/i, /\bcelg\b/i] },
  { code: "LIGHT", name: "Light", states: ["RJ"], patterns: [/\blight\s+(servi[cç]os|s\.?a)/i, /\blight\b.*eletricidade/i] },
  { code: "CPFL_PAULISTA", name: "CPFL Paulista", states: ["SP"], patterns: [/cpfl\s+paulista/i] },
  { code: "CPFL_PIRATININGA", name: "CPFL Piratininga", states: ["SP"], patterns: [/cpfl\s+piratininga/i] },
  { code: "CPFL_SANTA_CRUZ", name: "CPFL Santa Cruz", states: ["SP", "PR", "MG"], patterns: [/cpfl\s+santa\s+cruz/i] },
  { code: "RGE", name: "RGE Sul", states: ["RS"], patterns: [/\brge\b/i] },
  { code: "CPFL", name: "CPFL Energia", states: ["SP"], patterns: [/\bcpfl\b/i] },
  { code: "COPEL", name: "Copel Distribuição", states: ["PR"], patterns: [/\bcopel\b/i] },
  { code: "CELESC", name: "Celesc Distribuição", states: ["SC"], patterns: [/\bcelesc\b/i] },
  { code: "CEEE", name: "CEEE Equatorial", states: ["RS"], patterns: [/\bceee\b/i] },
  { code: "EQUATORIAL_PA", name: "Equatorial Pará", states: ["PA"], patterns: [/equatorial\s+par[aá]/i, /\bcelpa\b/i] },
  { code: "EQUATORIAL_MA", name: "Equatorial Maranhão", states: ["MA"], patterns: [/equatorial\s+maranh[aã]o/i, /\bcemar\b/i] },
  { code: "EQUATORIAL_PI", name: "Equatorial Piauí", states: ["PI"], patterns: [/equatorial\s+piau[ií]/i] },
  { code: "EQUATORIAL_AL", name: "Equatorial Alagoas", states: ["AL"], patterns: [/equatorial\s+alagoas/i] },
  { code: "EQUATORIAL_AP", name: "CEA Equatorial", states: ["AP"], patterns: [/cea\s+equatorial/i] },
  { code: "COELBA", name: "Neoenergia Coelba", states: ["BA"], patterns: [/\bcoelba\b/i] },
  { code: "CELPE", name: "Neoenergia Pernambuco", states: ["PE"], patterns: [/\bcelpe\b/i, /neoenergia\s+pernambuco/i] },
  { code: "COSERN", name: "Neoenergia Cosern", states: ["RN"], patterns: [/\bcosern\b/i] },
  { code: "NEOENERGIA_BRASILIA", name: "Neoenergia Brasília", states: ["DF"], patterns: [/neoenergia\s+bras[ií]lia/i, /\bceb\b/i] },
  { code: "ELEKTRO", name: "Neoenergia Elektro", states: ["SP", "MS"], patterns: [/\belektro\b/i] },
  { code: "EDP_SP", name: "EDP São Paulo", states: ["SP"], patterns: [/edp\s+s[aã]o\s+paulo/i, /\bbandeirante\b/i] },
  { code: "EDP_ES", name: "EDP Espírito Santo", states: ["ES"], patterns: [/edp\s+esp[ií]rito\s+santo/i, /\bescelsa\b/i] },
  { code: "ENERGISA_MT", name: "Energisa Mato Grosso", states: ["MT"], patterns: [/energisa\s+mato\s+grosso(?!\s+do\s+sul)/i] },
  { code: "ENERGISA_MS", name: "Energisa Mato Grosso do Sul", states: ["MS"], patterns: [/energisa\s+mato\s+grosso\s+do\s+sul/i] },
  { code: "ENERGISA_TO", name: "Energisa Tocantins", states: ["TO"], patterns: [/energisa\s+tocantins/i] },
  { code: "ENERGISA_PB", name: "Energisa Paraíba", states: ["PB"], patterns: [/energisa\s+para[ií]ba/i] },
  { code: "ENERGISA_SE", name: "Energisa Sergipe", states: ["SE"], patterns: [/energisa\s+sergipe/i] },
  { code: "ENERGISA_MG", name: "Energisa Minas Rio", states: ["MG", "RJ"], patterns: [/energisa\s+minas/i] },
  { code: "ENERGISA_RO", name: "Energisa Rondônia", states: ["RO"], patterns: [/energisa\s+rond[oô]nia/i] },
  { code: "ENERGISA_AC", name: "Energisa Acre", states: ["AC"], patterns: [/energisa\s+acre/i] },
  { code: "ENERGISA_SSUL", name: "Energisa Sul-Sudeste", states: ["SP", "PR"], patterns: [/energisa\s+sul[\s-]+sudeste/i] },
  { code: "ENERGISA", name: "Energisa", states: [], patterns: [/\benergisa\b/i] },
  { code: "AMAZONAS", name: "Amazonas Energia", states: ["AM"], patterns: [/amazonas\s+energia/i] },
  { code: "RORAIMA", name: "Roraima Energia", states: ["RR"], patterns: [/roraima\s+energia/i] },
  { code: "SULGIPE", name: "Sulgipe", states: ["SE", "BA"], patterns: [/\bsulgipe\b/i] },
  { code: "DMED", name: "DMED", states: ["MG"], patterns: [/\bdmed\b/i] },
];

export function detectDistributor(text: string): DistributorInfo | null {
  for (const d of DISTRIBUTORS) {
    if (d.patterns.some((p) => p.test(text))) return d;
  }
  return null;
}

export function normalizeDistributorName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const found = detectDistributor(raw);
  return found ? found.name : raw.trim().slice(0, 80);
}

export function distributorOptionsForState(uf: string | null | undefined): DistributorInfo[] {
  if (!uf) return DISTRIBUTORS;
  const scoped = DISTRIBUTORS.filter((d) => d.states.includes(uf));
  return scoped.length ? scoped : DISTRIBUTORS;
}
