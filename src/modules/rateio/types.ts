/**
 * Tipos do módulo de rateio de créditos de geração distribuída (GD).
 * Todos os valores de energia em kWh; consumo, compensação e injeção são médias MENSAIS.
 */

export type Ligacao = "mono" | "bi" | "tri";

/** UC que já está no rateio da usina (vem do Orange / "Unidade Rateio GD"). */
export interface UcAtual {
  /** Chave normalizada (só dígitos, sem zeros à esquerda) para cruzar listas. */
  key: string;
  usina: string;
  idUnidade: string;
  instalacao: string;
  apelido: string;
  subgrupo: string;
  /** Percentual atual do rateio (0 a 100). */
  pctAtual: number;
  saldoKwh: number;
  /** Consumo compensável médio mensal (já líquido do custo de disponibilidade). */
  compensavelKwh: number;
  /** Consumo compensado médio mensal. */
  compensadoKwh: number;
}

/** UC candidata a entrar no rateio (aba "Novas UCs"). */
export interface Candidata {
  key: string;
  instalacao: string;
  apelido: string;
  concessionaria: string;
  mesReferencia: string;
  ligacao: Ligacao | null;
  ligacaoOriginal: string;
  mercado: string;
  status: string;
  mediaKwh: number;
  consumoMinimoKwh: number;
  /** Compensável mensal = média − consumo mínimo. */
  compensavelKwh: number;
  /** Usina GD em que a UC já está, se houver. */
  naUsinaGd: string;
}

export interface ConsumoMes {
  mes: string;
  kwh: number;
}

export interface Usina {
  id: string;
  nome: string;
  distribuidora: string;
  fornecedor: string;
  /** UCs esperadas segundo o calendário (para conferência). */
  ucsCalendario: number | null;
  periodoInicio: string;
  periodoFim: string;
  meses: number;
  energiaContratadaPeriodo: number;
  energiaGeradaPeriodo: number;
  energiaInjetadaPeriodo: number;
  /** Injeção mensal usada na projeção. Se null, usa injetada do período ÷ meses. */
  injecaoMensalProjetada: number | null;
  /** 12 fatores de sazonalidade (jan..dez), média 1. Vazio = sem sazonalidade. */
  perfilSazonal: number[];
  consumoMensal: ConsumoMes[];
  ucs: UcAtual[];
}

export interface Parametros {
  /** Fração do compensável de cada UC que o rateio tenta cobrir (ex.: 0,9 = 90%). */
  cobertura: number;
  /** Em quantos meses o saldo acima da reserva deve ser consumido. */
  horizonteSaldoMeses: number;
  /** Saldo mantido como reserva, em meses de consumo compensável. */
  reservaSaldoMeses: number;
  /** Casas decimais aceitas no percentual. */
  casasDecimais: number;
  /** Percentual mínimo por UC que fica no rateio. */
  pctMinimo: number;
  /** Meses da projeção. */
  mesesSimulacao: number;
  /** Mês (1 a 12) em que o novo rateio começa a valer. */
  mesInicio: number;
  /** Validade dos créditos, em meses. */
  validadeCreditosMeses: number;
  /** Retirar do rateio UCs cujo saldo já cobre o horizonte. */
  permitirRetirar: boolean;
  /** Buscar novas UCs quando sobra injeção. */
  incluirNovasUcs: boolean;
  /** Compensável mínimo (kWh/mês) para uma candidata ser considerada. */
  compensavelMinimoCandidata: number;
  /** Fator de consumo no cenário de estresse (ex.: 0,9 = consumo 10% menor). */
  fatorConsumoEstresse: number;
  /**
   * Como dimensionar novas UCs: "queima" agrega consumo suficiente para gastar o
   * saldo no horizonte; "estrutural" agrega só o que falta para equilibrar a usina
   * sem contar a queima (menos UCs, saldo cai mais devagar).
   */
  dimensionarNovas: "queima" | "estrutural";
}

export const PARAMETROS_PADRAO: Parametros = {
  cobertura: 0.9,
  horizonteSaldoMeses: 12,
  reservaSaldoMeses: 1,
  casasDecimais: 2,
  pctMinimo: 0.01,
  mesesSimulacao: 12,
  mesInicio: 1,
  validadeCreditosMeses: 60,
  permitirRetirar: true,
  incluirNovasUcs: true,
  compensavelMinimoCandidata: 100,
  fatorConsumoEstresse: 0.9,
  dimensionarNovas: "queima",
};

export type Acao = "manter" | "aumentar" | "reduzir" | "retirar" | "incluir";

export interface LinhaRateio {
  key: string;
  origem: "atual" | "nova";
  usina: string;
  idUnidade: string;
  instalacao: string;
  apelido: string;
  subgrupo: string;
  pctAtual: number;
  pctProposto: number;
  saldoKwh: number;
  compensavelKwh: number;
  compensadoKwh: number;
  /** Saldo que a UC deve consumir por mês (acima da reserva, no horizonte). */
  queimaSaldoMensal: number;
  /** Créditos novos de que a UC precisa por mês. */
  necessidadeKwh: number;
  creditoAtualKwh: number;
  creditoPropostoKwh: number;
  /** Saldo em meses de consumo: hoje, no fim da projeção com o rateio atual e com o proposto. */
  mesesSaldoHoje: number | null;
  mesesSaldoFimAtual: number | null;
  mesesSaldoFimProposto: number | null;
  acao: Acao;
  motivo: string;
}

export interface CenarioMes {
  indice: number;
  mes: number;
  injetado: number;
  compensado: number;
  /** Crédito novo que não foi usado no mês (vira saldo). */
  creditoParaSaldo: number;
  /** Consumo compensável que ficou sem crédito. */
  consumoDescoberto: number;
  saldoTotal: number;
}

export interface Cenario {
  meses: CenarioMes[];
  injetadoTotal: number;
  compensadoTotal: number;
  creditoParaSaldoTotal: number;
  consumoDescobertoTotal: number;
  saldoInicial: number;
  saldoFinal: number;
  saldoFinalPorUc: number[];
  /** Compensado ÷ injetado no período (pode passar de 100% quando consome saldo). */
  aproveitamento: number;
  /** Crédito novo usado no próprio mês ÷ injetado. */
  aproveitamentoDireto: number;
}

export type Severidade = "alta" | "media" | "baixa";

export interface Alerta {
  severidade: Severidade;
  codigo: string;
  titulo: string;
  detalhe: string;
  refs?: string[];
}

export interface Indicadores {
  injecaoMensal: number;
  contratadaMensal: number;
  geradaMensal: number;
  consumoMensal: number;
  compensavelTotal: number;
  saldoTotal: number;
  geradaSobreContratada: number | null;
  injetadaSobreContratada: number | null;
  consumoSobreContratada: number | null;
  compensavelSobreInjetada: number | null;
  /** Compensável que falta agregar para absorver a injeção (kWh/mês). */
  compensavelIdealAgregar: number;
  /** Compensável efetivamente agregado com as novas UCs (kWh/mês). */
  compensavelAgregado: number;
  necessidadeTotal: number;
  /** Necessidade sem queima de saldo (como fica a usina depois de gastar o saldo). */
  necessidadeEstrutural: number;
  /** Cobertura média que o rateio proposto entrega (créditos novos ÷ compensável). */
  coberturaMedia: number;
  ucsAtuais: number;
  ucsPropostas: number;
  incluidas: number;
  retiradas: number;
  somaPctAtual: number;
}

export interface CandidataAvaliada {
  candidata: Candidata;
  elegivel: boolean;
  selecionada: boolean;
  usinaDestino: string | null;
  motivo: string;
}

export interface ResultadoUsina {
  usinaId: string;
  usinaNome: string;
  linhas: LinhaRateio[];
  atual: Cenario;
  proposto: Cenario;
  propostoEstresse: Cenario;
  indicadores: Indicadores;
  alertas: Alerta[];
}

export interface ResultadoProjeto {
  usinas: ResultadoUsina[];
  candidatas: CandidataAvaliada[];
}
