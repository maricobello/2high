"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardPaste,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  CircleCheck,
  CircleX,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { analisarProjeto, injecaoMensal } from "@/modules/rateio/engine";
import { exemplo } from "@/modules/rateio/exemplo";
import { importarSheets, parseCandidatas, parseUcs, textoParaGrid, usinaVazia, type Importacao, type ItemCalendario } from "@/modules/rateio/grid";
import { norm } from "@/modules/rateio/normalize";
import { interpretarSolucao, montarModelo, OPCOES_SOLVER, type ModeloLp } from "@/modules/rateio/otimizador";
import { montarResumo, parecerPadrao } from "@/modules/rateio/parecer";
import { PARAMETROS_PADRAO, type Alerta, type Candidata, type OtimizacaoResultado, type Parametros, type ResultadoProjeto, type ResultadoUsina, type Usina } from "@/modules/rateio/types";
import { METODOLOGIA } from "@/modules/rateio/metodologia";
import { coberturaEfetiva, FAIXA_COBERTURA, limiteFisico, sugerirMaximoPlanilha, type SugestaoCobertura } from "@/modules/rateio/otimo-cobertura";
import { chaveSubgrupo, valorCompensado } from "@/modules/rateio/valor";
import { competencias, definirConsumo, estimativaConsumo, numerosColados, resumoConsumo, rotuloCompetencia } from "@/modules/rateio/consumo";
import { SaldoChart } from "./chart";
import { FontesUsina, lerFaturaArquivo, lerPainelImagemArquivo } from "./fontes";
import { autoAplicar } from "@/modules/rateio/automacao";
import { MARCA_PADRAO, MARCA_REPLACE, type MarcaEstudo } from "@/modules/rateio/estudo-xlsx";
import { kwh, MESES_CURTOS, pct1, ratio } from "./format";
import { EntradaNumero } from "./numero";
import { ACAO_INFO, CLASSE_INFO, TabelaCandidatas, TabelaRateio } from "./tabelas";

interface Parecer {
  texto: string;
  fonte: "llm" | "template";
}

interface Estado {
  marca: MarcaEstudo;
  usinas: Usina[];
  candidatas: Candidata[];
  calendario: ItemCalendario[];
  params: Parametros;
  pareceres: Record<string, Parecer>;
  exemplo: boolean;
}

const VAZIO: Estado = { marca: MARCA_PADRAO, usinas: [], candidatas: [], calendario: [], params: PARAMETROS_PADRAO, pareceres: {}, exemplo: false };
const STORAGE = "aferi:rateio:v1";

function carregar(): Estado | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const e = JSON.parse(raw) as Estado;
    return { ...VAZIO, ...e, marca: { ...MARCA_PADRAO, ...e.marca }, params: validarParametros({ ...PARAMETROS_PADRAO, ...e.params }) };
  } catch {
    return null;
  }
}

/** Mesmas travas da tela de parâmetros (protege contra dados salvos antigos ou corrompidos). */
function validarParametros(p: Parametros): Parametros {
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const D = PARAMETROS_PADRAO;
  const casas = Math.min(6, Math.max(0, Math.round(n(p.casasDecimais, D.casasDecimais))));
  return {
    cobertura: Math.min(FAIXA_COBERTURA.max, Math.max(FAIXA_COBERTURA.min, n(p.cobertura, D.cobertura))),
    horizonteSaldoMeses: Math.max(1, Math.round(n(p.horizonteSaldoMeses, D.horizonteSaldoMeses))),
    reservaSaldoMeses: Math.max(0, n(p.reservaSaldoMeses, D.reservaSaldoMeses)),
    casasDecimais: casas,
    pctMinimo: Math.max(10 ** -casas, n(p.pctMinimo, D.pctMinimo)),
    mesesSimulacao: Math.min(60, Math.max(1, Math.round(n(p.mesesSimulacao, D.mesesSimulacao)))),
    mesInicio: Math.min(12, Math.max(1, Math.round(n(p.mesInicio, D.mesInicio)))),
    validadeCreditosMeses: Math.max(1, n(p.validadeCreditosMeses, D.validadeCreditosMeses)),
    permitirRetirar: typeof p.permitirRetirar === "boolean" ? p.permitirRetirar : D.permitirRetirar,
    incluirNovasUcs: typeof p.incluirNovasUcs === "boolean" ? p.incluirNovasUcs : D.incluirNovasUcs,
    compensavelMinimoCandidata: Math.max(0, n(p.compensavelMinimoCandidata, D.compensavelMinimoCandidata)),
    fatorConsumoEstresse: Math.min(1.5, Math.max(0.3, n(p.fatorConsumoEstresse, D.fatorConsumoEstresse))),
    dimensionarNovas: p.dimensionarNovas === "estrutural" ? "estrutural" : "queima",
    metodo: p.metodo === "proporcional" ? "proporcional" : "otimizado",
    custoNovaUcKwh: Math.max(0, n(p.custoNovaUcKwh, D.custoNovaUcKwh)),
    tarifaKwh: Math.max(0, n(p.tarifaKwh, D.tarifaKwh)),
    coberturaAutomatica: typeof p.coberturaAutomatica === "boolean" ? p.coberturaAutomatica : true,
    valorKwhSubgrupo: Object.fromEntries(Object.entries(p.valorKwhSubgrupo ?? {}).filter(([k, v]) => k && typeof v === "number" && Number.isFinite(v) && v > 0)),
  };
}

function salvar(e: Estado) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(e));
  } catch {
    /* armazenamento cheio ou bloqueado: segue só em memória */
  }
}

/** Liga a usina ao item do calendário com o mesmo nome. */
function itemDoCalendario(cal: ItemCalendario[], nome: string) {
  const n = norm(nome);
  return cal.find((c) => norm(c.usina) === n) ?? cal.find((c) => n.includes(norm(c.usina)) || norm(c.usina).includes(n));
}

function vincularCalendario(u: Usina, cal: ItemCalendario[]): Usina {
  const item = itemDoCalendario(cal, u.nome);
  if (!item) return u;
  return { ...u, distribuidora: u.distribuidora || item.concessionaria, fornecedor: u.fornecedor || item.fornecedor, ucsCalendario: item.ucs || u.ucsCalendario };
}

/** Para onde vai cada usina importada: id de uma usina existente ou "nova"; e se usa os dados do cabeçalho. */
export interface Destinos {
  destino: Record<string, string>;
  usarDados: Record<string, boolean>;
}

function avisoMaximo(v: number): string {
  return `A planilha usa Máximo Compensável de ${Math.round(v * 100)}%. O sistema calcula o valor ótimo (veja "Máximo compensável" na usina).`;
}

function mesclar(atual: Estado, imp: Importacao, alvo: string | null, dest?: Destinos): { estado: Estado; abrir: string | null } {
  const base = atual.exemplo ? { ...VAZIO, params: atual.params, marca: atual.marca } : atual;
  const calendario = imp.calendario.length ? imp.calendario : base.calendario;
  const usinas = [...base.usinas];
  let abrir: string | null = null;
  for (const nova of imp.usinas) {
    let idx: number;
    const escolhido = dest?.destino[nova.id];
    if (escolhido) idx = escolhido === "nova" ? -1 : usinas.findIndex((u) => u.id === escolhido);
    else {
      idx = usinas.findIndex((u) => norm(u.nome) === norm(nova.nome));
      if (idx < 0 && alvo && imp.usinas.length === 1) idx = usinas.findIndex((u) => u.id === alvo);
    }
    const usarDados = dest ? dest.usarDados[nova.id] !== false : true;
    if (idx >= 0) {
      const u = usinas[idx];
      usinas[idx] = {
        ...u,
        ucs: nova.ucs.length ? nova.ucs : u.ucs,
        distribuidora: u.distribuidora || nova.distribuidora,
        ...(nova.meses > 0 && usarDados
          ? { periodoInicio: nova.periodoInicio, periodoFim: nova.periodoFim, meses: nova.meses, energiaContratadaPeriodo: nova.energiaContratadaPeriodo, energiaGeradaPeriodo: nova.energiaGeradaPeriodo, energiaInjetadaPeriodo: nova.energiaInjetadaPeriodo, consumoMensal: nova.consumoMensal }
          : {}),
        ...(nova.maximoCompensavelPlanilha != null ? { maximoCompensavelPlanilha: nova.maximoCompensavelPlanilha } : {}),
        // demanda da planilha só entra se não veio da fatura nem foi digitada
        ...(nova.demanda && usarDados && (!u.demanda || u.demanda.fonte === "planilha") ? { demanda: nova.demanda } : {}),
      };
      abrir = u.id;
    } else {
      usinas.push(usarDados ? nova : { ...nova, meses: 0, periodoInicio: "", periodoFim: "", energiaContratadaPeriodo: 0, energiaGeradaPeriodo: 0, energiaInjetadaPeriodo: 0, consumoMensal: [] });
      abrir = nova.id;
    }
  }
  // candidatas reimportadas substituem as antigas; repetidas no mesmo arquivo ficam (o motor aponta a duplicidade)
  const novasKeys = new Set(imp.candidatas.map((c) => c.key));
  const candidatas = [...base.candidatas.filter((c) => !novasKeys.has(c.key)), ...imp.candidatas];
  // o "Máximo Compensável" da planilha fica só como referência: o sistema calcula o ótimo
  const params = base.params;
  return {
    estado: { ...base, usinas: usinas.map((u) => vincularCalendario(u, calendario)), candidatas, calendario, params, exemplo: false },
    abrir: abrir ?? (imp.calendario.length ? "calendario" : imp.candidatas.length ? "candidatas" : null),
  };
}

export function RateioWorkspace() {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [aba, setAba] = useState<string>("inicio");
  const [avisos, setAvisos] = useState<string[]>([]);
  // registro simples do que o sistema fez (só nesta sessão)
  const [registro, setRegistro] = useState<ItemRegistro[]>([]);
  const registrar = (texto: string, tipo: ItemRegistro["tipo"] = "info") =>
    setRegistro((r) => [{ hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), texto, tipo }, ...r].slice(0, 80));
  const [painelStatus, setPainelStatus] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [colar, setColar] = useState(false);
  const [exportarPopup, setExportarPopup] = useState<{ somente?: string } | null>(null);
  const [pendente, setPendente] = useState<{ imp: Importacao; arquivos: string[]; alvo: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alvoImport = useRef<string | null>(null);
  // estado mais recente, para mesclar depois da leitura assíncrona dos arquivos
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  useEffect(() => {
    const e = carregar();
    // estado salvo no navegador só existe depois da montagem
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e) setEstado(e);
    setPronto(true);
  }, []);
  useEffect(() => {
    if (!pronto) return;
    const t = setTimeout(() => salvar(estado), 400);
    return () => clearTimeout(t);
  }, [estado, pronto]);

  const usinasD = useDeferredValue(estado.usinas);
  // subgrupos presentes nas UCs (para o valor do kWh por subgrupo) + B das novas UCs
  const subgrupos = useMemo(() => [...new Set([...estado.usinas.flatMap((u) => u.ucs.map((c) => chaveSubgrupo(c.subgrupo))).filter(Boolean), "B"])].sort(), [estado.usinas]);
  const candD = useDeferredValue(estado.candidatas);
  const paramsD = useDeferredValue(estado.params);
  const [otim, setOtim] = useState<OtimizacaoResultado | null>(null);
  const [otimRodando, setOtimRodando] = useState(false);
  const resultado = useMemo(() => analisarProjeto(usinasD, candD, paramsD, otim), [usinasD, candD, paramsD, otim]);
  // regra proporcional, sempre calculada, para comparar com o otimizado
  const resultadoProp = useMemo(() => (paramsD.metodo === "otimizado" ? analisarProjeto(usinasD, candD, { ...paramsD, metodo: "proporcional" }) : resultado), [usinasD, candD, paramsD, resultado]);

  // máximo compensável ótimo da regra proporcional: busca livre de 1% a 200%, num Web Worker
  const [sugCob, setSugCob] = useState<{ chave: string; s: SugestaoCobertura | null } | null>(null);
  const chaveCob = useMemo(() => JSON.stringify([resultadoProp.chave, { ...paramsD, cobertura: 0, coberturaAutomatica: null, metodo: "" }]), [resultadoProp.chave, paramsD]);
  const cobWorker = useRef<Worker | null>(null);
  const cobPedido = useRef<{ id: number; chave: string } | null>(null);
  useEffect(() => {
    if (sugCob?.chave === chaveCob) return;
    if (!usinasD.some((u) => u.ucs.length && injecaoMensal(u) > 0)) return;
    const t = setTimeout(() => {
      if (!cobWorker.current) {
        const w = new Worker(new URL("../../../modules/rateio/cobertura.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (ev: MessageEvent<{ id: number; sugestao?: SugestaoCobertura | null; erro?: string }>) => {
          const ped = cobPedido.current;
          if (!ped || ped.id !== ev.data.id) return;
          setSugCob({ chave: ped.chave, s: ev.data.erro ? null : (ev.data.sugestao ?? null) });
        };
        w.onerror = () => cobPedido.current && setSugCob({ chave: cobPedido.current.chave, s: null });
        cobWorker.current = w;
      }
      const id = (cobPedido.current?.id ?? 0) + 1;
      cobPedido.current = { id, chave: chaveCob };
      cobWorker.current.postMessage({ id, usinas: usinasD, candidatas: candD, params: paramsD });
    }, 600);
    return () => clearTimeout(t);
  }, [chaveCob, sugCob?.chave, usinasD, candD, paramsD]);
  useEffect(() => () => cobWorker.current?.terminate(), []);
  const sugestaoCobertura = sugCob?.chave === chaveCob ? sugCob.s : undefined;
  // máximo compensável automático: o melhor valor entra sozinho, sem "aplicar"
  useEffect(() => {
    if (!sugestaoCobertura || estado.params.coberturaAutomatica === false) return;
    if (Math.abs(sugestaoCobertura.cobertura - estado.params.cobertura) < 0.0005) return;
    const c = sugestaoCobertura.cobertura;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado((e) => ({ ...e, params: { ...e.params, cobertura: c } }));
    registrar(`Máximo compensável da regra proporcional escolhido automaticamente: ${(c * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (o que compensa mais energia).`, "ok");
  }, [sugestaoCobertura, estado.params.coberturaAutomatica, estado.params.cobertura]);

  // otimização em segundo plano (Web Worker com HiGHS)
  const workerRef = useRef<Worker | null>(null);
  const pedidos = useRef(new Map<number, ModeloLp>());
  const seqPedido = useRef(0);
  const precisaOtimizar = paramsD.metodo === "otimizado" && usinasD.some((u) => u.ucs.length) && otim?.chave !== resultado.chave;
  useEffect(() => {
    if (!precisaOtimizar) return;
    // o mesmo problema já está sendo resolvido (ex.: só mudou a cobertura, que o otimizado não usa)
    if ([...pedidos.current.values()].some((m) => m.chave === resultado.chave)) return;
    const t = setTimeout(() => {
      const modelo = montarModelo(usinasD, resultado.candidatas, paramsD);
      if (!modelo.mapa.length) return;
      if (!workerRef.current) {
        const w = new Worker(new URL("../../../modules/rateio/otimizador.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (ev: MessageEvent<{ id: number; status?: string; objetivo?: number; colunas?: Record<string, { Primal: number }>; tempoMs?: number; erro?: string }>) => {
          const m = pedidos.current.get(ev.data.id);
          pedidos.current.delete(ev.data.id);
          if (!m) return;
          if (!pedidos.current.size) setOtimRodando(false);
          if (ev.data.erro) {
            setOtim({ chave: m.chave, status: "Erro", otimo: false, objetivo: 0, tempoMs: 0, variaveis: m.variaveis, restricoes: m.restricoes, porUsina: {}, erro: ev.data.erro });
            registrar(`Otimização falhou (${ev.data.erro}). Usando a regra proporcional.`, "erro");
            return;
          }
          setOtim(interpretarSolucao(m, ev.data.status ?? "", ev.data.objetivo ?? 0, ev.data.colunas ?? {}, ev.data.tempoMs ?? 0));
        };
        w.onerror = () => {
          setOtimRodando(false);
          setOtim({ chave: modelo.chave, status: "Erro", otimo: false, objetivo: 0, tempoMs: 0, variaveis: 0, restricoes: 0, porUsina: {}, erro: "Não foi possível carregar o otimizador neste navegador." });
        };
        workerRef.current = w;
      }
      const id = ++seqPedido.current;
      pedidos.current.clear();
      pedidos.current.set(id, modelo);
      setOtimRodando(true);
      registrar(`Otimizando: ${modelo.variaveis.toLocaleString("pt-BR")} variáveis, ${modelo.restricoes.toLocaleString("pt-BR")} restrições.`);
      const colunas = modelo.mapa.flatMap((m) => [...m.atuais, ...m.candidatas.flatMap((c) => [c.col, c.bin])]);
      workerRef.current.postMessage({ id, lp: modelo.lp, opcoes: OPCOES_SOLVER, colunas });
    }, 500);
    return () => clearTimeout(t);
  }, [precisaOtimizar, resultado.chave, resultado.candidatas, usinasD, paramsD]);
  useEffect(() => () => workerRef.current?.terminate(), []);

  /** Refaz tudo: otimização, refino, máximo compensável e validação. */
  function recalcular() {
    setOtim(null);
    setSugCob(null);
    resumoRef.current = "";
    registrar("Recálculo pedido: refazendo otimização, refino, máximo compensável e validação.");
  }

  // resumo no registro quando um cálculo termina
  const calculando = otimRodando || precisaOtimizar || (sugestaoCobertura === undefined && usinasD.some((u) => u.ucs.length && injecaoMensal(u) > 0));
  const resumoRef = useRef("");
  useEffect(() => {
    if (calculando) return;
    const chave = `${resultado.chave}|${resultado.metodo}|${otim?.tempoMs ?? 0}`;
    if (resumoRef.current === chave) return;
    resumoRef.current = chave;
    const novos: [string, ItemRegistro["tipo"]][] = [];
    for (const r of resultado.usinas) {
      const u = usinasD.find((x) => x.id === r.usinaId);
      if (!u || !u.ucs.length) continue;
      if (injecaoMensal(u) <= 0) {
        novos.push([`${r.usinaNome}: falta a energia injetada da usina (fatura ou dados da usina).`, "erro"]);
        continue;
      }
      const erros = r.validacoes.filter((v) => !v.ok && v.nivel === "erro").length;
      const avs = r.validacoes.filter((v) => !v.ok && v.nivel !== "erro").length;
      const ok = r.validacoes.length - erros - avs;
      const lim = limiteFisico(r, "proposto", paramsD.mesesSimulacao);
      const partes = [
        r.metodo === "otimizado" ? `otimizado${otim?.otimo ? " (ótimo comprovado)" : ""}` : "regra proporcional",
        r.refino && r.refino.ganhoKwh > 0.5 ? `refino exato +${kwh(r.refino.ganhoKwh)} kWh` : null,
        `${kwh(r.proposto.compensadoTotal - r.atual.compensadoTotal)} kWh a mais que o rateio atual em ${paramsD.mesesSimulacao} meses`,
        lim > 0 ? `${pct1(r.proposto.compensadoTotal / lim)} do limite físico` : null,
        `validação ${ok} de ${r.validacoes.length} ok${erros ? `, ${erros} reprovada(s)` : ""}${avs ? `, ${avs} aviso(s)` : ""}`,
      ].filter(Boolean);
      novos.push([`${r.usinaNome}: ${partes.join(" · ")}.`, erros ? "erro" : avs ? "atencao" : "ok"]);
    }
    // registro é só um diário do que o cálculo fez (não alimenta outro cálculo)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    for (const [t, tipo] of novos) registrar(t, tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculando, resultado]);

  const temDados = estado.usinas.length > 0 || estado.calendario.length > 0 || estado.candidatas.length > 0;
  const abaAtual = aba === "inicio" ? (estado.calendario.length ? "calendario" : (estado.usinas[0]?.id ?? "inicio")) : aba;

  function atualizarUsina(id: string, patch: Partial<Usina>) {
    setEstado((e) => ({ ...e, usinas: e.usinas.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  }
  /** Atualiza a usina a partir do estado mais recente (para leituras assíncronas). */
  function transformarUsina(id: string, fn: (u: Usina) => Usina) {
    setEstado((e) => ({ ...e, usinas: e.usinas.map((u) => (u.id === id ? fn(u) : u)) }));
  }

  async function importar(files: FileList | File[]) {
    const todos = [...files];
    // PDF (fatura da usina) e imagem (recorte do Orange) vão para a usina aberta
    const docs = todos.filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name) || /^(application\/pdf|image\/)/.test(f.type));
    const lista = todos.filter((f) => !docs.includes(f));
    if (docs.length) {
      const alvo = estadoRef.current.usinas.find((u) => u.id === (alvoImport.current ?? aba));
      if (!alvo) setAvisos(["Abra a aba da usina antes de enviar a fatura (PDF) ou o recorte do Orange."]);
      else {
        setOcupado(true);
        const msgs: string[] = [];
        for (const d of docs) {
          try {
            if (/pdf/i.test(d.type) || /\.pdf$/i.test(d.name)) {
              const fat = await lerFaturaArquivo(d);
              transformarUsina(alvo.id, (u) => autoAplicar({ ...u, fatura: fat }));
              msgs.push(`Fatura "${d.name}" lida na ${alvo.nome}${fat.mesReferencia ? ` (referência ${fat.mesReferencia.slice(5, 7)}/${fat.mesReferencia.slice(0, 4)})` : ""}.`);
            } else {
              const valores = await lerPainelImagemArquivo(d);
              transformarUsina(alvo.id, (u) => autoAplicar({ ...u, painel: { valores, meses: null, fonte: "imagem", lidoEm: new Date().toISOString() } }));
              msgs.push(`Recorte do Orange lido na ${alvo.nome}.`);
            }
          } catch (err) {
            msgs.push(`"${d.name}": ${err instanceof Error ? err.message : "não foi possível ler"}`);
          }
        }
        setAvisos(msgs);
        setOcupado(false);
      }
      if (!lista.length) {
        alvoImport.current = null;
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    if (!lista.length) return;
    setOcupado(true);
    try {
      const { lerArquivo } = await import("@/modules/rateio/xlsx");
      const sheets = (await Promise.all(lista.map(async (f) => (await lerArquivo(f)).map((s) => ({ ...s, name: lista.length > 1 ? `${f.name} › ${s.name}` : s.name }))))).flat();
      const imp = importarSheets(sheets);
      // UCs de usina: pergunta para qual usina vão (o nome dentro da planilha pode não ser o da usina certa)
      if (imp.usinas.some((u) => u.ucs.length)) {
        setPendente({ imp, arquivos: lista.map((f) => f.name), alvo: alvoImport.current ?? (estadoRef.current.usinas.some((u) => u.id === aba) ? aba : null) });
        return;
      }
      const { estado: novo, abrir } = mesclar(estadoRef.current, imp, alvoImport.current);
      estadoRef.current = novo;
      setEstado(novo);
      if (abrir) setAba(abrir);
      const avisosImp = imp.avisos.length ? imp.avisos : ["Nenhuma tabela reconhecida no arquivo."];
      setAvisos(imp.maximoCompensavel ? [...avisosImp, avisoMaximo(imp.maximoCompensavel)] : avisosImp);
      avisosImp.forEach((a) => registrar(`Importado: ${a}`));
    } catch (err) {
      setAvisos([`Não foi possível ler o arquivo: ${err instanceof Error ? err.message : "formato inválido"}`]);
    } finally {
      setOcupado(false);
      alvoImport.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function abrirImport(alvo: string | null = null) {
    alvoImport.current = alvo;
    inputRef.current?.click();
  }

  function baixar(blob: Blob, nome: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function planilhaModelo(usinaId: string) {
    const u = estado.usinas.find((x) => x.id === usinaId);
    const r = resultado.usinas.find((x) => x.usinaId === usinaId);
    if (!u || !r) return;
    setOcupado(true);
    try {
      const { preencherModelo } = await import("@/modules/rateio/planilha-modelo");
      const blob = await preencherModelo(u, r, resultado.candidatas.filter((c) => !c.selecionada || c.usinaDestino === u.nome), estado.params);
      baixar(blob, `Modelo_Rateio_${u.nome.replace(/\s+/g, "-")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setOcupado(false);
    }
  }

  async function modeloBranco() {
    const { modeloEmBranco } = await import("@/modules/rateio/planilha-modelo");
    baixar(await modeloEmBranco(), "Modelo_Rateio_Usinas_GD.xlsx");
  }

  async function exportar(formato: "pdf" | "excel", somente?: string) {
    setOcupado(true);
    try {
      // sem parecer gerado, entra o parecer padrão (o documento sai sempre completo)
      const pareceres = Object.fromEntries(
        resultado.usinas.map((r) => {
          const u = estado.usinas.find((x) => x.id === r.usinaId)!;
          return [r.usinaId, estado.pareceres[r.usinaId]?.texto ?? parecerPadrao(montarResumo(u, r, estado.params))];
        }),
      );
      const ciclo = Object.fromEntries(
        estado.usinas.map((u) => {
          const item = itemDoCalendario(estado.calendario, u.nome);
          return [u.id, item?.mesCiclo ? `${item.mesCiclo.slice(5, 7)}/${item.mesCiclo.slice(0, 4)}` : ""];
        }),
      );
      const opcoes = { marca: estado.marca, pareceres, usinas: somente ? [somente] : undefined, ciclo };
      const lista = somente ? estado.usinas.filter((u) => u.id === somente) : estado.usinas;
      const nome = lista.map((u) => u.nome.replace(/\s+/g, "-")).join("_").slice(0, 60) || "rateio";
      const data = new Date().toISOString().slice(0, 10);
      if (formato === "pdf") {
        const { exportarPdf } = await import("@/modules/rateio/estudo-pdf");
        baixar(await exportarPdf(estado.usinas, resultado, estado.params, opcoes), `Estudo-de-rateio_${nome}_${data}.pdf`);
      } else {
        const { exportarEstudo } = await import("@/modules/rateio/estudo-xlsx");
        baixar(await exportarEstudo(estado.usinas, resultado, estado.params, opcoes), `Estudo-de-rateio_${nome}_${data}.xlsx`);
      }
    } catch (err) {
      setAvisos([`Não foi possível gerar o arquivo: ${err instanceof Error ? err.message : "erro"}`]);
    } finally {
      setOcupado(false);
    }
  }

  function carregarExemplo() {
    const ex = exemplo();
    setEstado((e) => ({ ...VAZIO, ...ex, exemplo: true, marca: e.marca }));
    setAba(ex.usinas[0].id);
    setAvisos(["Exemplo com dados fictícios carregado. Importe suas planilhas para substituir."]);
  }

  function limpar() {
    if (!confirm("Apagar todas as usinas, candidatas e o calendário deste navegador?")) return;
    setEstado((e) => ({ ...VAZIO, marca: e.marca }));
    setAba("inicio");
    setAvisos([]);
  }

  function analisarDoCalendario(item: ItemCalendario) {
    const existente = estado.usinas.find((u) => norm(u.nome) === norm(item.usina));
    if (existente) return setAba(existente.id);
    const u = { ...usinaVazia(item.usina), distribuidora: item.concessionaria, fornecedor: item.fornecedor, ucsCalendario: item.ucs || null };
    setEstado((e) => ({ ...e, usinas: [...e.usinas, u] }));
    setAba(u.id);
  }

  const abas = [
    ...(estado.calendario.length ? [{ id: "calendario", label: "Calendário", icon: CalendarDays }] : []),
    ...estado.usinas.map((u) => ({ id: u.id, label: u.nome, icon: null })),
    { id: "candidatas", label: `Novas UCs${estado.candidatas.length ? ` (${estado.candidatas.length})` : ""}`, icon: null },
    { id: "parametros", label: "Parâmetros", icon: Settings2 },
    { id: "metodologia", label: "Metodologia", icon: BookOpen },
  ];

  function confirmarImportacao(dest: Destinos) {
    if (!pendente) return;
    const { imp } = pendente;
    const { estado: novo, abrir } = mesclar(estadoRef.current, imp, null, dest);
    estadoRef.current = novo;
    setEstado(novo);
    if (abrir) setAba(abrir);
    const nomes = imp.usinas.map((u) => {
      const d = dest.destino[u.id];
      const alvoNome = d === "nova" ? u.nome : (novo.usinas.find((x) => x.id === d)?.nome ?? u.nome);
      return `${u.ucs.length} UCs importadas na ${alvoNome}${alvoNome !== u.nome ? ` (a planilha dizia ${u.nome})` : ""}.`;
    });
    const outros = imp.avisos.filter((a) => !/UCs da /.test(a));
    setAvisos([...nomes, ...outros, ...(imp.maximoCompensavel ? [avisoMaximo(imp.maximoCompensavel)] : [])]);
    [...nomes, ...outros].forEach((a) => registrar(`Importado: ${a}`));
    setPendente(null);
  }

  const statusGeral = avaliarStatus(resultado, usinasD, calculando, paramsD, otim);
  const usinaAtiva = estado.usinas.find((u) => u.id === abaAtual);
  const resAtivo = resultado.usinas.find((r) => r.usinaId === abaAtual);

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) importar(e.dataTransfer.files);
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.pdf,.png,.jpg,.jpeg,.webp" multiple hidden onChange={(e) => e.target.files && importar(e.target.files)} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Rateio GD</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Revisão de rateio de créditos de geração distribuída: importe o calendário, as UCs da usina e as candidatas; o estudo sai pronto em Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {estado.usinas.some((u) => u.ucs.length) && (
            <>
              <StatusBotao status={statusGeral.nivel} texto={statusGeral.texto} aberto={painelStatus} onClick={() => setPainelStatus((v) => !v)} />
              <Button size="sm" variant="secondary" onClick={recalcular} disabled={calculando}>
                <RefreshCw className={cn("size-4", calculando && "animate-spin")} /> Recalcular
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => abrirImport()} disabled={ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Importar planilhas
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setColar(true)}>
            <ClipboardPaste className="size-4" /> Colar tabela
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setExportarPopup({})} disabled={!estado.usinas.some((u) => u.ucs.length) || ocupado}>
            <Download className="size-4" /> Exportar estudo
          </Button>
          {temDados && (
            <Button size="sm" variant="ghost" onClick={limpar} aria-label="Limpar dados">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {painelStatus && estado.usinas.some((u) => u.ucs.length) && <PainelStatus status={statusGeral} registro={registro} onFechar={() => setPainelStatus(false)} onLimpar={() => setRegistro([])} />}

      {avisos.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft/60 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary-text" />
          <ul className="min-w-0 flex-1 space-y-0.5 text-foreground/90">
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setAvisos([])} className="text-muted hover:text-foreground" aria-label="Fechar aviso">
            <X className="size-4" />
          </button>
        </div>
      )}

      {estado.exemplo && (
        <p className="flex items-center gap-2 text-xs text-volt">
          <FlaskConical className="size-3.5" /> Dados fictícios de demonstração. A primeira importação substitui este exemplo.
        </p>
      )}

      {!pronto ? null : !temDados ? (
        <Vazio onImportar={() => abrirImport()} onExemplo={carregarExemplo} onModelo={modeloBranco} ocupado={ocupado} />
      ) : (
        <>
          <nav aria-label="Seções do estudo" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4">
            {abas.map((t) => {
              const ativo = t.id === abaAtual;
              const r = resultado.usinas.find((x) => x.usinaId === t.id);
              const altas = r?.alertas.filter((a) => a.severidade === "alta").length ?? 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAba(t.id)}
                  aria-current={ativo ? "page" : undefined}
                  className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors", ativo ? "border-primary font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground")}
                >
                  {t.icon && <t.icon className="size-4" />}
                  {t.label}
                  {altas > 0 && <span className="rounded-full bg-attention-soft px-1.5 text-[10px] font-bold text-attention">{altas}</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const u = usinaVazia(`Usina ${estado.usinas.length + 1}`);
                setEstado((e) => ({ ...e, usinas: [...e.usinas, u] }));
                setAba(u.id);
              }}
              className="flex items-center gap-1 px-3 py-2.5 text-sm whitespace-nowrap text-muted hover:text-foreground"
            >
              <Plus className="size-4" /> Usina
            </button>
          </nav>

          {abaAtual === "calendario" && <Calendario itens={estado.calendario} usinas={estado.usinas} onAnalisar={analisarDoCalendario} />}
          {abaAtual === "candidatas" && <Candidatas resultado={resultado.candidatas} onImportar={() => abrirImport()} onLimpar={() => setEstado((e) => ({ ...e, candidatas: [] }))} />}
          {abaAtual === "parametros" && (
            <div className="space-y-5">
              <IdentidadeEstudo marca={estado.marca} onChange={(m) => setEstado((e) => ({ ...e, marca: m }))} />
              <ParametrosPainel params={estado.params} sugestao={sugestaoCobertura} subgrupos={subgrupos} onChange={(p) => setEstado((e) => ({ ...e, params: p }))} />
            </div>
          )}
          {abaAtual === "metodologia" && <Metodologia />}
          {usinaAtiva && resAtivo && (
            <UsinaPainel
              usina={usinaAtiva}
              resultado={resAtivo}
              proporcional={resultadoProp.usinas.find((r) => r.usinaId === usinaAtiva.id)}
              otimizacao={{ rodando: otimRodando || precisaOtimizar, info: otim, metodoPedido: paramsD.metodo, metodoUsado: resultado.metodo }}
              params={estado.params}
              sugestaoCobertura={sugestaoCobertura}
              parecer={estado.pareceres[usinaAtiva.id]}
              calendario={itemDoCalendario(estado.calendario, usinaAtiva.nome)}
              onChange={(patch) => atualizarUsina(usinaAtiva.id, patch)}
              onTransformar={(fn) => transformarUsina(usinaAtiva.id, fn)}
              onExportar={() => setExportarPopup({ somente: usinaAtiva.id })}
              onTarifa={(t) => setEstado((e) => ({ ...e, params: { ...e.params, tarifaKwh: t } }))}
              onImportar={() => abrirImport(usinaAtiva.id)}
              onParecer={(p) => setEstado((e) => ({ ...e, pareceres: { ...e.pareceres, [usinaAtiva.id]: p } }))}
              onRemover={() => {
                if (!confirm(`Remover a ${usinaAtiva.nome} do estudo?`)) return;
                setEstado((e) => ({ ...e, usinas: e.usinas.filter((u) => u.id !== usinaAtiva.id) }));
                setAba("inicio");
              }}
            />
          )}
        </>
      )}

      <p className="text-xs text-muted">Os arquivos são lidos neste navegador e ficam salvos só nele. Para o parecer, só sai um resumo com totais e apelidos, sem número de instalação.</p>

      {exportarPopup && (
        <ExportarDialog
          escopo={exportarPopup.somente ? (estado.usinas.find((u) => u.id === exportarPopup.somente)?.nome ?? "") : estado.usinas.length === 1 ? estado.usinas[0].nome : `Todas as usinas (${estado.usinas.filter((u) => u.ucs.length).length})`}
          umaUsina={!!exportarPopup.somente || estado.usinas.length === 1}
          ocupado={ocupado}
          onFechar={() => setExportarPopup(null)}
          onEscolher={async (f) => {
            const somente = exportarPopup.somente ?? (estado.usinas.length === 1 ? estado.usinas[0].id : undefined);
            if (f === "modelo") await planilhaModelo(somente!);
            else await exportar(f, exportarPopup.somente);
            setExportarPopup(null);
          }}
        />
      )}

      {pendente && <DestinoDialog pendente={pendente} usinas={estado.exemplo ? [] : estado.usinas} onCancelar={() => setPendente(null)} onConfirmar={confirmarImportacao} />}

      {colar && (
        <ColarDialog
          usinas={estado.usinas}
          inicial={usinaAtiva?.id ?? "candidatas"}
          onClose={() => setColar(false)}
          onAplicar={(destino, texto) => {
            const grid = textoParaGrid(texto);
            if (destino === "candidatas") {
              const c = parseCandidatas(grid);
              if (!c?.length) return "Não encontrei as colunas UC e Média kWh no texto colado.";
              const { estado: novo } = mesclar(estado, { usinas: [], candidatas: c, calendario: [], maximoCompensavel: null, avisos: [] }, null);
              setEstado(novo);
              setAba("candidatas");
              setAvisos([`${c.length} UCs candidatas coladas.`]);
            } else {
              const ucs = parseUcs(grid);
              if (!ucs?.length) return "Não encontrei as colunas N° de Instalação, % do Rateio e Consumo Compensável no texto colado.";
              if (destino === "nova") {
                const imp = importarSheets([{ name: "colado", grid }]);
                const { estado: novo, abrir } = mesclar(estado, imp, null);
                setEstado(novo);
                if (abrir) setAba(abrir);
                setAvisos(imp.avisos);
              } else {
                atualizarUsina(destino, { ucs });
                setAba(destino);
                setAvisos([`${ucs.length} UCs coladas na ${estado.usinas.find((u) => u.id === destino)?.nome}.`]);
              }
            }
            setColar(false);
            return null;
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Vazio({ onImportar, onExemplo, onModelo, ocupado }: { onImportar: () => void; onExemplo: () => void; onModelo: () => void; ocupado: boolean }) {
  const passos = [
    { t: "Calendário de rateio", d: "Mostra as usinas do ciclo, etapa e prazo. Clique em uma usina para abrir o estudo." },
    { t: "UCs da usina (Orange)", d: "Export da Unidade Rateio GD ou a planilha modelo de análise, com saldo, compensável e % atual." },
    { t: "Novas UCs", d: "Lista de candidatas com média de consumo e tipo de ligação. O sistema escolhe quais entram." },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Eyebrow>Estudo de rateio</Eyebrow>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Arraste as planilhas aqui</h2>
          <p className="mt-3 max-w-md text-muted">Pode ser tudo de uma vez: o sistema reconhece cada aba. Aceita .xlsx, .csv ou texto colado do Orange.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onImportar} disabled={ocupado}>
              <FileSpreadsheet className="size-4" /> Escolher arquivos
            </Button>
            <Button variant="secondary" onClick={onExemplo}>
              <FlaskConical className="size-4" /> Ver exemplo fictício
            </Button>
          </div>
          <button type="button" onClick={onModelo} className="mt-4 text-sm font-medium text-primary-text hover:underline">
            Baixar a planilha modelo em branco
          </button>
        </div>
        <ol className="space-y-3">
          {passos.map((p, i) => (
            <li key={p.t} className="flex gap-3 rounded-xl border border-border bg-subtle/50 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div>
                <p className="font-semibold">{p.t}</p>
                <p className="mt-0.5 text-sm text-muted">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Kpi({ label, valor, antes, bom, nota }: { label: string; valor: string; antes?: string; bom?: boolean | null; nota?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-semibold tracking-tight", bom === true && "text-opportunity", bom === false && "text-attention")}>{valor}</p>
      {antes && <p className="mt-0.5 text-xs text-muted">Atual: {antes}</p>}
      {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
    </Card>
  );
}

function AlertaItem({ a }: { a: Alerta }) {
  const [aberto, setAberto] = useState(false);
  const cor = a.severidade === "alta" ? "text-attention" : a.severidade === "media" ? "text-analysis" : "text-muted";
  return (
    <li className="border-t border-border/60 px-4 py-3 first:border-t-0">
      <div className="flex gap-3">
        {a.severidade === "baixa" ? <Info className={cn("mt-0.5 size-4 shrink-0", cor)} /> : <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", cor)} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            <span className="sr-only">{a.severidade === "alta" ? "Atenção alta: " : a.severidade === "media" ? "Atenção: " : "Informação: "}</span>
            {a.titulo}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">{a.detalhe}</p>
          {a.refs && a.refs.length > 0 && (
            <button type="button" onClick={() => setAberto((v) => !v)} className="mt-1 text-xs font-medium text-primary-text hover:underline">
              {aberto ? "Ocultar UCs" : `Ver ${a.refs.length} UC(s)`}
            </button>
          )}
          {aberto && <p className="mt-1 font-mono text-[11px] break-words text-muted">{a.refs?.join(" · ")}</p>}
        </div>
      </div>
    </li>
  );
}

function CampoNumero({ label, value, onChange, sufixo, dica }: { label: string; value: number | null; onChange: (v: number | null) => void; sufixo?: string; dica?: string; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      <span className="relative block">
        <EntradaNumero
          value={value}
          onValor={onChange}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 pr-12 font-mono text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
        {sufixo && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{sufixo}</span>}
      </span>
      {dica && <span className="mt-1 block text-[11px] text-muted">{dica}</span>}
    </label>
  );
}

function CampoTexto({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none" />
    </label>
  );
}

interface OtimizacaoUi {
  rodando: boolean;
  info: OtimizacaoResultado | null;
  metodoPedido: Parametros["metodo"];
  metodoUsado: ResultadoProjeto["metodo"];
}

function UsinaPainel({
  usina,
  resultado: r,
  proporcional,
  otimizacao,
  params,
  sugestaoCobertura,
  parecer,
  calendario,
  onChange,
  onTransformar,
  onExportar,
  onTarifa,
  onImportar,
  onParecer,
  onRemover,
}: {
  usina: Usina;
  resultado: ResultadoUsina;
  proporcional?: ResultadoUsina;
  otimizacao: OtimizacaoUi;
  params: Parametros;
  sugestaoCobertura?: SugestaoCobertura | null;
  parecer?: Parecer;
  calendario?: ItemCalendario;
  onChange: (p: Partial<Usina>) => void;
  onTransformar: (fn: (u: Usina) => Usina) => void;
  onExportar: () => void;
  onTarifa: (t: number) => void;
  onImportar: () => void;
  onParecer: (p: Parecer) => void;
  onRemover: () => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [ficha, setFicha] = useState<number | null>(null);
  const i = r.indicadores;
  const mesesDoAno = r.proposto.meses.map((m) => m.mes);
  const E = injecaoMensal(usina);
  const semUcs = usina.ucs.length === 0;

  async function gerarParecer() {
    setGerando(true);
    const resumo = montarResumo(usina, r, params);
    try {
      const res = await fetch("/api/admin/rateio/parecer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resumo) });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as Parecer;
      onParecer({ texto: j.texto, fonte: j.fonte });
    } catch {
      onParecer({ texto: parecerPadrao(resumo), fonte: "template" });
    } finally {
      setGerando(false);
    }
  }

  /** Proposto menor ou igual ao atual é melhor (verde); maior, pior (vermelho). */
  const delta = (proposto: number, atual: number) => (proposto === atual ? null : proposto < atual);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{usina.nome}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {[usina.distribuidora, usina.fornecedor, `${usina.ucs.length} UCs`].filter(Boolean).join(" · ")}
            {calendario && ` · ciclo ${calendario.mesCiclo.slice(5, 7)}/${calendario.mesCiclo.slice(0, 4)} · ${calendario.etapaAtual}`}
          </p>
          {!semUcs && E > 0 && <MetodoInfo otimizacao={{ ...otimizacao, metodoUsado: r.metodo }} refino={r.refino} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {!semUcs && E > 0 && (
            <Button size="sm" onClick={onExportar}>
              <Download className="size-4" /> Exportar
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onImportar}>
            <Upload className="size-4" /> {semUcs ? "Importar UCs" : "Atualizar UCs"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemover} aria-label={`Remover ${usina.nome}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <DadosUsina usina={usina} onChange={onChange} />
      <FontesUsina usina={usina} onChange={onChange} onTransformar={onTransformar} />

      {!semUcs && E <= 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold">Falta a injeção da usina</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Envie a fatura da usina (PDF) ou o recorte da tela do Orange no cartão acima. Com nota de leitura alta, a injeção entra sozinha e o rateio é calculado na hora.</p>
        </Card>
      ) : semUcs ? (
        <Card className="p-8 text-center">
          <p className="font-semibold">Falta a lista de UCs desta usina</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Importe o export da Unidade Rateio GD do Orange (ou a planilha modelo) ou cole a tabela. Precisa das colunas N° de Instalação, % do Rateio, Saldo e Consumo Compensável.</p>
          <Button className="mt-5" size="sm" onClick={onImportar}>
            <Upload className="size-4" /> Importar UCs
          </Button>
        </Card>
      ) : (
        <>
          <Ganho r={r} params={params} onTarifa={onTarifa} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Saldo em ${params.mesesSimulacao} meses (kWh)`} valor={kwh(r.proposto.saldoFinal)} antes={kwh(r.atual.saldoFinal)} bom={delta(r.proposto.saldoFinal, r.atual.saldoFinal)} nota={`Hoje: ${kwh(r.atual.saldoInicial)}`} />
            <Kpi label="Consumo sem crédito (kWh)" valor={kwh(r.proposto.consumoDescobertoTotal)} antes={kwh(r.atual.consumoDescobertoTotal)} bom={delta(r.proposto.consumoDescobertoTotal, r.atual.consumoDescobertoTotal)} />
            <Kpi label="Crédito novo que vira saldo (kWh)" valor={kwh(r.proposto.creditoParaSaldoTotal)} antes={kwh(r.atual.creditoParaSaldoTotal)} bom={delta(r.proposto.creditoParaSaldoTotal, r.atual.creditoParaSaldoTotal)} />
            <Kpi label="UCs no rateio" valor={`${i.ucsPropostas}`} antes={`${i.ucsAtuais}`} nota={`+${i.incluidas} incluídas · −${i.retiradas} retiradas`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">Saldo de créditos projetado</h3>
                <p className="text-xs text-muted">Injeção de {kwh(E)} kWh/mês{usina.perfilSazonal.length === 12 ? " com sazonalidade" : ""}</p>
              </div>
              <SaldoChart
                atual={[r.atual.saldoInicial, ...r.atual.meses.map((m) => m.saldoTotal)]}
                proposto={[r.proposto.saldoInicial, ...r.proposto.meses.map((m) => m.saldoTotal)]}
                estresse={[r.propostoEstresse.saldoInicial, ...r.propostoEstresse.meses.map((m) => m.saldoTotal)]}
                mesesDoAno={mesesDoAno}
                fatorEstresse={params.fatorConsumoEstresse}
              />
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 font-semibold">Balanço da usina</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Injeção mensal", `${kwh(E)} kWh`],
                  ["Contratada mensal", i.contratadaMensal ? `${kwh(i.contratadaMensal)} kWh` : "—"],
                  [i.consumoEstimado ? "Consumida mensal (estimada)" : "Consumida mensal (média)", i.consumoMensal ? `${kwh(i.consumoMensal)} kWh` : "—"],
                  ["Consumida ÷ contratada", ratio(i.consumoSobreContratada)],
                  ["Injetada ÷ contratada", ratio(i.injetadaSobreContratada)],
                  ["Gerada ÷ contratada", ratio(i.geradaSobreContratada)],
                  ["Compensável das UCs atuais", `${kwh(i.compensavelTotal)} kWh/mês`],
                  ["Compensável ÷ injetada", ratio(i.compensavelSobreInjetada)],
                  ["Compensável ideal a agregar", `${kwh(i.compensavelIdealAgregar)} kWh/mês`],
                  ["Agregado com novas UCs", `${kwh(i.compensavelAgregado)} kWh/mês`],
                  ["Cobertura média proposta", ratio(i.coberturaMedia)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
            <Comparacao atual={r} proporcional={proporcional} otimizado={r.metodo === "otimizado" ? r : undefined} otimizacao={otimizacao} params={params} />
            <ValidacaoCard validacoes={r.validacoes} />
          </div>

          <MaximoCompensavel usina={usina} r={r} params={params} sugestao={sugestaoCobertura} />

          {r.alertas.length > 0 && (
            <Card>
              <h3 className="border-b border-border px-4 py-3 font-semibold">Pontos de atenção</h3>
              <ul>
                {r.alertas.map((a) => (
                  <AlertaItem key={a.codigo} a={a} />
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="font-semibold">Rateio proposto por UC</h3>
              <p className="text-xs text-muted">Soma: {r.linhas.reduce((s, l) => s + l.pctProposto, 0).toLocaleString("pt-BR", { maximumFractionDigits: params.casasDecimais })}%</p>
            </div>
            <TabelaRateio linhas={r.linhas} casas={params.casasDecimais} onSelecionar={(l) => setFicha(r.linhas.indexOf(l))} />
          </Card>
          {ficha != null && r.linhas[ficha] && <FichaUc resultado={r} indice={ficha} params={params} onClose={() => setFicha(null)} onNavegar={(d) => setFicha((f) => (f == null ? f : Math.min(r.linhas.length - 1, Math.max(0, f + d))))} />}

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Parecer técnico</h3>
                <p className="text-xs text-muted">Texto para a Replace / fornecedor. Vai para a aba Resumo do Excel e pode ser editado.</p>
              </div>
              <div className="flex gap-2">
                {parecer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(parecer.texto);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 1500);
                    }}
                  >
                    <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar"}
                  </Button>
                )}
                <Button size="sm" onClick={gerarParecer} disabled={gerando}>
                  {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {parecer ? "Gerar de novo" : "Gerar parecer"}
                </Button>
              </div>
            </div>
            {parecer && (
              <>
                <textarea
                  value={parecer.texto}
                  onChange={(e) => onParecer({ ...parecer, texto: e.target.value })}
                  aria-label="Texto do parecer"
                  className="mt-4 min-h-64 w-full rounded-xl border border-border bg-subtle/40 p-4 text-sm leading-relaxed text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-muted">{parecer.fonte === "llm" ? "Redigido com IA a partir dos números calculados (conferidos automaticamente)." : "Texto padrão gerado a partir dos números calculados."}</p>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** Demanda da usina: contratada, registrada, ultrapassagem e despesa (lidas da fatura). */
function UltrapassagemDemanda({ usina, onChange }: { usina: Usina; onChange: (p: Partial<Usina>) => void }) {
  const d = usina.demanda;
  const set = (k: "contratadaKw" | "registradaKw" | "ultrapassagemKw" | "despesaUltrapassagem", v: number | null) => {
    const base = d ?? { contratadaKw: null, registradaKw: null, ultrapassagemKw: null, despesaUltrapassagem: null, fonte: "manual" as const };
    const novo = { ...base, [k]: v, fonte: "manual" as const };
    if (k !== "ultrapassagemKw" && novo.registradaKw != null && novo.contratadaKw != null) novo.ultrapassagemKw = Math.max(0, novo.registradaKw - novo.contratadaKw);
    onChange({ demanda: novo });
  };
  const ultra = (d?.ultrapassagemKw ?? 0) > 0 || (d?.despesaUltrapassagem ?? 0) > 0;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fonte = d?.fonte === "fatura" ? "lida da fatura" : d?.fonte === "planilha" ? "da planilha" : d?.fonte === "manual" ? "digitada" : null;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Ultrapassagem de demanda</p>
        {fonte && <p className="text-xs text-muted">{fonte}</p>}
      </div>
      <p className="mt-0.5 text-xs text-muted">Vem sozinha da fatura da usina (bloco de demandas e item &quot;Ultrapassagem de Demanda&quot;). Vai para a planilha modelo (N4 a N6).</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CampoNumero label="Demanda contratada" sufixo="kW" value={d?.contratadaKw ?? null} onChange={(v) => set("contratadaKw", v)} />
        <CampoNumero label="Demanda registrada" sufixo="kW" value={d?.registradaKw ?? null} onChange={(v) => set("registradaKw", v)} />
        <CampoNumero label="Ultrapassagem" sufixo="kW" value={d?.ultrapassagemKw ?? null} onChange={(v) => set("ultrapassagemKw", v)} />
        <CampoNumero label="Despesa com ultrapassagem" sufixo="R$" value={d?.despesaUltrapassagem ?? null} onChange={(v) => set("despesaUltrapassagem", v)} />
      </div>
      {ultra && d && (
        <p className="mt-2 flex gap-2 rounded-lg border border-attention/40 bg-attention/10 px-3 py-2 text-xs">
          <TriangleAlert className="size-4 shrink-0 text-attention" />
          <span>
            Registrada {kwh(d.registradaKw ?? 0)} kW contra {kwh(d.contratadaKw ?? 0)} kW contratados{d.despesaUltrapassagem ? `: ${brl(d.despesaUltrapassagem)} de ultrapassagem no mês` : ""}. Não muda o rateio, mas é custo recorrente da usina: avaliar o aumento da demanda contratada
            {d.registradaKw ? ` (cerca de ${kwh(Math.ceil(d.registradaKw / 10) * 10)} kW)` : ""}.
          </span>
        </p>
      )}
    </div>
  );
}

/** Período a partir de dois meses (AAAA-MM); recalcula o número de meses. */
function periodo(u: Usina, ini: string, fim: string): Partial<Usina> {
  const i = ini ? `${ini.slice(0, 7)}-01` : "";
  const f = fim ? `${fim.slice(0, 7)}-01` : "";
  const meses = i && f ? competencias({ periodoInicio: i, periodoFim: f, meses: 0 }).length : u.meses;
  return { periodoInicio: i, periodoFim: f, meses: meses || u.meses, fontePeriodo: "manual" };
}

function CampoMes({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      <input type="month" value={value ? value.slice(0, 7) : ""} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground [color-scheme:dark] focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none" />
    </label>
  );
}

/** Energia consumida no período: total de cada competência do Relatório Gerencial GD, digitado mês a mês. */
function EnergiaConsumida({ usina, onChange }: { usina: Usina; onChange: (p: Partial<Usina>) => void }) {
  const res = resumoConsumo(usina);
  const estimativa = estimativaConsumo(usina);
  // média muito abaixo do consumo das UCs: digitado em MWh ou com o ponto lido como decimal
  const pareceMwh = res.informados > 0 && res.media > 0 && res.media < 100_000 && estimativa > 0 && res.media * 50 < estimativa;
  const contratadaMes = usina.meses > 0 ? usina.energiaContratadaPeriodo / usina.meses : 0;
  const definir = (competencia: string, v: number | null) => onChange({ consumoMensal: definirConsumo(usina, competencia, v) });
  // colar uma coluna do Excel preenche a partir do mês em que se colou
  const colar = (k: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const nums = numerosColados(e.clipboardData.getData("text"));
    if (nums.length < 2) return;
    e.preventDefault();
    let u: Usina = usina;
    nums.slice(0, res.linhas.length - k).forEach((v, j) => {
      u = { ...u, consumoMensal: definirConsumo(u, res.linhas[k + j].competencia, v) };
    });
    onChange({ consumoMensal: u.consumoMensal });
  };
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Energia consumida no período</p>
        {res.informados > 0 && (
          <p className="font-mono text-xs text-muted">
            Total {kwh(res.total)} kWh · média {kwh(res.media)} kWh/mês{contratadaMes > 0 ? ` · ${ratio(res.media / contratadaMes)} da contratada` : ""}
          </p>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">Soma do consumo de todas as UCs. Orange → Relatório Gerencial GD → escolha a competência → última aba → total. Digite o total de cada mês (ou cole a coluna do Excel no primeiro mês). A média entra no balanço e na planilha modelo.</p>
      {res.informados === 0 && estimativa > 0 && (
        <p className="mt-2 rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-2 text-xs">
          Sem valores digitados, o sistema usa uma estimativa automática: soma do consumo compensável das {usina.ucs.length} UCs ≈ <strong className="font-mono">{kwh(estimativa)} kWh/mês</strong>
          {contratadaMes > 0 ? ` (${ratio(estimativa / contratadaMes)} da contratada)` : ""}. Fica um pouco abaixo do real (não inclui o consumo mínimo de cada UC). Para o número exato, digite o total do relatório.
        </p>
      )}
      {res.linhas.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted">Informe o início e o fim do período para abrir os meses.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {res.linhas.map((l, k) => (
              <label key={l.competencia} className="block">
                <span className="mb-1 block text-xs font-medium text-foreground/80">{rotuloCompetencia(l.competencia)}</span>
                <span className="relative block">
                  <EntradaNumero
                    value={l.kwh}
                    onValor={(v) => definir(l.competencia, v)}
                    casas={2}
                    placeholder={k === 0 ? "ex.: 619.886,12" : undefined}
                    onPaste={(e) => colar(k, e)}
                    aria-label={`Energia consumida em ${rotuloCompetencia(l.competencia)}`}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 pr-10 font-mono text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-muted">kWh</span>
                </span>
              </label>
            ))}
          </div>
          {res.faltando > 0 && res.informados > 0 && <p className="mt-2 text-xs text-analysis">{res.faltando} competência(s) sem valor: a média usa só as informadas.</p>}
          {pareceMwh && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-analysis/40 bg-analysis/10 px-3 py-2 text-xs">
              <TriangleAlert className="size-4 shrink-0 text-analysis" />
              <span className="min-w-0 flex-1">
                Os valores parecem estar em MWh ou com vírgula no lugar do ponto (ex.: 619,886 em vez de 619.886). A soma do compensável das UCs é {kwh(estimativa)} kWh/mês.
              </span>
              <button type="button" onClick={() => onChange({ consumoMensal: usina.consumoMensal.map((c) => ({ ...c, kwh: Math.round(c.kwh * 1000 * 100) / 100 })) })} className="font-semibold text-primary-text hover:underline">
                Converter para kWh (×1.000)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DadosUsina({ usina, onChange }: { usina: Usina; onChange: (p: Partial<Usina>) => void }) {
  const faltam = !(usina.energiaInjetadaPeriodo > 0 && usina.meses > 0) && !(usina.injecaoMensalProjetada && usina.injecaoMensalProjetada > 0);
  const [aberto, setAberto] = useState(faltam);
  const n0 = (v: number | null) => v ?? 0;
  return (
    <Card>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-semibold">Dados da usina</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {faltam ? <Badge tone="attention">Falta a injeção</Badge> : `Injeção do estudo ${kwh(injecaoMensal(usina))} kWh/mês${usina.fonteInjecao === "fatura" ? " (fatura)" : usina.fontePeriodo === "painel" ? " (tela do Orange)" : ""}`}
          <span aria-hidden>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto && (
        <div className="space-y-5 border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoTexto label="Nome da usina" value={usina.nome} onChange={(v) => onChange({ nome: v })} />
            <CampoTexto label="Distribuidora" value={usina.distribuidora} onChange={(v) => onChange({ distribuidora: v })} />
            <CampoTexto label="Fornecedor" value={usina.fornecedor} onChange={(v) => onChange({ fornecedor: v })} />
            <CampoMes label="Início do período" value={usina.periodoInicio} onChange={(v) => onChange(periodo(usina, v, usina.periodoFim))} />
            <CampoMes label="Fim do período" value={usina.periodoFim} onChange={(v) => onChange(periodo(usina, usina.periodoInicio, v))} />
            <CampoNumero label="Meses da análise" value={usina.meses || null} onChange={(v) => onChange({ meses: n0(v), fontePeriodo: "manual" })} step="1" />
            <CampoNumero label="Energia contratada no período" sufixo="kWh" value={usina.energiaContratadaPeriodo || null} onChange={(v) => onChange({ energiaContratadaPeriodo: n0(v), fontePeriodo: "manual" })} />
            <CampoNumero label="Energia gerada no período" sufixo="kWh" value={usina.energiaGeradaPeriodo || null} onChange={(v) => onChange({ energiaGeradaPeriodo: n0(v), fontePeriodo: "manual" })} />
            <CampoNumero label="Energia injetada no período" sufixo="kWh" value={usina.energiaInjetadaPeriodo || null} onChange={(v) => onChange({ energiaInjetadaPeriodo: n0(v), fontePeriodo: "manual" })} />
            <CampoNumero
              label="Injeção mensal projetada"
              sufixo="kWh"
              value={usina.injecaoMensalProjetada}
              onChange={(v) => onChange({ injecaoMensalProjetada: v && v > 0 ? v : null, fonteInjecao: "manual" })}
              dica={usina.meses > 0 ? `Vazio = média do período (${kwh(usina.energiaInjetadaPeriodo / usina.meses)})` : "Vazio = injetada ÷ meses"}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Sazonalidade da geração</p>
              {usina.perfilSazonal.length === 12 ? (
                <button type="button" onClick={() => onChange({ perfilSazonal: [] })} className="text-xs font-medium text-primary-text hover:underline">
                  Tirar sazonalidade
                </button>
              ) : (
                <button type="button" onClick={() => onChange({ perfilSazonal: Array(12).fill(100) })} className="text-xs font-medium text-primary-text hover:underline">
                  Usar sazonalidade
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">Informe a geração ou injeção típica de cada mês (qualquer unidade: só a proporção entre os meses é usada). Sem isso, a projeção usa a média em todos os meses.</p>
            {usina.perfilSazonal.length === 12 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                {usina.perfilSazonal.map((v, m) => (
                  <CampoNumero key={m} label={MESES_CURTOS[m]} value={v} onChange={(nv) => onChange({ perfilSazonal: usina.perfilSazonal.map((x, k) => (k === m ? n0(nv) : x)) })} />
                ))}
              </div>
            )}
          </div>
          <EnergiaConsumida usina={usina} onChange={onChange} />
          <UltrapassagemDemanda usina={usina} onChange={onChange} />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Calendario({ itens, usinas, onAnalisar }: { itens: ItemCalendario[]; usinas: Usina[]; onAnalisar: (i: ItemCalendario) => void }) {
  const [conc, setConc] = useState("");
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const concs = [...new Set(itens.map((i) => i.concessionaria))].sort();
  const meses = [...new Set(itens.map((i) => i.mesCiclo))].sort();
  const nq = norm(q);
  const visiveis = itens.filter((i) => (!conc || i.concessionaria === conc) && (!mes || i.mesCiclo === mes) && (!nq || norm(`${i.usina} ${i.fornecedor} ${i.responsavel}`).includes(nq)));
  const atrasadas = itens.filter((i) => i.diasAtraso > 0 || /atras|negad|correc/i.test(norm(i.status))).length;
  const naoIniciadas = itens.filter((i) => /a solicitar|nao inic/i.test(norm(i.status))).length;
  const ucs = itens.reduce((a, i) => a + i.ucs, 0);
  const mesLabel = (m: string) => (m ? `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}` : "—");
  const sel = "h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Atualizações no calendário" valor={String(itens.length)} />
        <Kpi label="UCs no escopo" valor={kwh(ucs)} />
        <Kpi label="Atrasadas ou com negativa" valor={String(atrasadas)} bom={atrasadas ? false : null} />
        <Kpi label="A solicitar" valor={String(naoIniciadas)} />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <select value={conc} onChange={(e) => setConc(e.target.value)} className={sel} aria-label="Concessionária">
            <option value="">Todas as distribuidoras</option>
            {concs.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className={sel} aria-label="Mês do ciclo">
            <option value="">Todos os ciclos</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesLabel(m)}
              </option>
            ))}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usina, fornecedor ou responsável" className={cn(sel, "sm:ml-auto sm:w-72")} aria-label="Buscar no calendário" />
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-ink-2 text-left text-xs text-muted">
              <tr>
                {["Usina", "Distribuidora", "Ciclo", "UCs", "Fornecedor", "Responsável", "Etapa / status", ""].map((h) => (
                  <th key={h} className={cn("px-3 py-2.5 font-medium", h === "UCs" && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => {
                const aberta = usinas.some((u) => norm(u.nome) === norm(i.usina));
                return (
                  <tr key={i.id} className="border-t border-border/60 hover:bg-subtle/50">
                    <td className="px-3 py-2 font-medium">{i.usina}</td>
                    <td className="px-3 py-2 text-muted">{i.concessionaria}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {mesLabel(i.mesCiclo)} · G{i.grupo || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{kwh(i.ucs)}</td>
                    <td className="px-3 py-2 text-muted">{i.fornecedor}</td>
                    <td className="px-3 py-2 text-muted">{i.responsavel}</td>
                    <td className="px-3 py-2">
                      <p className="text-[13px]">{i.status || i.etapaAtual}</p>
                      <p className="text-[11px] text-muted">
                        {i.etapaAtual}
                        {i.diasAtraso > 0 && <span className="text-attention"> · {i.diasAtraso} dias de atraso</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant={aberta ? "secondary" : "primary"} onClick={() => onAnalisar(i)}>
                        {aberta ? "Abrir" : "Analisar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Candidatas({ resultado, onImportar, onLimpar }: { resultado: ReturnType<typeof analisarProjeto>["candidatas"]; onImportar: () => void; onLimpar: () => void }) {
  const incl = resultado.filter((c) => c.selecionada);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Candidatas" valor={String(resultado.length)} />
        <Kpi label="Elegíveis" valor={String(resultado.filter((c) => c.elegivel).length)} />
        <Kpi label="Incluídas no estudo" valor={String(incl.length)} />
        <Kpi label="Compensável incluído" valor={`${kwh(incl.reduce((a, c) => a + c.candidata.compensavelKwh, 0))} kWh`} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="font-semibold">Novas UCs</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onImportar}>
              <Upload className="size-4" /> Importar
            </Button>
            {resultado.length > 0 && (
              <Button size="sm" variant="ghost" onClick={onLimpar}>
                Limpar lista
              </Button>
            )}
          </div>
        </div>
        {resultado.length ? <TabelaCandidatas candidatas={resultado} /> : <p className="px-4 py-10 text-center text-sm text-muted">Importe a lista de novas UCs (UC, Endereço ID, Tipo Tensão, Média kWh).</p>}
      </Card>
    </div>
  );
}

function ParametrosPainel({ params: p, sugestao, subgrupos, onChange }: { params: Parametros; sugestao?: SugestaoCobertura | null; subgrupos: string[]; onChange: (p: Parametros) => void }) {
  const set = <K extends keyof Parametros>(k: K, v: Parametros[K]) => onChange({ ...p, [k]: v });
  const n = (v: number | null, fallback: number) => (v == null || !Number.isFinite(v) ? fallback : v);
  return (
    <Card className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Parâmetros do estudo</h2>
          <p className="text-sm text-muted">Valem para todas as usinas. O resultado recalcula na hora.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onChange(PARAMETROS_PADRAO)}>
          Restaurar padrão
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["otimizado", "Otimizado (programação linear)", "Programação linear inteira (HiGHS) + refino exato na grade de 0,01%: acha o rateio que compensa mais (em kWh ou em R$), mês a mês e UC por UC, também com consumo menor. Escolhe quais UCs entram e saem."],
            ["proporcional", "Regra proporcional", "Percentual proporcional à necessidade de cada UC (cobertura e queima de saldo). Mais simples de explicar; serve de comparação."],
          ] as const
        ).map(([v, t, d]) => (
          <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 text-sm", p.metodo === v ? "border-primary bg-primary-soft/40" : "border-border")}>
            <input type="radio" name="metodo" checked={p.metodo === v} onChange={() => set("metodo", v)} className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              <span className="block font-semibold">{t}</span>
              <span className="mt-0.5 block text-xs text-muted">{d}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <CampoNumero
            label="Máximo compensável (regra proporcional)"
            sufixo="%"
            value={Math.round(p.cobertura * 1000) / 10}
            onChange={(v) => onChange({ ...p, coberturaAutomatica: false, cobertura: Math.min(FAIXA_COBERTURA.max, Math.max(FAIXA_COBERTURA.min, n(v, 90) / 100)) })}
            dica={p.metodo === "otimizado" ? "No otimizado é livre por UC. Este valor só vale para a regra proporcional (comparação)." : "Parte do consumo compensável que o crédito tenta cobrir."}
          />
          <label className="mt-1.5 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={p.coberturaAutomatica !== false} onChange={(e) => set("coberturaAutomatica", e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
            Automático (recomendado){p.coberturaAutomatica !== false && sugestao === undefined ? ": calculando…" : ""}
          </label>
        </div>
        <CampoNumero label="Horizonte para gastar o saldo" sufixo="meses" step="1" value={p.horizonteSaldoMeses} onChange={(v) => set("horizonteSaldoMeses", Math.max(1, Math.round(n(v, 12))))} dica="Em quantos meses o saldo acima da reserva deve ser usado." />
        <CampoNumero label="Reserva de saldo" sufixo="meses" value={p.reservaSaldoMeses} onChange={(v) => set("reservaSaldoMeses", Math.max(0, n(v, 1)))} dica="Na regra proporcional, só o saldo acima disso é gasto no horizonte. No otimizado é só desempate: ele gasta o saldo sempre que isso compensa mais energia." />
        <CampoNumero label="Casas decimais do percentual" step="1" value={p.casasDecimais} onChange={(v) => set("casasDecimais", Math.min(6, Math.max(0, Math.round(n(v, 2)))))} dica="Confirme com a distribuidora (CPFL aceita até 2)." />
        <CampoNumero label="Percentual mínimo por UC" sufixo="%" value={p.pctMinimo} onChange={(v) => set("pctMinimo", Math.max(10 ** -p.casasDecimais, n(v, 0.01)))} />
        <CampoNumero label="Compensável mínimo da candidata" sufixo="kWh" value={p.compensavelMinimoCandidata} onChange={(v) => set("compensavelMinimoCandidata", Math.max(0, n(v, 100)))} dica="Candidatas menores não entram." />
        <CampoNumero label="Meses da projeção" step="1" value={p.mesesSimulacao} onChange={(v) => set("mesesSimulacao", Math.min(60, Math.max(1, Math.round(n(v, 12)))))} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground/80">Mês em que o novo rateio começa</span>
          <select value={p.mesInicio} onChange={(e) => set("mesInicio", Number(e.target.value))} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none">
            {MESES_CURTOS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted">A distribuidora aplica no ciclo seguinte ao pedido.</span>
        </label>
        <CampoNumero label="Custo de incluir uma UC (otimizado)" sufixo="kWh" value={p.custoNovaUcKwh} onChange={(v) => set("custoNovaUcKwh", Math.max(0, n(v, 500)))} dica="Só inclui UC nova se o ganho passar disso. Evita incluir UC por ganho mínimo." />
        <CampoNumero label="Consumo no cenário de estresse" sufixo="%" value={Math.round(p.fatorConsumoEstresse * 100)} onChange={(v) => set("fatorConsumoEstresse", Math.min(1.5, Math.max(0.3, n(v, 90) / 100)))} dica="90% = consumo 10% menor que a média." />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["incluirNovasUcs", "Incluir novas UCs quando sobra injeção"],
            ["permitirRetirar", "Retirar UCs com saldo para todo o horizonte"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
            {label}
          </label>
        ))}
        <label className="block rounded-xl border border-border p-3 text-sm">
          <span className="mb-1 block text-xs font-medium text-foreground/80">Dimensionar novas UCs para</span>
          <select value={p.dimensionarNovas} onChange={(e) => set("dimensionarNovas", e.target.value as Parametros["dimensionarNovas"])} className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground">
            <option value="queima">Gastar o saldo no horizonte</option>
            <option value="estrutural">Só equilibrar a usina</option>
          </select>
        </label>
      </div>
      <div>
        <p className="text-sm font-medium">Valor do kWh compensado por subgrupo (foco em lucro)</p>
        <p className="mt-0.5 text-xs text-muted">
          Opcional, em R$/kWh com impostos. Vazio = todo kWh vale o mesmo. Com valores, o otimizado maximiza reais: quando falta energia, o crédito vai primeiro para onde o kWh vale mais (ex.: grupo B antes do grupo A). &quot;B&quot; vale para as novas UCs e para subgrupos B sem valor próprio.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {subgrupos.map((sg) => (
            <CampoNumero
              key={sg}
              label={sg}
              sufixo="R$"
              value={p.valorKwhSubgrupo?.[sg] ?? null}
              onChange={(v) => {
                const m = { ...(p.valorKwhSubgrupo ?? {}) };
                if (v != null && v > 0) m[sg] = v;
                else delete m[sg];
                set("valorKwhSubgrupo", m);
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Metodologia() {
  const [titulo, ...itens] = METODOLOGIA;
  return (
    <Card className="p-5 sm:p-7">
      <Eyebrow>Metodologia</Eyebrow>
      <h2 className="mt-3 text-xl font-semibold">{titulo}</h2>
      <ol className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground/85">
        {itens.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </Card>
  );
}

function ColarDialog({ usinas, inicial, onClose, onAplicar }: { usinas: Usina[]; inicial: string; onClose: () => void; onAplicar: (destino: string, texto: string) => string | null }) {
  const [destino, setDestino] = useState(usinas.some((u) => u.id === inicial) ? inicial : inicial === "candidatas" ? "candidatas" : "nova");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="colar-titulo" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="colar-titulo" className="text-lg font-semibold">
            Colar tabela
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Copie a tabela do Orange ou do Excel, com a linha de cabeçalho, e cole abaixo.</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-foreground/80">Destino</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground">
            {usinas.map((u) => (
              <option key={u.id} value={u.id}>
                UCs da {u.nome}
              </option>
            ))}
            <option value="nova">UCs de uma usina nova (separa pela coluna Nome da Usina)</option>
            <option value="candidatas">Novas UCs (candidatas)</option>
          </select>
        </label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Tabela colada" placeholder="Cole aqui (Ctrl+V)" className="mt-3 h-56 w-full rounded-xl border border-border bg-subtle/40 p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
        {erro && <p className="mt-2 text-sm text-attention">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!texto.trim()} onClick={() => setErro(onAplicar(destino, texto))}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MetodoInfo({ otimizacao: o, refino }: { otimizacao: OtimizacaoUi; refino?: ResultadoUsina["refino"] }) {
  let texto: string;
  let cls = "text-muted";
  if (o.metodoPedido === "proporcional") texto = "Método: regra proporcional à necessidade";
  else if (o.rodando) {
    texto = "Otimizando o rateio…";
    cls = "text-primary-text";
  } else if (o.metodoUsado === "otimizado" && o.info) {
    texto = `Rateio otimizado (programação linear) · ${o.info.otimo ? "solução ótima comprovada" : "melhor solução no tempo limite"} em ${(o.info.tempoMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s · ${o.info.variaveis.toLocaleString("pt-BR")} variáveis · refino exato na grade de percentuais${refino && refino.ganhoKwh > 0.5 ? ` (+${kwh(refino.ganhoKwh)} kWh sobre o arredondamento)` : ""}`;
    cls = "text-opportunity";
  } else {
    texto = `Otimização indisponível${o.info?.erro ? ` (${o.info.erro})` : ""}: usando a regra proporcional`;
    cls = "text-analysis";
  }
  return (
    <p className={cn("mt-1 flex items-center gap-1.5 text-xs font-medium", cls)}>
      {o.rodando ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
      {texto}
    </p>
  );
}

interface ItemRegistro {
  hora: string;
  texto: string;
  tipo: "ok" | "info" | "atencao" | "erro";
}

type NivelStatus = "ok" | "atencao" | "erro" | "calculando";

interface StatusGeral {
  nivel: NivelStatus;
  texto: string;
  usinas: { nome: string; itens: { ok: boolean | null; texto: string }[] }[];
}

/** Semáforo geral: energia da usina, otimização, máximo compensável e validação de cada usina. */
function avaliarStatus(resultado: ResultadoProjeto, usinas: Usina[], calculando: boolean, p: Parametros, otim: OtimizacaoResultado | null): StatusGeral {
  let erros = 0;
  let avisos = 0;
  const lista: StatusGeral["usinas"] = [];
  for (const r of resultado.usinas) {
    const u = usinas.find((x) => x.id === r.usinaId);
    if (!u || !u.ucs.length) continue;
    const itens: { ok: boolean | null; texto: string }[] = [];
    const E = injecaoMensal(u);
    itens.push(E > 0 ? { ok: true, texto: `Energia da usina: ${kwh(E)} kWh/mês` } : { ok: false, texto: "Falta a energia injetada (fatura ou dados da usina)" });
    if (E <= 0) erros++;
    if (p.metodo === "otimizado") {
      if (calculando) itens.push({ ok: null, texto: "Otimização em andamento…" });
      else if (r.metodo === "otimizado") itens.push({ ok: true, texto: `Rateio otimizado${otim?.otimo ? " (ótimo comprovado)" : ""}${r.refino && r.refino.ganhoKwh > 0.5 ? ` · refino exato +${kwh(r.refino.ganhoKwh)} kWh` : ""}` });
      else if (E > 0) {
        itens.push({ ok: false, texto: `Otimização indisponível${otim?.erro ? ` (${otim.erro})` : ""}: usando a regra proporcional` });
        avisos++;
      }
    }
    if (E > 0) {
      const lim = limiteFisico(r, "proposto", p.mesesSimulacao);
      if (lim > 0) itens.push({ ok: true, texto: `Compensa ${pct1(r.proposto.compensadoTotal / lim)} do máximo físico possível (${kwh(r.proposto.compensadoTotal - r.atual.compensadoTotal)} kWh a mais que hoje)` });
      for (const v of r.validacoes) {
        if (v.ok) continue;
        itens.push({ ok: false, texto: `${v.nivel === "erro" ? "Reprovado" : "Aviso"}: ${v.titulo}` });
        if (v.nivel === "erro") erros++;
        else avisos++;
      }
      if (u.demanda && ((u.demanda.ultrapassagemKw ?? 0) > 0 || (u.demanda.despesaUltrapassagem ?? 0) > 0))
        itens.push({ ok: false, texto: `Fora do rateio: ultrapassagem de demanda na usina${u.demanda.despesaUltrapassagem ? ` (R$ ${u.demanda.despesaUltrapassagem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} no mês)` : ""}` });
      const okVal = r.validacoes.filter((v) => v.ok).length;
      itens.push({ ok: okVal === r.validacoes.length, texto: `Validação: ${okVal} de ${r.validacoes.length} checagens ok` });
    }
    lista.push({ nome: r.usinaNome, itens });
  }
  const nivel: NivelStatus = calculando ? "calculando" : erros ? "erro" : avisos ? "atencao" : "ok";
  const texto = nivel === "calculando" ? "Calculando…" : nivel === "ok" ? "Tudo ok" : nivel === "erro" ? `${erros} pendência${erros > 1 ? "s" : ""}` : `${avisos} aviso${avisos > 1 ? "s" : ""}`;
  return { nivel, texto, usinas: lista };
}

const COR_STATUS: Record<NivelStatus, string> = {
  ok: "border-opportunity/50 bg-opportunity/15 text-opportunity",
  atencao: "border-analysis/50 bg-analysis/15 text-analysis",
  erro: "border-attention/50 bg-attention/15 text-attention",
  calculando: "border-primary/50 bg-primary-soft/60 text-primary-text",
};

function IconeStatus({ nivel, className }: { nivel: NivelStatus | "info"; className?: string }) {
  if (nivel === "calculando") return <Loader2 className={cn("animate-spin", className)} />;
  if (nivel === "ok") return <CircleCheck className={className} />;
  if (nivel === "erro") return <CircleX className={className} />;
  if (nivel === "atencao") return <TriangleAlert className={className} />;
  return <Info className={className} />;
}

function StatusBotao({ status, texto, aberto, onClick }: { status: NivelStatus; texto: string; aberto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      aria-label={`Status do estudo: ${texto}. Ver detalhes e registro`}
      className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors", COR_STATUS[status])}
    >
      <IconeStatus nivel={status} className="size-4" />
      {texto}
    </button>
  );
}

function PainelStatus({ status, registro, onFechar, onLimpar }: { status: StatusGeral; registro: ItemRegistro[]; onFechar: () => void; onLimpar: () => void }) {
  const corTipo = { ok: "text-opportunity", info: "text-muted", atencao: "text-analysis", erro: "text-attention" } as const;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <IconeStatus nivel={status.nivel} className={cn("size-4", COR_STATUS[status.nivel].split(" ").at(-1))} />
          {status.nivel === "ok" ? "Tudo certo: rateio otimizado e validado" : status.nivel === "calculando" ? "Calculando…" : status.nivel === "erro" ? "Há pendências antes de enviar" : "Pronto, com avisos"}
        </h3>
        <button type="button" onClick={onFechar} className="text-muted hover:text-foreground" aria-label="Fechar status">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] divide-y divide-border/60 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="space-y-4 p-4">
          {status.usinas.map((u) => (
            <div key={u.nome}>
              <p className="text-sm font-semibold">{u.nome}</p>
              <ul className="mt-1.5 space-y-1">
                {u.itens.map((it, k) => (
                  <li key={k} className="flex gap-2 text-sm">
                    <IconeStatus nivel={it.ok == null ? "calculando" : it.ok ? "ok" : "atencao"} className={cn("mt-0.5 size-4 shrink-0", it.ok == null ? "text-primary-text" : it.ok ? "text-opportunity" : "text-analysis")} />
                    <span className="min-w-0">{it.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="size-4 text-primary-text" /> Registro do cálculo
            </p>
            {registro.length > 0 && (
              <button type="button" onClick={onLimpar} className="text-xs text-muted hover:text-foreground">
                Limpar
              </button>
            )}
          </div>
          {registro.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Nada registrado nesta sessão ainda. Use &quot;Recalcular&quot; para refazer tudo.</p>
          ) : (
            <ol className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1" aria-label="Registro do cálculo">
              {registro.map((r, k) => (
                <li key={k} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-mono text-muted">{r.hora}</span>
                  <span className={cn("min-w-0", corTipo[r.tipo] === "text-muted" ? "text-foreground/85" : corTipo[r.tipo])}>{r.texto}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}

function MaximoCompensavel({ usina, r, params, sugestao }: { usina: Usina; r: ResultadoUsina; params: Parametros; sugestao?: SugestaoCobertura | null }) {
  const ref = usina.maximoCompensavelPlanilha ?? 0.9;
  const planilha = useMemo(() => sugerirMaximoPlanilha(usina, r, params, ref), [usina, r, params, ref]);
  const efAtual = coberturaEfetiva(r, "atual");
  const efProp = coberturaEfetiva(r, "proposto");
  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  const difPlanilha = planilha ? r.proposto.compensadoTotal - planilha.melhor.compensadoMedio : 0;
  const auto = params.coberturaAutomatica !== false;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Máximo compensável</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-muted">
            É quanto do consumo de cada UC o crédito novo da usina cobre; o resto sai do saldo acumulado da própria UC. O melhor é um valor por UC (um valor único para todas é só um caso particular, nunca rende mais): o otimizado escolhe o de cada UC, e a coluna &quot;Máx. compensável&quot; da tabela mostra cada um. Não precisa ajustar nada.
          </p>
        </div>
        <Badge tone="opportunity">Automático</Badge>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] divide-y divide-border/60 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-4">
          <p className="text-xs text-muted">{r.metodo === "otimizado" ? "Rateio que vai ser enviado (otimizado)" : "Rateio proposto"}</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{pct(efProp)}</p>
          <p className="mt-1 text-xs text-muted">
            Hoje: {pct(efAtual)}. {r.metodo === "otimizado" ? "Escolhido UC a UC: quem tem saldo grande recebe menos crédito novo, quem não tem recebe mais." : "Média das UCs no rateio proposto."}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted">Planilha modelo (célula M8)</p>
          {planilha ? (
            <>
              <p className="mt-1 font-mono text-2xl font-semibold">{pct(planilha.cobertura)}</p>
              <p className="mt-1 text-xs text-muted">
                {usina.maximoCompensavelPlanilha != null ? `Antes: ${pct(usina.maximoCompensavelPlanilha)}. ` : ""}
                {planilha.ucsAfetadas ? `Muda o percentual de ${planilha.ucsAfetadas} UC(s) com saldo alto${planilha.ganhoKwh > 0.5 ? ` (+${kwh(planilha.ganhoKwh)} kWh)` : ""}.` : "Nenhuma UC tem saldo alto o bastante para o valor fazer diferença."} Já sai preenchido na exportação.
              </p>
              {difPlanilha > 0.5 && <p className="mt-1 text-xs text-muted">Mesmo assim, o rateio do sistema compensa {kwh(difPlanilha)} kWh a mais que a planilha.</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">—</p>
          )}
        </div>
        <div className="p-4">
          <p className="text-xs text-muted">Regra proporcional (só para comparação)</p>
          {sugestao === undefined ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Calculando…
            </p>
          ) : (
            <>
              <p className="mt-1 font-mono text-2xl font-semibold">{pct(params.cobertura)}</p>
              <p className="mt-1 text-xs text-muted">{auto ? "Escolhido automaticamente: o valor (de 1% a 200%) que compensa mais energia." : `Valor manual (o melhor seria ${pct(sugestao?.cobertura ?? null)}).`}</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Comparacao({ atual, proporcional, otimizado, otimizacao, params }: { atual: ResultadoUsina; proporcional?: ResultadoUsina; otimizado?: ResultadoUsina; otimizacao: OtimizacaoUi; params: Parametros }) {
  type Col = { nome: string; r: ResultadoUsina; cen: "atual" | "proposto" };
  const cols: Col[] = [{ nome: "Rateio atual", r: atual, cen: "atual" }];
  if (proporcional) cols.push({ nome: "Regra proporcional", r: proporcional, cen: "proposto" });
  if (otimizado) cols.push({ nome: "Otimizado", r: otimizado, cen: "proposto" });
  const sim = (c: Col) => (c.cen === "atual" ? c.r.atual : c.r.proposto);
  const estresse = (c: Col) => (c.cen === "atual" ? null : c.r.propostoEstresse);
  const mudancas = (c: Col) => (c.cen === "atual" ? 0 : c.r.linhas.filter((l) => l.acao !== "manter").length);
  const linhas: { label: string; v: (c: Col) => number | null; menor: boolean; neutro?: boolean; fmt?: (n: number) => string }[] = [
    { label: "Energia compensada (kWh)", v: (c) => sim(c).compensadoTotal, menor: false },
    { label: `Compensada com consumo ${Math.round((1 - params.fatorConsumoEstresse) * 100)}% menor`, v: (c) => estresse(c)?.compensadoTotal ?? null, menor: false },
    { label: `Saldo total no fim de ${params.mesesSimulacao} meses (kWh)`, v: (c) => sim(c).saldoFinal, menor: true },
    { label: "Consumo sem crédito (kWh)", v: (c) => sim(c).consumoDescobertoTotal, menor: true },
    { label: "Crédito novo que vira saldo (kWh)", v: (c) => sim(c).creditoParaSaldoTotal, menor: true },
    { label: "Do limite físico possível", v: (c) => { const lim = limiteFisico(c.r, c.cen, params.mesesSimulacao); return lim > 0 ? sim(c).compensadoTotal / lim : null; }, menor: false, fmt: pct1 },
    { label: "Máximo compensável efetivo", v: (c) => coberturaEfetiva(c.r, c.cen), menor: false, neutro: true, fmt: ratio },
    { label: "UCs no rateio", v: (c) => (c.cen === "atual" ? c.r.indicadores.ucsAtuais : c.r.indicadores.ucsPropostas), menor: false, neutro: true, fmt: (n) => String(n) },
    { label: "UCs com percentual alterado", v: mudancas, menor: true, fmt: (n) => String(n) },
  ];
  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-semibold">Comparação de métodos</h3>
        <p className="text-xs text-muted">Mesma projeção para os três rateios; em destaque, o melhor de cada linha. Como todas as UCs são do mesmo cliente, a energia compensada é o que vale: cada kWh a mais é um kWh a menos comprado da distribuidora.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium" />
              {cols.map((c) => (
                <th key={c.nome} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {c.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const vals = cols.map(l.v);
              const validos = vals.filter((v): v is number => v != null);
              const melhor = l.neutro ? null : l.menor ? Math.min(...validos) : Math.max(...validos);
              const tol = l.fmt === ratio || l.fmt === pct1 ? 0.00005 : 0.5;
              return (
                <tr key={l.label} className="border-t border-border/60">
                  <td className="px-4 py-2 text-muted">{l.label}</td>
                  {vals.map((v, k) => (
                    <td key={k} className={cn("px-3 py-2 text-right font-mono", v != null && melhor != null && Math.abs(v - melhor) < tol && validos.length > 1 ? "font-semibold text-opportunity" : "")}>
                      {v == null ? "—" : l.fmt ? l.fmt(v) : kwh(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {otimizacao.metodoPedido === "otimizado" && !otimizado && <p className="border-t border-border px-4 py-2.5 text-xs text-muted">{otimizacao.rodando ? "Calculando o rateio otimizado…" : "O otimizado aparece aqui quando o cálculo termina."}</p>}
    </Card>
  );
}

function ValidacaoCard({ validacoes }: { validacoes: ResultadoUsina["validacoes"] }) {
  const erros = validacoes.filter((v) => !v.ok && v.nivel === "erro").length;
  const avisos = validacoes.filter((v) => !v.ok && v.nivel === "aviso").length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-semibold">Validação do rateio proposto</h3>
        <Badge tone={erros ? "attention" : avisos ? "analysis" : "opportunity"}>{erros ? `${erros} reprovada(s)` : avisos ? `${avisos} aviso(s)` : "Pronto para enviar"}</Badge>
      </div>
      <ul>
        {validacoes.map((v) => (
          <li key={v.titulo} className="flex gap-3 border-t border-border/60 px-4 py-2.5 first:border-t-0">
            {v.ok ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-opportunity" aria-label="Aprovada" />
            ) : v.nivel === "erro" ? (
              <CircleX className="mt-0.5 size-4 shrink-0 text-attention" aria-label="Reprovada" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-analysis" aria-label="Aviso" />
            )}
            <div className="min-w-0">
              <p className="text-sm">{v.titulo}</p>
              <p className="text-xs text-muted">{v.detalhe}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FichaUc({ resultado: r, indice, params, onClose, onNavegar }: { resultado: ResultadoUsina; indice: number; params: Parametros; onClose: () => void; onNavegar: (d: number) => void }) {
  const l = r.linhas[indice];
  const nAtuais = r.linhas.filter((x) => x.origem === "atual").length;
  const temAtual = indice < nAtuais;
  const comp = l.compensavelKwh;
  const meses = (v: number) => (comp > 0 ? `${(v / comp).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses` : "—");
  const serieAtual = temAtual ? [l.saldoKwh, ...r.atual.saldoPorUcMes[indice]] : undefined;
  const serieProp = [l.saldoKwh, ...r.proposto.saldoPorUcMes[indice]];
  const serieEst = [l.saldoKwh, ...r.propostoEstresse.saldoPorUcMes[indice]];
  const fimAtual = serieAtual?.at(-1) ?? null;
  const fimProp = serieProp.at(-1) ?? 0;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") onNavegar(1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") onNavegar(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, onNavegar]);
  const dados: [string, string][] = [
    ["Consumo compensável", `${kwh(comp)} kWh/mês`],
    ["Compensado (histórico)", l.origem === "atual" ? `${kwh(l.compensadoKwh)} kWh/mês` : "—"],
    ["Aproveitamento histórico", l.aproveitamentoHistorico != null ? ratio(l.aproveitamentoHistorico) : "—"],
    ["Saldo hoje", `${kwh(l.saldoKwh)} kWh · ${meses(l.saldoKwh)}`],
    ["Percentual", `${l.pctAtual.toLocaleString("pt-BR", { minimumFractionDigits: params.casasDecimais })}% → ${l.pctProposto.toLocaleString("pt-BR", { minimumFractionDigits: params.casasDecimais })}%`],
    ["Crédito por mês", `${kwh(l.creditoAtualKwh)} → ${kwh(l.creditoPropostoKwh)} kWh`],
    ["Crédito ÷ consumo", comp > 0 ? `${ratio(l.creditoAtualKwh / comp)} → ${ratio(l.creditoPropostoKwh / comp)}` : "—"],
    [`Saldo no fim (${params.mesesSimulacao} meses)`, `${fimAtual != null ? `${kwh(fimAtual)} → ` : ""}${kwh(fimProp)} kWh`],
  ];
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo" onClick={onClose}>
      <div className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-card p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>Ficha da UC</Eyebrow>
            <h2 id="ficha-titulo" className="mt-2 text-xl font-semibold break-words">
              {l.apelido || l.instalacao}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {l.instalacao}
              {l.idUnidade && ` · ID ${l.idUnidade}`}
              {l.subgrupo && ` · ${l.subgrupo}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar ficha" className="text-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ACAO_INFO[l.acao].cls)}>{ACAO_INFO[l.acao].label}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", CLASSE_INFO[l.diagnostico.classe])}>{l.diagnostico.rotulo}</span>
        </div>
        <p className="mt-3 text-sm text-foreground/85">{l.diagnostico.texto}</p>
        <p className="mt-2 text-sm text-muted">{l.motivo}</p>
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {dados.map(([k, v]) => (
            <div key={k} className="border-b border-border/50 pb-2">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-mono">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Saldo desta UC mês a mês</h3>
          <SaldoChart atual={serieAtual} proposto={serieProp} estresse={serieEst} mesesDoAno={r.proposto.meses.map((m) => m.mes)} fatorEstresse={params.fatorConsumoEstresse} />
        </div>
        <div className="mt-6 flex justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={() => onNavegar(-1)} disabled={indice === 0}>
            ← Anterior
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onNavegar(1)} disabled={indice === r.linhas.length - 1}>
            Próxima →
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

/** Pergunta para qual usina vão as UCs importadas (e se usa os dados do cabeçalho da planilha). */
function DestinoDialog({
  pendente,
  usinas,
  onCancelar,
  onConfirmar,
}: {
  pendente: { imp: Importacao; arquivos: string[]; alvo: string | null };
  usinas: Usina[];
  onCancelar: () => void;
  onConfirmar: (d: Destinos) => void;
}) {
  const importadas = pendente.imp.usinas.filter((u) => u.ucs.length);
  const arquivos = norm(pendente.arquivos.join(" "));
  const sugestao = (nova: Usina): string => {
    const mesmoNome = usinas.find((u) => norm(u.nome) === norm(nova.nome));
    if (mesmoNome) return mesmoNome.id;
    // nome de uma usina aberta aparece no nome do arquivo (ex.: "... UFV SAFIRA ....xlsx")
    const peloArquivo = usinas.find((u) => {
      const chave = norm(u.nome).replace(/^(ufv|cgh|pch|eol|ute)\s+/, "");
      return chave.length >= 3 && arquivos.includes(chave);
    });
    if (peloArquivo && importadas.length === 1) return peloArquivo.id;
    if (pendente.alvo && importadas.length === 1) return pendente.alvo;
    return "nova";
  };
  const [destino, setDestino] = useState<Record<string, string>>(() => Object.fromEntries(importadas.map((u) => [u.id, sugestao(u)])));
  const [usarDados, setUsarDados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      importadas.map((u) => {
        const d = sugestao(u);
        const alvo = usinas.find((x) => x.id === d);
        // não sobrescreve dados que já vieram da fatura ou da tela do Orange,
        // nem usa o cabeçalho de uma planilha de outra usina
        return [u.id, !alvo || (norm(alvo.nome) === norm(u.nome) && alvo.meses === 0 && !alvo.painel && alvo.injecaoMensalProjetada == null)];
      }),
    ),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="destino-titulo">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl">
        <h2 id="destino-titulo" className="text-lg font-semibold">
          Para qual usina vão estas UCs?
        </h2>
        <p className="mt-1 text-sm text-muted">{pendente.arquivos.join(", ")}</p>
        <div className="mt-4 space-y-4">
          {importadas.map((u) => {
            const d = destino[u.id];
            const alvo = usinas.find((x) => x.id === d);
            const divergente = alvo && norm(alvo.nome) !== norm(u.nome);
            return (
              <div key={u.id} className="rounded-xl border border-border p-4">
                <p className="text-sm">
                  <span className="font-semibold">{u.ucs.length} UCs</span> com &quot;Nome da Usina&quot; <span className="font-semibold">{u.nome}</span>
                </p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-foreground/80">Importar em</span>
                  <select value={d} onChange={(e) => setDestino((x) => ({ ...x, [u.id]: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground">
                    {usinas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                        {x.ucs.length ? ` (substitui ${x.ucs.length} UCs)` : ""}
                      </option>
                    ))}
                    <option value="nova">Criar a usina {u.nome}</option>
                  </select>
                </label>
                {divergente && (
                  <p className="mt-2 flex gap-1.5 text-xs text-analysis">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> A planilha diz {u.nome}, e você vai importar na {alvo.nome}. Confira se são mesmo as UCs dessa usina.
                  </p>
                )}
                {u.meses > 0 && (
                  <label className="mt-3 flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={usarDados[u.id] ?? false} onChange={(e) => setUsarDados((x) => ({ ...x, [u.id]: e.target.checked }))} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>
                      Usar também os dados da usina do cabeçalho da planilha ({u.meses} meses, injetada {kwh(u.energiaInjetadaPeriodo)} kWh)
                      <span className="block text-xs text-muted">Deixe desmarcado se a injeção vem da fatura ou da tela do Orange.</span>
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {pendente.imp.candidatas.length > 0 && <p className="mt-3 text-xs text-muted">O arquivo também traz {pendente.imp.candidatas.length} novas UCs (candidatas), que entram na lista de Novas UCs.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onConfirmar({ destino, usarDados })}>
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Quanto o rateio proposto compensa a mais que o atual, em kWh e em reais (estimativa). */
function Ganho({ r, params, onTarifa }: { r: ResultadoUsina; params: Parametros; onTarifa: (t: number) => void }) {
  const ganhoKwh = r.proposto.compensadoTotal - r.atual.compensadoTotal;
  const paradoAtual = r.atual.saldoFinal;
  const paradoProp = r.proposto.saldoFinal;
  const t = params.tarifaKwh;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  // R$ UC a UC (valor do kWh por subgrupo, ou a tarifa média)
  const vAtual = valorCompensado(r, "atual", params);
  const vProp = valorCompensado(r, "proposto", params);
  const ganhoBrl = vAtual != null && vProp != null ? vProp - vAtual : null;
  return (
    <Card className="flex flex-col gap-4 border-primary/40 bg-primary-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-primary-text uppercase">Ganho estimado em {params.mesesSimulacao} meses</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight">
          {ganhoKwh >= 0 ? "+" : ""}
          {kwh(ganhoKwh)} kWh compensados
          {ganhoBrl != null && <span className="text-volt"> ≈ {brl(ganhoBrl)}</span>}
        </p>
        <p className="mt-1 text-xs text-muted">
          Crédito parado no fim: {kwh(paradoAtual)} → {kwh(paradoProp)} kWh{t > 0 ? ` (${brl(paradoAtual * t)} → ${brl(paradoProp * t)})` : ""}. Estimativa a partir das médias; confira na fatura.
        </p>
      </div>
      <label className="shrink-0">
        <span className="mb-1 block text-xs text-muted">Tarifa média das UCs (R$/kWh)</span>
        <EntradaNumero
          placeholder="ex.: 0,85"
          value={t || null}
          onValor={(v) => onTarifa(Math.max(0, v ?? 0))}
          className="h-10 w-36 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </label>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Nome, cor, logo e responsável que aparecem no Excel do estudo. */
function IdentidadeEstudo({ marca, onChange }: { marca: MarcaEstudo; onChange: (m: MarcaEstudo) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  async function logo(file: File) {
    setErro(null);
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setErro("Use PNG ou JPG.");
    if (file.size > 1_500_000) return setErro("Logo muito grande (máx. 1,5 MB).");
    const url = await new Promise<string>((ok, falha) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => falha(r.error);
      r.readAsDataURL(file);
    });
    onChange({ ...marca, logo: url });
    if (ref.current) ref.current.value = "";
  }
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Identidade do estudo</h2>
          <p className="text-sm text-muted">Aparece no Excel exportado: cabeçalho, cores e assinatura. Fica salvo neste navegador.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onChange({ ...marca, ...MARCA_REPLACE })}>
          Usar cores da Replace
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampoTexto label="Empresa" value={marca.empresa} onChange={(v) => onChange({ ...marca, empresa: v })} />
        <CampoTexto label="Responsável técnico" value={marca.responsavel} onChange={(v) => onChange({ ...marca, responsavel: v })} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground/80">Cor principal</span>
          <span className="flex items-center gap-2">
            <input type="color" value={marca.cor} onChange={(e) => onChange({ ...marca, cor: e.target.value })} aria-label="Cor principal" className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-card" />
            <span className="font-mono text-sm text-muted">{marca.cor.toUpperCase()}</span>
          </span>
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-foreground/80">Logo (PNG ou JPG)</span>
          <input ref={ref} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && logo(e.target.files[0])} />
          <div className="flex items-center gap-2">
            {marca.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local (data URL)
              <img src={marca.logo} alt="Logo do estudo" className="h-10 max-w-28 rounded bg-white object-contain p-1" />
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => ref.current?.click()}>
              {marca.logo ? "Trocar" : "Enviar logo"}
            </Button>
            {marca.logo && (
              <Button size="sm" variant="ghost" onClick={() => onChange({ ...marca, logo: null })}>
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
      {erro && <p className="text-sm text-attention">{erro}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Escolha do formato do estudo: PDF para enviar, Excel para trabalhar, ou a planilha modelo. */
function ExportarDialog({ escopo, umaUsina, ocupado, onFechar, onEscolher }: { escopo: string; umaUsina: boolean; ocupado: boolean; onFechar: () => void; onEscolher: (f: "pdf" | "excel" | "modelo") => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);
  const opcoes = [
    { f: "pdf" as const, icone: FileText, titulo: "PDF executivo", tag: "Para enviar", desc: "Resumo em 1 página, parecer com assinaturas e o Anexo I com as UCs. Pronto para mandar ou imprimir." },
    { f: "excel" as const, icone: FileSpreadsheet, titulo: "Excel completo", tag: "Para trabalhar", desc: "Estudo, Anexo I, lista de envio para a distribuidora, detalhe por UC e memória de cálculo." },
    ...(umaUsina ? [{ f: "modelo" as const, icone: FileSpreadsheet, titulo: "Planilha modelo", tag: "Seu formato", desc: "A sua planilha de análise preenchida, com as fórmulas originais e a coluna do rateio proposto." }] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="exportar-titulo" onClick={onFechar}>
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="exportar-titulo" className="text-lg font-semibold">
              Exportar estudo
            </h2>
            <p className="text-sm text-muted">{escopo}</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {opcoes.map((o, i) => (
            <button
              key={o.f}
              type="button"
              disabled={ocupado}
              onClick={() => onEscolher(o.f)}
              className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60", i === 0 ? "border-primary bg-primary-soft/40 hover:bg-primary-soft/70" : "border-border hover:bg-subtle")}
            >
              <o.icone className={cn("mt-0.5 size-5 shrink-0", i === 0 ? "text-primary-text" : "text-muted")} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.titulo}</span>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">{o.tag}</span>
                </span>
                <span className="mt-1 block text-sm text-muted">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {ocupado && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Gerando o arquivo…
          </p>
        )}
      </div>
    </div>
  );
}
