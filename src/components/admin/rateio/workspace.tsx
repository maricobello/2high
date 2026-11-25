"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardPaste,
  Copy,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Info,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { analisarProjeto, injecaoMensal } from "@/modules/rateio/engine";
import { exemplo } from "@/modules/rateio/exemplo";
import { importarSheets, parseCandidatas, parseUcs, textoParaGrid, usinaVazia, type Importacao, type ItemCalendario } from "@/modules/rateio/grid";
import { norm } from "@/modules/rateio/normalize";
import { montarResumo, parecerPadrao } from "@/modules/rateio/parecer";
import { PARAMETROS_PADRAO, type Alerta, type Candidata, type Parametros, type ResultadoUsina, type Usina } from "@/modules/rateio/types";
import { METODOLOGIA } from "@/modules/rateio/metodologia";
import { SaldoChart } from "./chart";
import { kwh, MESES_CURTOS, ratio } from "./format";
import { TabelaCandidatas, TabelaRateio } from "./tabelas";

interface Parecer {
  texto: string;
  fonte: "llm" | "template";
}

interface Estado {
  usinas: Usina[];
  candidatas: Candidata[];
  calendario: ItemCalendario[];
  params: Parametros;
  pareceres: Record<string, Parecer>;
  exemplo: boolean;
}

const VAZIO: Estado = { usinas: [], candidatas: [], calendario: [], params: PARAMETROS_PADRAO, pareceres: {}, exemplo: false };
const STORAGE = "aferi:rateio:v1";

function carregar(): Estado | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const e = JSON.parse(raw) as Estado;
    return { ...VAZIO, ...e, params: validarParametros({ ...PARAMETROS_PADRAO, ...e.params }) };
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
    cobertura: Math.min(1, Math.max(0.1, n(p.cobertura, D.cobertura))),
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

function mesclar(atual: Estado, imp: Importacao, alvo: string | null): { estado: Estado; abrir: string | null } {
  const base = atual.exemplo ? { ...VAZIO, params: atual.params } : atual;
  const calendario = imp.calendario.length ? imp.calendario : base.calendario;
  const usinas = [...base.usinas];
  let abrir: string | null = null;
  for (const nova of imp.usinas) {
    let idx = usinas.findIndex((u) => norm(u.nome) === norm(nova.nome));
    if (idx < 0 && alvo && imp.usinas.length === 1) idx = usinas.findIndex((u) => u.id === alvo);
    if (idx >= 0) {
      const u = usinas[idx];
      usinas[idx] = {
        ...u,
        ucs: nova.ucs.length ? nova.ucs : u.ucs,
        distribuidora: u.distribuidora || nova.distribuidora,
        ...(nova.meses > 0
          ? { periodoInicio: nova.periodoInicio, periodoFim: nova.periodoFim, meses: nova.meses, energiaContratadaPeriodo: nova.energiaContratadaPeriodo, energiaGeradaPeriodo: nova.energiaGeradaPeriodo, energiaInjetadaPeriodo: nova.energiaInjetadaPeriodo, consumoMensal: nova.consumoMensal }
          : {}),
      };
      abrir = u.id;
    } else {
      usinas.push(nova);
      abrir = nova.id;
    }
  }
  // candidatas reimportadas substituem as antigas; repetidas no mesmo arquivo ficam (o motor aponta a duplicidade)
  const novasKeys = new Set(imp.candidatas.map((c) => c.key));
  const candidatas = [...base.candidatas.filter((c) => !novasKeys.has(c.key)), ...imp.candidatas];
  const params = imp.maximoCompensavel ? { ...base.params, cobertura: Math.min(1, Math.max(0.1, imp.maximoCompensavel)) } : base.params;
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
  const [ocupado, setOcupado] = useState(false);
  const [colar, setColar] = useState(false);
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
  const candD = useDeferredValue(estado.candidatas);
  const paramsD = useDeferredValue(estado.params);
  const resultado = useMemo(() => analisarProjeto(usinasD, candD, paramsD), [usinasD, candD, paramsD]);

  const temDados = estado.usinas.length > 0 || estado.calendario.length > 0 || estado.candidatas.length > 0;
  const abaAtual = aba === "inicio" ? (estado.calendario.length ? "calendario" : (estado.usinas[0]?.id ?? "inicio")) : aba;

  function atualizarUsina(id: string, patch: Partial<Usina>) {
    setEstado((e) => ({ ...e, usinas: e.usinas.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  }

  async function importar(files: FileList | File[]) {
    const lista = [...files];
    if (!lista.length) return;
    setOcupado(true);
    try {
      const { lerArquivo } = await import("@/modules/rateio/xlsx");
      const sheets = (await Promise.all(lista.map(async (f) => (await lerArquivo(f)).map((s) => ({ ...s, name: lista.length > 1 ? `${f.name} › ${s.name}` : s.name }))))).flat();
      const imp = importarSheets(sheets);
      const { estado: novo, abrir } = mesclar(estadoRef.current, imp, alvoImport.current);
      estadoRef.current = novo;
      setEstado(novo);
      if (abrir) setAba(abrir);
      const avisosImp = imp.avisos.length ? imp.avisos : ["Nenhuma tabela reconhecida no arquivo."];
      setAvisos(imp.maximoCompensavel ? [...avisosImp, `Cobertura ajustada para ${Math.round(novo.params.cobertura * 100)}% (Máximo Compensável da planilha).`] : avisosImp);
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

  async function exportar() {
    setOcupado(true);
    try {
      const { exportarXlsx } = await import("@/modules/rateio/xlsx");
      const textos = Object.fromEntries(Object.entries(estado.pareceres).map(([k, v]) => [k, v.texto]));
      const blob = await exportarXlsx(estado.usinas, resultado, estado.params, textos);
      const nome = estado.usinas.map((u) => u.nome.replace(/\s+/g, "-")).join("_").slice(0, 60) || "rateio";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `estudo-rateio_${nome}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } finally {
      setOcupado(false);
    }
  }

  function carregarExemplo() {
    const ex = exemplo();
    setEstado({ ...VAZIO, ...ex, exemplo: true });
    setAba(ex.usinas[0].id);
    setAvisos(["Exemplo com dados fictícios carregado. Importe suas planilhas para substituir."]);
  }

  function limpar() {
    if (!confirm("Apagar todas as usinas, candidatas e o calendário deste navegador?")) return;
    setEstado(VAZIO);
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
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" multiple hidden onChange={(e) => e.target.files && importar(e.target.files)} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Rateio GD</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Revisão de rateio de créditos de geração distribuída: importe o calendário, as UCs da usina e as candidatas; o estudo sai pronto em Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => abrirImport()} disabled={ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Importar planilhas
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setColar(true)}>
            <ClipboardPaste className="size-4" /> Colar tabela
          </Button>
          <Button size="sm" variant="secondary" onClick={exportar} disabled={!estado.usinas.some((u) => u.ucs.length) || ocupado}>
            <Download className="size-4" /> Exportar estudo
          </Button>
          {temDados && (
            <Button size="sm" variant="ghost" onClick={limpar} aria-label="Limpar dados">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

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
        <Vazio onImportar={() => abrirImport()} onExemplo={carregarExemplo} ocupado={ocupado} />
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
          {abaAtual === "parametros" && <ParametrosPainel params={estado.params} onChange={(p) => setEstado((e) => ({ ...e, params: p }))} />}
          {abaAtual === "metodologia" && <Metodologia />}
          {usinaAtiva && resAtivo && (
            <UsinaPainel
              usina={usinaAtiva}
              resultado={resAtivo}
              params={estado.params}
              parecer={estado.pareceres[usinaAtiva.id]}
              calendario={itemDoCalendario(estado.calendario, usinaAtiva.nome)}
              onChange={(patch) => atualizarUsina(usinaAtiva.id, patch)}
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

function Vazio({ onImportar, onExemplo, ocupado }: { onImportar: () => void; onExemplo: () => void; ocupado: boolean }) {
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

function CampoNumero({ label, value, onChange, sufixo, dica, step = "any" }: { label: string; value: number | null; onChange: (v: number | null) => void; sufixo?: string; dica?: string; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/80">{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
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

function UsinaPainel({
  usina,
  resultado: r,
  params,
  parecer,
  calendario,
  onChange,
  onImportar,
  onParecer,
  onRemover,
}: {
  usina: Usina;
  resultado: ResultadoUsina;
  params: Parametros;
  parecer?: Parecer;
  calendario?: ItemCalendario;
  onChange: (p: Partial<Usina>) => void;
  onImportar: () => void;
  onParecer: (p: Parecer) => void;
  onRemover: () => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const i = r.indicadores;
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onImportar}>
            <Upload className="size-4" /> {semUcs ? "Importar UCs" : "Atualizar UCs"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemover} aria-label={`Remover ${usina.nome}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <DadosUsina usina={usina} onChange={onChange} />

      {semUcs ? (
        <Card className="p-8 text-center">
          <p className="font-semibold">Falta a lista de UCs desta usina</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Importe o export da Unidade Rateio GD do Orange (ou a planilha modelo) ou cole a tabela. Precisa das colunas N° de Instalação, % do Rateio, Saldo e Consumo Compensável.</p>
          <Button className="mt-5" size="sm" onClick={onImportar}>
            <Upload className="size-4" /> Importar UCs
          </Button>
        </Card>
      ) : (
        <>
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
              <SaldoChart atual={r.atual} proposto={r.proposto} estresse={r.propostoEstresse} fatorEstresse={params.fatorConsumoEstresse} />
            </Card>
            <Card className="p-4 sm:p-5">
              <h3 className="mb-3 font-semibold">Balanço da usina</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Injeção mensal", `${kwh(E)} kWh`],
                  ["Contratada mensal", i.contratadaMensal ? `${kwh(i.contratadaMensal)} kWh` : "—"],
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
            <TabelaRateio linhas={r.linhas} casas={params.casasDecimais} />
          </Card>

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

function DadosUsina({ usina, onChange }: { usina: Usina; onChange: (p: Partial<Usina>) => void }) {
  const faltam = !(usina.energiaInjetadaPeriodo > 0 && usina.meses > 0) && !(usina.injecaoMensalProjetada && usina.injecaoMensalProjetada > 0);
  const [aberto, setAberto] = useState(faltam);
  const n0 = (v: number | null) => v ?? 0;
  return (
    <Card>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-semibold">Dados da usina</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {faltam ? <Badge tone="attention">Falta a injeção</Badge> : `${usina.meses} meses · injetada ${kwh(usina.energiaInjetadaPeriodo)} kWh`}
          <span aria-hidden>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto && (
        <div className="space-y-5 border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoTexto label="Nome da usina" value={usina.nome} onChange={(v) => onChange({ nome: v })} />
            <CampoTexto label="Distribuidora" value={usina.distribuidora} onChange={(v) => onChange({ distribuidora: v })} />
            <CampoTexto label="Fornecedor" value={usina.fornecedor} onChange={(v) => onChange({ fornecedor: v })} />
            <CampoNumero label="Meses da análise" value={usina.meses || null} onChange={(v) => onChange({ meses: n0(v) })} step="1" />
            <CampoNumero label="Energia contratada no período" sufixo="kWh" value={usina.energiaContratadaPeriodo || null} onChange={(v) => onChange({ energiaContratadaPeriodo: n0(v) })} />
            <CampoNumero label="Energia gerada no período" sufixo="kWh" value={usina.energiaGeradaPeriodo || null} onChange={(v) => onChange({ energiaGeradaPeriodo: n0(v) })} />
            <CampoNumero label="Energia injetada no período" sufixo="kWh" value={usina.energiaInjetadaPeriodo || null} onChange={(v) => onChange({ energiaInjetadaPeriodo: n0(v) })} />
            <CampoNumero
              label="Injeção mensal projetada"
              sufixo="kWh"
              value={usina.injecaoMensalProjetada}
              onChange={(v) => onChange({ injecaoMensalProjetada: v && v > 0 ? v : null })}
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
          {usina.consumoMensal.length > 0 && (
            <div>
              <p className="text-sm font-medium">Consumo mensal informado</p>
              <p className="mt-1 font-mono text-xs text-muted">{usina.consumoMensal.map((c) => `${c.mes} ${kwh(c.kwh)}`).join(" · ")}</p>
            </div>
          )}
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

function ParametrosPainel({ params: p, onChange }: { params: Parametros; onChange: (p: Parametros) => void }) {
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CampoNumero label="Cobertura do compensável" sufixo="%" value={Math.round(p.cobertura * 1000) / 10} onChange={(v) => set("cobertura", Math.min(1, Math.max(0.1, n(v, 90) / 100)))} dica="Parte do consumo compensável que o crédito tenta cobrir. O resto é margem para queda de consumo." />
        <CampoNumero label="Horizonte para gastar o saldo" sufixo="meses" step="1" value={p.horizonteSaldoMeses} onChange={(v) => set("horizonteSaldoMeses", Math.max(1, Math.round(n(v, 12))))} dica="Em quantos meses o saldo acima da reserva deve ser usado." />
        <CampoNumero label="Reserva de saldo" sufixo="meses" value={p.reservaSaldoMeses} onChange={(v) => set("reservaSaldoMeses", Math.max(0, n(v, 1)))} dica="Saldo mantido por UC, em meses de consumo." />
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
