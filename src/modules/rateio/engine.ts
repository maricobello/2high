/**
 * Motor determinístico de rateio de créditos de GD.
 *
 * Metodologia (por usina):
 *  1. Necessidade de cada UC = compensável × cobertura − queima de saldo.
 *     A queima é o saldo acima da reserva dividido pelo horizonte: quem já tem
 *     crédito guardado recebe menos crédito novo até gastar o excesso.
 *  2. Se a soma das necessidades não absorve a injeção, entram novas UCs
 *     (as maiores primeiro; a última é a menor que fecha a conta).
 *  3. O percentual é proporcional à necessidade. Se ainda sobrar injeção,
 *     a sobra vai primeiro para a folga de cada UC (até 100% do compensável).
 *  4. Arredondamento pelo maior resto: soma exatamente 100% e respeita o mínimo.
 *  5. Projeção mês a mês (crédito do mês primeiro, depois saldo) para o rateio
 *     atual, o proposto e um cenário de estresse com consumo menor.
 */
import { round } from "./normalize";
import { estimativaConsumo, resumoConsumo } from "./consumo";
import { limiteNovasPeloContrato } from "./contrato";
import { mesmaDistribuidora, ufDaUsina } from "./distribuidora";
import { constantesObjetivo, refinarRateio, type ItemRefino } from "./refinar";
import { itensValor, pesosValor, SUBGRUPO_CANDIDATA, usaValorPorSubgrupo } from "./valor";
import type {
  Acao,
  Alerta,
  Candidata,
  CandidataAvaliada,
  Cenario,
  CenarioMes,
  Diagnostico,
  Indicadores,
  LinhaRateio,
  OtimizacaoResultado,
  Parametros,
  ResultadoProjeto,
  ResultadoUsina,
  UcAtual,
  Usina,
  Validacao,
} from "./types";
import { norm } from "./normalize";

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

export function injecaoMensal(u: Usina): number {
  if (u.injecaoMensalProjetada != null && u.injecaoMensalProjetada > 0) return u.injecaoMensalProjetada;
  return u.meses > 0 ? u.energiaInjetadaPeriodo / u.meses : 0;
}

/** Injeção de cada mês da projeção (com sazonalidade), a partir do mês de início. */
export function serieInjecao(u: Usina, p: Pick<Parametros, "mesesSimulacao" | "mesInicio">): number[] {
  const E0 = injecaoMensal(u);
  const perfil = normalizarPerfil(u.perfilSazonal);
  return Array.from({ length: Math.max(1, p.mesesSimulacao) }, (_, t) => E0 * perfil[(((Math.round(p.mesInicio) - 1 + t) % 12) + 12) % 12]);
}

/** Fatores de sazonalidade normalizados (média 1). Vazio ou inválido = 1 em todos os meses. */
export function normalizarPerfil(perfil: number[]): number[] {
  if (perfil.length !== 12 || perfil.some((v) => !(v >= 0))) return Array(12).fill(1);
  const media = perfil.reduce((a, b) => a + b, 0) / 12;
  if (media <= 0) return Array(12).fill(1);
  return perfil.map((v) => v / media);
}

/** Hash curto e estável das entradas (para saber se a solução otimizada ainda vale). */
export function chaveEntradas(usinas: Usina[], candidatas: CandidataAvaliada[], p: Parametros): string {
  const s = JSON.stringify([
    usinas.map((u) => [u.id, injecaoMensal(u), u.perfilSazonal, u.distribuidora, limiteNovasPeloContrato(u, p.metaContrato), u.ucs.map((c) => [c.key, c.pctAtual, c.saldoKwh, c.compensavelKwh, c.tarifaKwh ?? 0])]),
    candidatas.filter((c) => c.elegivel).map((c) => [c.candidata.key, c.candidata.compensavelKwh, c.candidata.concessionaria]),
    // a tarifa média só muda o ótimo quando há valores por subgrupo (é o valor padrão dos demais)
    // a cobertura só vale para a regra proporcional (o otimizado não usa): não invalida a otimização
    { ...p, tarifaKwh: usaValorPorSubgrupo(p) || usinas.some((u) => u.ucs.some((c) => c.tarifaKwh)) ? p.tarifaKwh : 0, cobertura: 0, coberturaAutomatica: null },
  ]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

// ---------------------------------------------------------------------------
// Arredondamento

/**
 * Converte pesos em percentuais com `casas` decimais, soma exatamente 100 e
 * mínimo `pctMinimo` para todo peso positivo (método do maior resto).
 */
export function arredondarRateio(pesos: number[], casas: number, pctMinimo: number): number[] {
  const unidade = 10 ** casas;
  const total = 100 * unidade;
  const soma = pesos.reduce((a, w) => a + Math.max(0, w), 0);
  if (soma <= 0) return pesos.map(() => 0);
  const ativos = pesos.map((w) => w > 0);
  const nAtivos = ativos.filter(Boolean).length;
  const minU = Math.min(Math.max(1, Math.round(pctMinimo * unidade)), Math.floor(total / nAtivos));

  const brutos = pesos.map((w) => (w > 0 ? (w / soma) * total : 0));
  const u = brutos.map((b, i) => (ativos[i] ? Math.max(minU, Math.floor(b)) : 0));
  let diff = total - u.reduce((a, b) => a + b, 0);

  if (diff > 0) {
    const ordem = brutos
      .map((b, i) => ({ i, resto: b - Math.floor(b) }))
      .filter(({ i }) => ativos[i])
      .sort((a, b) => b.resto - a.resto || brutos[b.i] - brutos[a.i]);
    for (let k = 0; diff > 0; k = (k + 1) % ordem.length) {
      u[ordem[k].i]++;
      diff--;
    }
  } else if (diff < 0) {
    // mínimos empurraram a soma acima de 100: retira dos maiores
    const ordem = u.map((v, i) => ({ i })).filter(({ i }) => ativos[i]);
    while (diff < 0) {
      ordem.sort((a, b) => u[b.i] - brutos[b.i] - (u[a.i] - brutos[a.i]) || u[b.i] - u[a.i]);
      const alvo = ordem.find(({ i }) => u[i] > minU);
      if (!alvo) break;
      u[alvo.i]--;
      diff++;
    }
  }
  return u.map((v) => v / unidade);
}

// ---------------------------------------------------------------------------
// Simulação

interface UcSim {
  pct: number;
  saldo: number;
  comp: number;
}

export function simular(ucs: UcSim[], usina: Usina, p: Parametros, fatorConsumo = 1): Cenario {
  const E = injecaoMensal(usina);
  const perfil = normalizarPerfil(usina.perfilSazonal);
  const saldos = ucs.map((u) => Math.max(0, u.saldo));
  const saldoPorUcMes: number[][] = ucs.map(() => []);
  const compensadoPorUc = ucs.map(() => 0);
  const saldoInicial = saldos.reduce((a, b) => a + b, 0);
  const meses: CenarioMes[] = [];
  let injetadoTotal = 0;
  let compensadoTotal = 0;
  let paraSaldoTotal = 0;
  let descobertoTotal = 0;
  let diretoTotal = 0;

  for (let t = 0; t < p.mesesSimulacao; t++) {
    const mes = ((((Math.round(p.mesInicio) - 1 + t) % 12) + 12) % 12) + 1;
    const inj = E * perfil[mes - 1];
    let compensado = 0;
    let paraSaldo = 0;
    let descoberto = 0;
    ucs.forEach((u, i) => {
      const credito = (u.pct / 100) * inj;
      const consumo = Math.max(0, u.comp) * fatorConsumo;
      const usoNovo = Math.min(credito, consumo);
      const resto = consumo - usoNovo;
      const usoSaldo = Math.min(saldos[i], resto);
      saldos[i] += credito - usoNovo - usoSaldo;
      compensado += usoNovo + usoSaldo;
      compensadoPorUc[i] += usoNovo + usoSaldo;
      diretoTotal += usoNovo;
      paraSaldo += credito - usoNovo;
      descoberto += resto - usoSaldo;
    });
    saldos.forEach((v, i) => saldoPorUcMes[i].push(v));
    injetadoTotal += inj;
    compensadoTotal += compensado;
    paraSaldoTotal += paraSaldo;
    descobertoTotal += descoberto;
    meses.push({ indice: t + 1, mes, injetado: inj, compensado, creditoParaSaldo: paraSaldo, consumoDescoberto: descoberto, saldoTotal: saldos.reduce((a, b) => a + b, 0) });
  }
  const saldoFinal = saldos.reduce((a, b) => a + b, 0);
  return {
    meses,
    injetadoTotal,
    compensadoTotal,
    creditoParaSaldoTotal: paraSaldoTotal,
    consumoDescobertoTotal: descobertoTotal,
    saldoInicial,
    saldoFinal,
    saldoFinalPorUc: saldos,
    saldoPorUcMes,
    compensadoPorUc,
    saldoAcimaReserva: saldos.reduce((a, v, i) => a + Math.max(0, v - p.reservaSaldoMeses * Math.max(0, ucs[i].comp)), 0),
    aproveitamento: injetadoTotal > 0 ? compensadoTotal / injetadoTotal : 0,
    aproveitamentoDireto: injetadoTotal > 0 ? diretoTotal / injetadoTotal : 0,
  };
}

// ---------------------------------------------------------------------------
// Necessidade por UC

interface Necessidade {
  comp: number;
  queima: number;
  necessidade: number;
  retirar: boolean;
  motivoRetirar: string;
}

function necessidadeUc(u: { compensavelKwh: number; saldoKwh: number }, p: Parametros): Necessidade {
  const comp = Math.max(0, u.compensavelKwh);
  const saldo = Math.max(0, u.saldoKwh);
  if (comp <= 0) {
    return { comp, queima: 0, necessidade: 0, retirar: p.permitirRetirar, motivoRetirar: "Sem consumo compensável" };
  }
  const alvo = comp * p.cobertura;
  // saldo acima da reserva a gastar por mês no horizonte
  const excedente = Math.max(0, saldo - p.reservaSaldoMeses * comp);
  const queima = Math.min(comp, excedente / Math.max(1, p.horizonteSaldoMeses));
  // a margem (1 − cobertura) já sai do saldo; só reduz o crédito novo o que passar dela
  const necessidade = Math.max(0, Math.min(alvo, comp - queima));
  const retirar = p.permitirRetirar && necessidade <= 0;
  return {
    comp,
    queima,
    necessidade,
    retirar,
    motivoRetirar: retirar ? `Saldo de ${fmt(saldo)} kWh cobre ${fmt(saldo / comp, 1)} meses de consumo. Rever no próximo ciclo` : "",
  };
}

function somaNecessidades(u: Usina, p: Parametros): number {
  if (p.dimensionarNovas === "estrutural") return u.ucs.reduce((a, uc) => a + (necessidadeUc(uc, p).retirar ? 0 : Math.max(0, uc.compensavelKwh) * p.cobertura), 0);
  return u.ucs.reduce((a, uc) => a + necessidadeUc(uc, p).necessidade, 0);
}

// ---------------------------------------------------------------------------
// Candidatas

function riscoCandidata(c: Candidata): string | null {
  const ap = norm(c.apelido);
  if (ap.includes("provisori")) return "Endereço provisório";
  if (!ap) return "Sem identificação (Endereço ID)";
  if (!c.ligacao && !c.consumoMinimoKwh) return "Tipo de ligação não informado";
  return null;
}

function avaliarCandidatas(usinas: Usina[], candidatas: Candidata[], p: Parametros): CandidataAvaliada[] {
  const noRateio = new Map<string, string>();
  for (const u of usinas) for (const uc of u.ucs) if (uc.key) noRateio.set(uc.key, u.nome);
  const vistas = new Set<string>();
  return candidatas.map((c) => {
    const base = { candidata: c, selecionada: false, usinaDestino: null };
    if (!c.key) return { ...base, elegivel: false, motivo: "Sem número de UC" };
    if (vistas.has(c.key)) return { ...base, elegivel: false, motivo: "Duplicada na lista de candidatas" };
    vistas.add(c.key);
    if (noRateio.has(c.key)) return { ...base, elegivel: false, motivo: `Já está no rateio da ${noRateio.get(c.key)}` };
    if (c.naUsinaGd.trim()) return { ...base, elegivel: false, motivo: `Já está na usina GD ${c.naUsinaGd}` };
    const st = norm(c.status);
    if (/inativ|deslig|cancel|encerr|suspens/.test(st)) return { ...base, elegivel: false, motivo: `Status: ${c.status}` };
    if (norm(c.mercado).includes("livre")) return { ...base, elegivel: false, motivo: "Mercado livre: confirmar se pode receber créditos" };
    if (c.compensavelKwh < p.compensavelMinimoCandidata)
      return { ...base, elegivel: false, motivo: `Compensável de ${fmt(c.compensavelKwh)} kWh/mês, abaixo do mínimo de ${fmt(p.compensavelMinimoCandidata)}` };
    const risco = riscoCandidata(c);
    return { ...base, elegivel: true, motivo: risco ? `Elegível, com atenção: ${risco}` : "Elegível" };
  });
}

/**
 * Escolhe candidatas para cobrir `falta` (em kWh/mês de necessidade).
 * Maiores primeiro; quando uma candidata já fecha a conta, usa a menor que fecha.
 */
function escolherCandidatas(pool: CandidataAvaliada[], falta: number, p: Parametros): CandidataAvaliada[] {
  const escolhidas: CandidataAvaliada[] = [];
  let resto = falta;
  const grupos = [pool.filter((c) => !riscoCandidata(c.candidata)), pool.filter((c) => riscoCandidata(c.candidata))];
  for (const grupo of grupos) {
    const disp = [...grupo].sort((a, b) => b.candidata.compensavelKwh - a.candidata.compensavelKwh);
    while (resto > 0 && disp.length) {
      const nec = (c: CandidataAvaliada) => c.candidata.compensavelKwh * p.cobertura;
      let idx = -1;
      for (let i = disp.length - 1; i >= 0; i--) {
        if (nec(disp[i]) >= resto) {
          idx = i;
          break;
        }
      }
      if (idx === -1) idx = 0;
      const [c] = disp.splice(idx, 1);
      escolhidas.push(c);
      resto -= nec(c);
    }
    if (resto <= 0) break;
  }
  return escolhidas;
}

// ---------------------------------------------------------------------------
// Análise

export function analisarProjeto(usinas: Usina[], candidatas: Candidata[], p: Parametros, otim?: OtimizacaoResultado | null): ResultadoProjeto {
  const avaliadas = avaliarCandidatas(usinas, candidatas, p);
  const chave = chaveEntradas(usinas, avaliadas, p);
  const novasPorUsina = new Map<string, Candidata[]>();
  const pesosPorUsina = new Map<string, number[]>();
  const usarOtim = p.metodo === "otimizado" && !!otim && otim.chave === chave && !otim.erro;

  if (usarOtim) {
    const porKey = new Map(avaliadas.map((c) => [c.candidata.key, c]));
    for (const u of usinas) {
      const sol = otim.porUsina[u.id];
      if (!sol || sol.pctAtuais.length !== u.ucs.length) continue;
      const novas = sol.novas.map((n) => porKey.get(n.key)).filter((c): c is CandidataAvaliada => !!c && !c.selecionada);
      for (const c of novas) {
        c.selecionada = true;
        c.usinaDestino = u.nome;
        c.motivo = `${c.motivo === "Elegível" ? "Incluída" : c.motivo.replace("Elegível", "Incluída")} na ${u.nome} pela otimização`;
      }
      novasPorUsina.set(u.id, novas.map((c) => c.candidata));
      const pctNovas = new Map(sol.novas.map((n) => [n.key, n.pct]));
      pesosPorUsina.set(u.id, [...sol.pctAtuais, ...novas.map((c) => pctNovas.get(c.candidata.key) ?? 0)]);
    }
  } else if (p.incluirNovasUcs) {
    const faltas = usinas
      .map((u) => {
        // contrato: novas UCs só até a meta de carga (não compensa geração baixa com mais carga)
        const lim = limiteNovasPeloContrato(u, p.metaContrato);
        const falta = injecaoMensal(u) - somaNecessidades(u, p);
        return { u, falta: lim == null ? falta : Math.min(falta, lim * p.cobertura), lim };
      })
      .filter((x) => x.falta > 0)
      .sort((a, b) => b.falta - a.falta);
    for (const { u, falta, lim } of faltas) {
      const uf = ufDaUsina(u);
      const pool = avaliadas.filter((c) => c.elegivel && !c.selecionada && mesmaDistribuidora(c.candidata, u, uf));
      let escolhidas = escolherCandidatas(pool, falta, p);
      // o contrato é teto: o compensável somado das novas não passa do espaço
      if (lim != null) {
        let soma = 0;
        escolhidas = escolhidas.filter((c) => (soma + c.candidata.compensavelKwh <= lim + 1e-6 ? ((soma += c.candidata.compensavelKwh), true) : false));
      }
      for (const c of escolhidas) {
        c.selecionada = true;
        c.usinaDestino = u.nome;
        c.motivo = `${c.motivo === "Elegível" ? "Incluída" : c.motivo.replace("Elegível", "Incluída")} na ${u.nome}`;
      }
      novasPorUsina.set(u.id, escolhidas.map((c) => c.candidata));
    }
  }
  for (const c of avaliadas) if (c.elegivel && !c.selecionada && p.incluirNovasUcs) c.motivo = `${c.motivo}. Não foi necessária neste ciclo`;

  // trava: o otimizado nunca pode sair pior que a regra proporcional (ex.: solver parou no tempo
  // limite com uma solução ruim). Por usina, fica o melhor pelo mesmo critério do otimizador.
  // em R$ quando há tarifa (por UC ou subgrupo): o mesmo critério de lucro do otimizador
  const ponderado = (r: ResultadoUsina, comp: number[]) => {
    const w = pesosValor(itensValor(r), p);
    return comp.reduce((a, k, i) => a + k * (w[i] ?? 1), 0);
  };
  const valor = (r: ResultadoUsina) => 0.6 * ponderado(r, r.proposto.compensadoPorUc) + 0.4 * ponderado(r, r.propostoEstresse.compensadoPorUc) - p.custoNovaUcKwh * r.indicadores.incluidas;
  const resultados = usinas.map((u) => {
    const pesos = pesosPorUsina.get(u.id);
    const r = analisarUsina(u, novasPorUsina.get(u.id) ?? [], p, pesos);
    if (!pesos) return r;
    const prop = analisarUsina(u, [], { ...p, metodo: "proporcional" });
    // só troca quando a regra proporcional é melhor de verdade (empate no teto fica o otimizado)
    const vr = valor(r);
    if (valor(prop) > vr + Math.max(1, Math.abs(vr) * 1e-4)) {
      prop.alertas.unshift({
        severidade: "media",
        codigo: "otimizacao_descartada",
        titulo: "Otimização descartada nesta usina: a regra proporcional rendeu mais",
        detalhe: `${otim?.otimo ? "A solução do otimizador" : "O otimizador parou no tempo limite e a solução que tinha"} compensava ${fmt(r.proposto.compensadoTotal)} kWh em ${p.mesesSimulacao} meses; a regra proporcional compensa ${fmt(prop.proposto.compensadoTotal)} kWh. Ficou a regra proporcional.`,
      });
      return prop;
    }
    return r;
  });
  return {
    usinas: resultados,
    candidatas: avaliadas,
    chave,
    metodo: usarOtim && resultados.some((r) => r.metodo === "otimizado") ? "otimizado" : "proporcional",
  };
}

export function analisarUsina(usina: Usina, novas: Candidata[], p: Parametros, pesosFixos?: number[]): ResultadoUsina {
  const E = injecaoMensal(usina);
  const atuais = usina.ucs.map((uc) => ({ uc, n: necessidadeUc(uc, p) }));
  const novasN = novas.map((c) => ({ c, n: necessidadeUc({ compensavelKwh: c.compensavelKwh, saldoKwh: 0 }, p) }));

  // pesos: necessidade; se sobrar injeção, preenche a folga até 100% do compensável
  const todos = [
    ...atuais.map(({ n }) => n),
    ...novasN.map(({ n }) => n),
  ];
  const N = todos.reduce((a, n) => a + n.necessidade, 0);
  // sem retirada, UC sem necessidade fica no mínimo (peso ínfimo positivo)
  let pesos = todos.map((n) => (n.retirar ? 0 : n.necessidade > 0 ? n.necessidade : Number.MIN_VALUE));
  if (N < E && N > 0) {
    const folga = todos.map((n) => (n.retirar ? 0 : Math.max(0, n.comp - n.queima - n.necessidade)));
    const F = folga.reduce((a, b) => a + b, 0);
    const extra = E - N;
    if (extra <= F && F > 0) {
      pesos = pesos.map((w, i) => w + folga[i] * (extra / F));
    } else {
      const compAtivo = todos.reduce((a, n) => a + (n.retirar ? 0 : n.comp), 0);
      pesos = todos.map((n, i) => (n.retirar ? 0 : pesos[i] + folga[i] + (compAtivo > 0 ? (n.comp / compAtivo) * (extra - F) : 0)));
    }
  }
  if (pesosFixos && pesosFixos.length === todos.length) pesos = pesosFixos.map((w) => (w > 1e-9 ? w : 0));
  // sem nenhuma necessidade (ex.: todas com saldo alto e retirada desligada): mantém o atual
  const semNecessidade = !pesosFixos && todos.every((n) => n.retirar || n.necessidade <= 0);
  let pctProposto = semNecessidade
    ? [...usina.ucs.map((u) => u.pctAtual), ...novas.map(() => 0)]
    : arredondarRateio(pesos, p.casasDecimais, p.pctMinimo);

  // otimizado: refino exato na grade da distribuidora (o arredondamento do ótimo contínuo perde energia)
  let refino: ResultadoUsina["refino"];
  if (pesosFixos && !semNecessidade && E > 0) {
    const vals = pesosValor([...usina.ucs.map((u) => ({ subgrupo: u.subgrupo, tarifa: u.tarifaKwh })), ...novas.map(() => ({ subgrupo: SUBGRUPO_CANDIDATA }))], p);
    const itens: ItemRefino[] = [
      ...usina.ucs.map((u, i) => ({ comp: u.compensavelKwh, saldo: u.saldoKwh, pct0: u.pctAtual, valor: vals[i], reserva: p.reservaSaldoMeses * Math.max(0, u.compensavelKwh), ativo: pesos[i] > 0 })),
      ...novas.map((c, j) => ({ comp: c.compensavelKwh, saldo: 0, pct0: 0, valor: vals[usina.ucs.length + j], reserva: 0, ativo: pesos[usina.ucs.length + j] > 0 })),
    ];
    const ref = refinarRateio(itens, pctProposto, serieInjecao(usina, p), constantesObjetivo(p), p.casasDecimais, p.pctMinimo);
    const esperado = (pct: number[]) => {
      const sim = [...usina.ucs.map((u, i) => ({ pct: pct[i], saldo: u.saldoKwh, comp: u.compensavelKwh })), ...novas.map((c, j) => ({ pct: pct[usina.ucs.length + j], saldo: 0, comp: c.compensavelKwh }))];
      return 0.6 * simular(sim, usina, p).compensadoTotal + 0.4 * simular(sim, usina, p, p.fatorConsumoEstresse).compensadoTotal;
    };
    refino = { trocas: ref.trocas, ganhoObjetivo: ref.depois - ref.antes, ganhoKwh: ref.trocas ? esperado(ref.pct) - esperado(pctProposto) : 0 };
    pctProposto = ref.pct;
  }

  const simAtual = simular(usina.ucs.map((u) => ({ pct: u.pctAtual, saldo: u.saldoKwh, comp: u.compensavelKwh })), usina, p);
  const ucsProp = [
    ...usina.ucs.map((u, i) => ({ pct: pctProposto[i], saldo: u.saldoKwh, comp: u.compensavelKwh })),
    ...novas.map((c, j) => ({ pct: pctProposto[usina.ucs.length + j], saldo: 0, comp: c.compensavelKwh })),
  ];
  const simProp = simular(ucsProp, usina, p);
  const simEstresse = simular(ucsProp, usina, p, p.fatorConsumoEstresse);

  const tolerancia = 10 ** -p.casasDecimais / 2;
  const meses = (saldo: number, comp: number) => (comp > 0 ? saldo / comp : null);

  const linhas: LinhaRateio[] = [
    ...atuais.map(({ uc, n }, i): LinhaRateio => {
      const pct = pctProposto[i];
      const delta = pct - uc.pctAtual;
      let acao: Acao;
      let motivo: string;
      if (pct === 0 && (n.retirar || (pesosFixos && uc.pctAtual > 0))) {
        acao = "retirar";
        motivo = pesosFixos ? motivoRetiradaOtim(uc, simProp.saldoFinalPorUc[i]) : n.motivoRetirar;
      } else {
        acao = Math.abs(delta) < tolerancia ? "manter" : delta > 0 ? "aumentar" : "reduzir";
        motivo = pesosFixos ? motivoOtim(uc.compensavelKwh, uc.saldoKwh, (uc.pctAtual / 100) * E, (pct / 100) * E, simAtual.saldoFinalPorUc[i], simProp.saldoFinalPorUc[i]) : motivoUc(uc, n, p);
      }
      return {
        key: uc.key,
        origem: "atual",
        usina: uc.usina || usina.nome,
        idUnidade: uc.idUnidade,
        instalacao: uc.instalacao,
        apelido: uc.apelido,
        subgrupo: uc.subgrupo,
        tarifaKwh: uc.tarifaKwh ?? null,
        pctAtual: uc.pctAtual,
        pctProposto: pct,
        saldoKwh: uc.saldoKwh,
        compensavelKwh: uc.compensavelKwh,
        compensadoKwh: uc.compensadoKwh,
        consumoMinimoKwh: uc.consumoMinimoKwh ?? null,
        queimaSaldoMensal: n.queima,
        necessidadeKwh: n.necessidade,
        creditoAtualKwh: (uc.pctAtual / 100) * E,
        creditoPropostoKwh: (pct / 100) * E,
        mesesSaldoHoje: meses(uc.saldoKwh, uc.compensavelKwh),
        mesesSaldoFimAtual: meses(simAtual.saldoFinalPorUc[i], uc.compensavelKwh),
        mesesSaldoFimProposto: meses(simProp.saldoFinalPorUc[i], uc.compensavelKwh),
        acao,
        motivo,
        diagnostico: diagnosticarUc(uc, E, simAtual.saldoFinalPorUc[i], p),
        aproveitamentoHistorico: uc.compensavelKwh > 0 && uc.compensadoKwh > 0 ? uc.compensadoKwh / uc.compensavelKwh : null,
      };
    }),
    ...novasN.map(({ c, n }, j): LinhaRateio => {
      const i = usina.ucs.length + j;
      return {
        key: c.key,
        origem: "nova",
        usina: usina.nome,
        idUnidade: "",
        instalacao: c.instalacao,
        apelido: c.apelido,
        subgrupo: "B",
        pctAtual: 0,
        pctProposto: pctProposto[i],
        saldoKwh: 0,
        compensavelKwh: c.compensavelKwh,
        compensadoKwh: 0,
        consumoMinimoKwh: c.consumoMinimoKwh,
        queimaSaldoMensal: 0,
        necessidadeKwh: n.necessidade,
        creditoAtualKwh: 0,
        creditoPropostoKwh: (pctProposto[i] / 100) * E,
        mesesSaldoHoje: 0,
        mesesSaldoFimAtual: null,
        mesesSaldoFimProposto: meses(simProp.saldoFinalPorUc[i], c.compensavelKwh),
        acao: "incluir",
        motivo: `Nova UC: média de ${fmt(c.mediaKwh)} kWh − mínimo de ${fmt(c.consumoMinimoKwh)} = ${fmt(c.compensavelKwh)} kWh/mês compensáveis. Recebe ${fmt((pctProposto[i] / 100) * E)} kWh/mês`,
        diagnostico: { classe: "nova", rotulo: "Nova", texto: "Entra no rateio para absorver crédito que viraria saldo." },
        aproveitamentoHistorico: null,
      };
    }),
  ];

  const indicadores = calcularIndicadores(usina, linhas, N, p);
  const alertas = gerarAlertas(usina, linhas, indicadores, simAtual, simProp, simEstresse, p, novas);
  const ativos = pesos.filter((w) => w > 0).length;
  if (!semNecessidade && ativos > 100 * 10 ** p.casasDecimais)
    alertas.unshift({
      severidade: "alta",
      codigo: "casas_insuficientes",
      titulo: `Casas decimais insuficientes para ${ativos} UCs`,
      detalhe: `Com ${p.casasDecimais} casa(s) decimal(is) cabem no máximo ${100 * 10 ** p.casasDecimais} UCs com percentual; algumas ficaram com 0%. Aumente as casas decimais nos parâmetros.`,
    });

  const validacoes = validarRateio(usina, linhas, indicadores, simAtual, simProp, simEstresse, p);
  return { metodo: pesosFixos ? "otimizado" : "proporcional", refino, validacoes, usinaId: usina.id, usinaNome: usina.nome, linhas, atual: simAtual, proposto: simProp, propostoEstresse: simEstresse, indicadores, alertas };
}

function motivoOtim(comp: number, saldo: number, credAtual: number, credProp: number, fimAtual: number, fimProp: number): string {
  if (comp <= 0) return "Sem consumo compensável: fica no percentual mínimo";
  const m = (v: number) => fmt(v / comp, 1);
  return `Consumo compensável de ${fmt(comp)} kWh/mês e saldo de ${m(saldo)} meses. Crédito ${fmt(credAtual)} → ${fmt(credProp)} kWh/mês; saldo no fim ${m(fimAtual)} → ${m(fimProp)} meses`;
}

function motivoRetiradaOtim(uc: UcAtual, fimProp: number): string {
  if (uc.compensavelKwh <= 0) return "Sem consumo compensável: todo crédito viraria saldo";
  return `Saldo de ${fmt(uc.saldoKwh)} kWh (${fmt(uc.saldoKwh / uc.compensavelKwh, 1)} meses) cobre o consumo; sem crédito novo termina com ${fmt(fimProp / uc.compensavelKwh, 1)} meses. Rever no próximo ciclo`;
}

/** Situação da UC no rateio atual. */
export function diagnosticarUc(uc: UcAtual, E: number, saldoFimAtual: number, p: Parametros): Diagnostico {
  const comp = uc.compensavelKwh;
  const cred = (uc.pctAtual / 100) * E;
  if (comp <= 0) return { classe: "sem_consumo", rotulo: "Sem consumo", texto: "Não tem consumo compensável: todo crédito que recebe vira saldo." };
  const mesesHoje = uc.saldoKwh / comp;
  if (mesesHoje > p.validadeCreditosMeses)
    return { classe: "risco_vencimento", rotulo: "Risco de vencer", texto: `Saldo para ${fmt(mesesHoje)} meses, acima da validade de ${p.validadeCreditosMeses} meses: parte tende a vencer.` };
  if (mesesHoje > p.horizonteSaldoMeses)
    return { classe: "saldo_encalhado", rotulo: "Saldo parado", texto: `Saldo para ${fmt(mesesHoje, 1)} meses de consumo. Precisa de pouco ou nenhum crédito novo.` };
  if (cred > comp * 1.05)
    return { classe: "sobreatendida", rotulo: "Recebe demais", texto: `Recebe ${fmt(cred)} kWh/mês para ${fmt(comp)} de consumo: ${fmt(((cred - comp) / comp) * 100)}% vira saldo todo mês.` };
  const usoSaldo = Math.min(uc.saldoKwh / Math.max(1, p.mesesSimulacao), Math.max(0, comp - cred));
  if (cred + usoSaldo < comp * p.cobertura * 0.85 && saldoFimAtual < comp)
    return { classe: "subatendida", rotulo: "Recebe pouco", texto: `Crédito cobre ${fmt(((cred + usoSaldo) / comp) * 100)}% do consumo compensável; o resto é comprado da distribuidora.` };
  return { classe: "equilibrada", rotulo: "Equilibrada", texto: `Crédito cobre ${fmt(Math.min(100, (cred / comp) * 100))}% do consumo e o saldo está em ${fmt(mesesHoje, 1)} meses.` };
}

/** Checagens do rateio proposto antes de enviar. */
function validarRateio(u: Usina, linhas: LinhaRateio[], ind: Indicadores, atual: Cenario, prop: Cenario, estresse: Cenario, p: Parametros): Validacao[] {
  const v: Validacao[] = [];
  const f = 10 ** p.casasDecimais;
  const soma = Math.round(linhas.reduce((a, l) => a + l.pctProposto, 0) * f) / f;
  v.push({ ok: soma === 100, nivel: "erro", titulo: "Soma do rateio = 100%", detalhe: `Soma: ${fmt(soma, p.casasDecimais)}%.` });
  const ativos = linhas.filter((l) => l.pctProposto > 0);
  const foraCasas = ativos.filter((l) => Math.abs(l.pctProposto * f - Math.round(l.pctProposto * f)) > 1e-6);
  const abaixoMin = ativos.filter((l) => l.pctProposto < p.pctMinimo - 1e-9);
  v.push({ ok: !foraCasas.length && !abaixoMin.length, nivel: "erro", titulo: `Percentuais com ${p.casasDecimais} casas e mínimo de ${fmt(p.pctMinimo, p.casasDecimais)}%`, detalhe: foraCasas.length || abaixoMin.length ? `${foraCasas.length + abaixoMin.length} UC(s) fora da regra.` : `${ativos.length} UCs conferidas.` });
  const semNumero = linhas.filter((l) => !l.key || l.key.length < 6);
  const keys = new Map<string, number>();
  for (const l of linhas) keys.set(l.key, (keys.get(l.key) ?? 0) + 1);
  const dup = [...keys.values()].filter((n) => n > 1).length;
  v.push({ ok: !semNumero.length && !dup, nivel: "erro", titulo: "Instalações válidas e sem repetição", detalhe: semNumero.length || dup ? `${semNumero.length} sem número válido, ${dup} repetida(s).` : "Todas com número e sem duplicidade." });
  const semConsumo = ativos.filter((l) => l.compensavelKwh <= 0 && l.pctProposto > p.pctMinimo + 1e-9);
  v.push({ ok: !semConsumo.length, nivel: "erro", titulo: "Nenhuma UC sem consumo acima do mínimo", detalhe: semConsumo.length ? `${semConsumo.length} UC(s) sem consumo recebem mais que o mínimo.` : "Ok." });
  const vencer = linhas.filter((l, i) => l.compensavelKwh > 0 && prop.saldoFinalPorUc[i] / l.compensavelKwh > p.validadeCreditosMeses);
  v.push({ ok: !vencer.length, nivel: "aviso", titulo: `Nenhuma UC termina com saldo acima de ${p.validadeCreditosMeses} meses`, detalhe: vencer.length ? `${vencer.length} UC(s) ainda com saldo que tende a vencer (o saldo já existia).` : "Ok." });
  const acumula = ativos.filter((l) => l.compensavelKwh > 0 && l.creditoPropostoKwh > l.compensavelKwh * 1.02);
  v.push({ ok: !acumula.length, nivel: "aviso", titulo: "Nenhuma UC recebe mais crédito que o consumo", detalhe: acumula.length ? `${acumula.length} UC(s) recebem mais que consomem (sobra injeção na usina).` : "Ok." });
  v.push({ ok: prop.saldoFinal <= atual.saldoFinal + 1, nivel: "erro", titulo: "Saldo projetado não piora em relação ao atual", detalhe: `Fim da projeção: ${fmt(atual.saldoFinal)} → ${fmt(prop.saldoFinal)} kWh.` });
  v.push({ ok: prop.consumoDescobertoTotal <= atual.consumoDescobertoTotal * 1.05 + 1, nivel: "aviso", titulo: "Consumo sem crédito não aumenta", detalhe: `${fmt(atual.consumoDescobertoTotal)} → ${fmt(prop.consumoDescobertoTotal)} kWh no período.` });
  v.push({ ok: estresse.saldoFinal <= Math.max(estresse.saldoInicial, atual.saldoFinal), nivel: "aviso", titulo: `Robusto com consumo ${fmt((1 - p.fatorConsumoEstresse) * 100)}% menor`, detalhe: `Saldo no estresse termina em ${fmt(estresse.saldoFinal)} kWh (hoje: ${fmt(estresse.saldoInicial)}).` });
  if (u.ucsCalendario != null) {
    const n = linhas.filter((l) => l.origem === "atual").length;
    v.push({ ok: u.ucsCalendario === n, nivel: "aviso", titulo: "Lista confere com o calendário", detalhe: `Calendário: ${u.ucsCalendario} UCs; lista: ${n}.` });
  }
  v.push({ ok: ind.injecaoMensal > 0, nivel: "erro", titulo: "Injeção da usina informada", detalhe: `${fmt(ind.injecaoMensal)} kWh/mês.` });
  return v;
}

function motivoUc(uc: UcAtual, n: Necessidade, p: Parametros): string {
  if (n.comp <= 0) return "Sem consumo compensável: mantida no mínimo";
  const pctCob = `${fmt(p.cobertura * 100)}%`;
  const saldoTxt = `Saldo de ${fmt(uc.saldoKwh)} kWh (${fmt(uc.saldoKwh / n.comp, 1)} meses)`;
  if (n.queima > n.comp * (1 - p.cobertura)) {
    return `${saldoTxt}: gasta ${fmt(n.queima)} kWh/mês do saldo acima da reserva e recebe ${fmt(n.necessidade)} kWh/mês de crédito novo`;
  }
  if (n.queima > 0) return `${saldoTxt}: o excesso sai pela margem de ${fmt((1 - p.cobertura) * 100)}%; recebe até ${pctCob} do compensável`;
  return `Saldo dentro da reserva: recebe até ${pctCob} do compensável (${fmt(n.comp)} kWh/mês)`;
}

function calcularIndicadores(u: Usina, linhas: LinhaRateio[], N: number, p: Parametros): Indicadores {
  const E = injecaoMensal(u);
  const m = u.meses > 0 ? u.meses : 1;
  const contratada = u.energiaContratadaPeriodo / m;
  const gerada = u.energiaGeradaPeriodo / m;
  // energia consumida no período (Relatório Gerencial GD): média das competências digitadas;
  // sem nenhuma, estima pela soma do compensável das UCs
  const res = resumoConsumo(u);
  const consumoEstimado = res.informados === 0;
  const consumo = consumoEstimado ? estimativaConsumo(u) : res.media;
  const atuais = linhas.filter((l) => l.origem === "atual");
  const compAtual = atuais.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0);
  const necAtual = atuais.reduce((a, l) => a + l.necessidadeKwh, 0);
  const novas = linhas.filter((l) => l.origem === "nova");
  const ativas = linhas.filter((l) => l.pctProposto > 0);
  const compAtivas = ativas.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0);
  const div = (a: number, b: number) => (b > 0 ? a / b : null);
  return {
    injecaoMensal: E,
    contratadaMensal: contratada,
    geradaMensal: gerada,
    consumoMensal: consumo,
    consumoEstimado,
    compensavelTotal: compAtual,
    saldoTotal: atuais.reduce((a, l) => a + Math.max(0, l.saldoKwh), 0),
    geradaSobreContratada: div(gerada, contratada),
    injetadaSobreContratada: div(E, contratada),
    consumoSobreContratada: div(consumo, contratada),
    compensavelSobreInjetada: div(compAtual, E),
    compensavelIdealAgregar: Math.max(0, (E - necAtual) / p.cobertura),
    compensavelAgregado: novas.reduce((a, l) => a + l.compensavelKwh, 0),
    necessidadeTotal: N,
    necessidadeEstrutural: ativas.reduce((a, l) => a + Math.max(0, l.compensavelKwh) * p.cobertura, 0),
    coberturaMedia: compAtivas > 0 ? Math.min(E, ativas.reduce((a, l) => a + l.creditoPropostoKwh, 0)) / compAtivas : 0,
    ucsAtuais: atuais.length,
    ucsPropostas: ativas.length,
    incluidas: novas.length,
    retiradas: linhas.filter((l) => l.acao === "retirar").length,
    somaPctAtual: round(atuais.reduce((a, l) => a + l.pctAtual, 0), 4),
  };
}

function gerarAlertas(
  u: Usina,
  linhas: LinhaRateio[],
  ind: Indicadores,
  atual: Cenario,
  prop: Cenario,
  estresse: Cenario,
  p: Parametros,
  novas: Candidata[],
): Alerta[] {
  const a: Alerta[] = [];
  const atuais = linhas.filter((l) => l.origem === "atual");

  // ultrapassagem de demanda da usina (fatura)
  const dm = u.demanda;
  if (dm && ((dm.ultrapassagemKw ?? 0) > 0 || (dm.despesaUltrapassagem ?? 0) > 0)) {
    const sug = dm.registradaKw != null ? Math.ceil(dm.registradaKw / 10) * 10 : null;
    a.push({
      severidade: "alta",
      codigo: "ultrapassagem_demanda",
      titulo: `Ultrapassagem de demanda na usina${dm.despesaUltrapassagem ? `: R$ ${dm.despesaUltrapassagem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} no mês` : ""}`,
      detalhe: `Demanda contratada de ${fmt(dm.contratadaKw ?? 0)} kW e registrada de ${fmt(dm.registradaKw ?? 0)} kW${dm.ultrapassagemKw ? ` (${fmt(dm.ultrapassagemKw)} kW acima)` : ""}. Não muda o rateio, mas é custo da usina todo mês: avaliar com a distribuidora o aumento da demanda contratada${sug ? ` para cerca de ${fmt(sug)} kW` : ""}.`,
    });
  }

  if (!atuais.length) a.push({ severidade: "alta", codigo: "sem_ucs", titulo: "Nenhuma UC no rateio", detalhe: "Importe a lista de UCs da usina (Unidade Rateio GD)." });
  if (ind.injecaoMensal <= 0)
    a.push({ severidade: "alta", codigo: "sem_injecao", titulo: "Injeção não informada", detalhe: "Informe a energia injetada no período e o número de meses, ou a injeção mensal projetada." });
  if (atuais.length && Math.abs(ind.somaPctAtual - 100) > 0.05)
    a.push({ severidade: "alta", codigo: "soma_atual", titulo: `O rateio atual soma ${fmt(ind.somaPctAtual, 2)}%`, detalhe: "A lista importada pode estar incompleta ou ter UCs de outra usina." });

  const dup = new Map<string, number>();
  for (const l of atuais) if (l.key) dup.set(l.key, (dup.get(l.key) ?? 0) + 1);
  const dups = [...dup.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dups.length) a.push({ severidade: "alta", codigo: "duplicadas", titulo: `${dups.length} UC(s) repetida(s) na lista`, detalhe: "A mesma instalação aparece mais de uma vez.", refs: atuais.filter((l) => dups.includes(l.key)).map((l) => l.apelido || l.instalacao) });

  if (u.energiaGeradaPeriodo > 0 && u.energiaInjetadaPeriodo > u.energiaGeradaPeriodo * 1.02)
    a.push({
      severidade: "media",
      codigo: "injetada_maior",
      titulo: "Injeção maior que a geração no período",
      detalhe: `Injetada ${fmt(u.energiaInjetadaPeriodo)} kWh e gerada ${fmt(u.energiaGeradaPeriodo)} kWh. Confira se a geração está completa antes de enviar o estudo.`,
    });

  const semConsumo = atuais.filter((l) => l.pctAtual > 0 && l.compensavelKwh <= 0);
  if (semConsumo.length)
    a.push({ severidade: "alta", codigo: "sem_consumo", titulo: `${semConsumo.length} UC(s) recebem crédito sem consumo compensável`, detalhe: "Todo crédito dessas UCs vira saldo.", refs: semConsumo.map((l) => l.apelido || l.instalacao) });

  const vencer = atuais.filter((l) => (l.mesesSaldoHoje ?? 0) > p.validadeCreditosMeses);
  if (vencer.length)
    a.push({
      severidade: "alta",
      codigo: "saldo_vencer",
      titulo: `${vencer.length} UC(s) com saldo para mais de ${p.validadeCreditosMeses} meses`,
      detalhe: "Parte desse crédito tende a vencer antes de ser usada. Avalie retirar a UC do rateio ou aumentar o consumo atendido por ela.",
      refs: vencer.map((l) => `${l.apelido || l.instalacao} (${fmt(l.mesesSaldoHoje ?? 0, 0)} meses)`),
    });
  const saldoAlto = atuais.filter((l) => (l.mesesSaldoHoje ?? 0) > p.horizonteSaldoMeses && (l.mesesSaldoHoje ?? 0) <= p.validadeCreditosMeses);
  if (saldoAlto.length)
    a.push({ severidade: "media", codigo: "saldo_alto", titulo: `${saldoAlto.length} UC(s) com saldo acima de ${p.horizonteSaldoMeses} meses de consumo`, detalhe: "Essas UCs recebem pouco ou nenhum crédito novo até gastar o excesso.", refs: saldoAlto.map((l) => l.apelido || l.instalacao) });

  const sobra = ind.injecaoMensal - ind.necessidadeTotal;
  const compProposto = linhas.filter((l) => l.pctProposto > 0).reduce((s, l) => s + l.compensavelKwh, 0);
  if (ind.injecaoMensal > compProposto * 1.0001 && ind.injecaoMensal > 0)
    a.push({
      severidade: "alta",
      codigo: "sobra_injecao",
      titulo: "Sobra injeção mesmo com o novo rateio",
      detalhe: `A injeção (${fmt(ind.injecaoMensal)} kWh/mês) passa do compensável das UCs (${fmt(compProposto)} kWh/mês). Agregue cerca de ${fmt((ind.injecaoMensal - compProposto) / p.cobertura)} kWh/mês de compensável para não acumular saldo.`,
    });
  else if (sobra > 0 && !novas.length && p.incluirNovasUcs)
    a.push({
      severidade: "media",
      codigo: "margem_consumida",
      titulo: "Rateio usa a margem de segurança",
      detalhe: `Sem novas UCs, a injeção ocupa parte da margem de ${fmt((1 - p.cobertura) * 100)}% do compensável. Agregar cerca de ${fmt(ind.compensavelIdealAgregar)} kWh/mês de compensável devolve a margem.`,
    });

  const queimaTotal = linhas.reduce((s, l) => s + l.queimaSaldoMensal, 0);
  if (queimaTotal > 0 && ind.necessidadeEstrutural > ind.injecaoMensal * 1.1)
    a.push({
      severidade: "media",
      codigo: "pos_queima",
      titulo: "Rever o rateio quando o saldo baixar",
      detalhe: `O rateio usa ${fmt(queimaTotal)} kWh/mês de saldo. Depois que o saldo acabar, as UCs vão precisar de ${fmt(ind.necessidadeEstrutural)} kWh/mês e a usina injeta ${fmt(ind.injecaoMensal)}: a cobertura cai para cerca de ${fmt((ind.injecaoMensal / ind.necessidadeEstrutural) * p.cobertura * 100)}% do compensável. Nesse momento, retire UCs ou realoque para outra usina.`,
    });

  if (ind.coberturaMedia > 0 && ind.coberturaMedia < 0.7)
    a.push({
      severidade: "media",
      codigo: "cobertura_baixa",
      titulo: `A usina cobre só ${fmt(ind.coberturaMedia * 100)}% do compensável das UCs`,
      detalhe: "O consumo é bem maior que a injeção. Avalie transferir UCs para uma usina com sobra.",
    });

  if (u.ucsCalendario != null && atuais.length && u.ucsCalendario !== atuais.length)
    a.push({ severidade: "media", codigo: "calendario_ucs", titulo: `Calendário indica ${u.ucsCalendario} UCs e a lista tem ${atuais.length}`, detalhe: "Confira se o export do Orange veio completo." });

  const crescimentoEstresse = estresse.saldoFinal - estresse.saldoInicial;
  if (crescimentoEstresse > 0 && prop.saldoFinal <= prop.saldoInicial)
    a.push({
      severidade: "baixa",
      codigo: "estresse",
      titulo: `Com consumo ${fmt((1 - p.fatorConsumoEstresse) * 100)}% menor, o saldo cresceria`,
      detalhe: `No cenário de estresse o saldo sobe ${fmt(crescimentoEstresse)} kWh em ${p.mesesSimulacao} meses. No proposto, ${prop.saldoFinal <= prop.saldoInicial ? "cai" : "sobe"} ${fmt(Math.abs(prop.saldoFinal - prop.saldoInicial))} kWh.`,
    });

  const noMinimo = linhas.filter((l) => l.pctProposto > 0 && l.pctProposto <= p.pctMinimo && l.necessidadeKwh < (p.pctMinimo / 100) * ind.injecaoMensal);
  if (noMinimo.length)
    a.push({ severidade: "baixa", codigo: "pct_minimo", titulo: `${noMinimo.length} UC(s) no percentual mínimo`, detalhe: `Precisam de menos que ${fmt(p.pctMinimo, p.casasDecimais)}% da injeção; o arredondamento dá um pouco mais.`, refs: noMinimo.map((l) => l.apelido || l.instalacao) });

  const risco = novas.filter((c) => riscoCandidata(c));
  if (risco.length)
    a.push({ severidade: "media", codigo: "novas_risco", titulo: `${risco.length} nova(s) UC(s) com cadastro a conferir`, detalhe: "Entraram por falta de candidatas sem pendência.", refs: risco.map((c) => `${c.apelido || c.instalacao}: ${riscoCandidata(c)}`) });

  if (atual.saldoFinal > atual.saldoInicial && prop.saldoFinal < atual.saldoFinal)
    a.push({
      severidade: "baixa",
      codigo: "ganho",
      titulo: `O rateio atual acumularia ${fmt(atual.saldoFinal - atual.saldoInicial)} kWh de saldo em ${p.mesesSimulacao} meses`,
      detalhe: `Com o proposto, o saldo termina em ${fmt(prop.saldoFinal)} kWh (hoje: ${fmt(prop.saldoInicial)} kWh).`,
    });

  const ordem = { alta: 0, media: 1, baixa: 2 };
  return a.sort((x, y) => ordem[x.severidade] - ordem[y.severidade]);
}
