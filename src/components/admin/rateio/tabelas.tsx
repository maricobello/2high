"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { norm } from "@/modules/rateio/normalize";
import type { Acao, CandidataAvaliada, ClasseUc, LinhaRateio } from "@/modules/rateio/types";
import { kwh, num, pct } from "./format";

export const ACAO_INFO: Record<Acao, { label: string; cls: string }> = {
  manter: { label: "Manter", cls: "bg-subtle text-muted" },
  aumentar: { label: "Aumentar", cls: "bg-opportunity-soft text-opportunity" },
  reduzir: { label: "Reduzir", cls: "bg-analysis-soft text-analysis" },
  retirar: { label: "Retirar", cls: "bg-attention-soft text-attention" },
  incluir: { label: "Incluir", cls: "bg-primary-soft text-primary-text" },
};

export const CLASSE_INFO: Record<ClasseUc, string> = {
  sem_consumo: "bg-attention-soft text-attention",
  risco_vencimento: "bg-attention-soft text-attention",
  saldo_encalhado: "bg-analysis-soft text-analysis",
  sobreatendida: "bg-analysis-soft text-analysis",
  subatendida: "bg-primary-soft text-primary-text",
  equilibrada: "bg-opportunity-soft text-opportunity",
  nova: "bg-primary-soft text-primary-text",
};

function Busca({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm text-foreground placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none" />
    </label>
  );
}

type Col = "maxComp" | "apelido" | "acao" | "pctAtual" | "pctProposto" | "delta" | "saldoKwh" | "compensavelKwh" | "queimaSaldoMensal" | "mesesSaldoHoje" | "mesesSaldoFimProposto";

/** Máximo compensável da UC: crédito novo ÷ consumo compensável. */
function maxComp(l: LinhaRateio, qual: "atual" | "proposto"): number | null {
  if (l.compensavelKwh <= 0) return null;
  return (qual === "atual" ? l.creditoAtualKwh : l.creditoPropostoKwh) / l.compensavelKwh;
}
const fracao = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function TabelaRateio({ linhas, casas, onSelecionar }: { linhas: LinhaRateio[]; casas: number; onSelecionar: (l: LinhaRateio) => void }) {
  const [filtro, setFiltro] = useState<Acao | "todas">("todas");
  const [classe, setClasse] = useState<ClasseUc | "">("");
  const [q, setQ] = useState("");
  const [ord, setOrd] = useState<{ col: Col; desc: boolean }>({ col: "compensavelKwh", desc: true });
  const classes = useMemo(() => {
    const m = new Map<ClasseUc, { rotulo: string; n: number }>();
    for (const l of linhas) m.set(l.diagnostico.classe, { rotulo: l.diagnostico.rotulo, n: (m.get(l.diagnostico.classe)?.n ?? 0) + 1 });
    return [...m.entries()];
  }, [linhas]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todas: linhas.length };
    for (const l of linhas) c[l.acao] = (c[l.acao] ?? 0) + 1;
    return c;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const nq = norm(q);
    const val = (l: LinhaRateio): number | string => (ord.col === "maxComp" ? (maxComp(l, "proposto") ?? -1) : ord.col === "delta" ? l.pctProposto - l.pctAtual : ord.col === "apelido" ? l.apelido || l.instalacao : ord.col === "acao" ? l.acao : (l[ord.col] ?? -1));
    return linhas
      .filter((l) => (filtro === "todas" || l.acao === filtro) && (!classe || l.diagnostico.classe === classe) && (!nq || norm(`${l.apelido} ${l.instalacao} ${l.idUnidade}`).includes(nq)))
      .sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        const r = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
        return ord.desc ? -r : r;
      });
  }, [linhas, filtro, classe, q, ord]);

  const th = (col: Col, label: string, right = true) => (
    <th scope="col" className={cn("px-3 py-2.5 font-medium whitespace-nowrap", right && "text-right")} aria-sort={ord.col === col ? (ord.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setOrd((o) => ({ col, desc: o.col === col ? !o.desc : true }))} className={cn("inline-flex items-center gap-1 hover:text-foreground", ord.col === col && "text-foreground")}>
        {label}
        {ord.col === col && (ord.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por ação">
          {(["todas", "aumentar", "reduzir", "manter", "retirar", "incluir"] as const).map((f) =>
            f === "todas" || contagem[f] ? (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                aria-pressed={filtro === f}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filtro === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted hover:text-foreground")}
              >
                {f === "todas" ? "Todas" : ACAO_INFO[f].label} <span className="opacity-70">{contagem[f] ?? 0}</span>
              </button>
            ) : null,
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <select value={classe} onChange={(e) => setClasse(e.target.value as ClasseUc | "")} aria-label="Filtrar por situação" className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none">
            <option value="">Todas as situações</option>
            {classes.map(([k, v]) => (
              <option key={k} value={k}>
                {v.rotulo} ({v.n})
              </option>
            ))}
          </select>
          <Busca value={q} onChange={setQ} placeholder="Buscar UC ou apelido" />
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2 text-left text-xs text-muted">
            <tr>
              {th("apelido", "UC", false)}
              {th("acao", "Ação", false)}
              <th scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
                Situação hoje
              </th>
              {th("pctAtual", "% atual")}
              {th("pctProposto", "% proposto")}
              {th("delta", "Variação")}
              {th("saldoKwh", "Saldo kWh")}
              {th("compensavelKwh", "Compensável/mês")}
              {th("maxComp", "Máx. compensável")}
              {th("queimaSaldoMensal", "Uso do saldo/mês")}
              {th("mesesSaldoHoje", "Saldo hoje (meses)")}
              {th("mesesSaldoFimProposto", "Saldo no fim (meses)")}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const id = `${l.origem}-${l.key}-${l.instalacao}`;
              const delta = l.pctProposto - l.pctAtual;
              return (
                  <tr key={id} className="cursor-pointer border-t border-border/60 hover:bg-subtle/60" onClick={() => onSelecionar(l)}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={(e) => (e.stopPropagation(), onSelecionar(l))} className="text-left font-medium text-foreground hover:text-primary-text hover:underline">
                        {l.apelido || "—"}
                      </button>
                      <p className="font-mono text-[11px] text-muted">{l.instalacao}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ACAO_INFO[l.acao].cls)}>{ACAO_INFO[l.acao].label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", CLASSE_INFO[l.diagnostico.classe])}>{l.diagnostico.rotulo}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{pct(l.pctAtual, casas)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{pct(l.pctProposto, casas)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", delta > 0 ? "text-opportunity" : delta < 0 ? "text-analysis" : "text-muted")}>
                      {delta > 0 ? "+" : ""}
                      {num(delta, casas)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{kwh(l.saldoKwh)}</td>
                    <td className="px-3 py-2 text-right font-mono">{kwh(l.compensavelKwh)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap" title="Crédito novo ÷ consumo compensável da UC (o resto sai do saldo dela)">
                      <span className="text-muted">{fracao(maxComp(l, "atual"))} →</span> {fracao(maxComp(l, "proposto"))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{l.queimaSaldoMensal > 0 ? kwh(l.queimaSaldoMensal) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{num(l.mesesSaldoHoje)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className="text-muted">{num(l.mesesSaldoFimAtual)} →</span> {num(l.mesesSaldoFimProposto)}
                    </td>
                  </tr>
              );
            })}
            {!visiveis.length && (
              <tr>
                <td colSpan={12} className="px-3 py-10 text-center text-muted">
                  Nenhuma UC neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted">Toque numa UC para abrir a ficha completa. &quot;Saldo no fim&quot; compara o rateio atual → o proposto ao fim da projeção.</p>
    </div>
  );
}

export function TabelaCandidatas({ candidatas }: { candidatas: CandidataAvaliada[] }) {
  const [filtro, setFiltro] = useState<"todas" | "incluida" | "reserva" | "inelegivel">("todas");
  const [q, setQ] = useState("");
  const tipo = (c: CandidataAvaliada) => (c.selecionada ? "incluida" : c.elegivel ? "reserva" : "inelegivel");
  const cont = { todas: candidatas.length, incluida: 0, reserva: 0, inelegivel: 0 };
  for (const c of candidatas) cont[tipo(c)]++;
  const labels = { todas: "Todas", incluida: "Incluídas", reserva: "Reserva", inelegivel: "Não elegíveis" };
  const nq = norm(q);
  const visiveis = candidatas
    .filter((c) => (filtro === "todas" || tipo(c) === filtro) && (!nq || norm(`${c.candidata.apelido} ${c.candidata.instalacao}`).includes(nq)))
    .sort((a, b) => b.candidata.compensavelKwh - a.candidata.compensavelKwh);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar candidatas">
          {(Object.keys(labels) as (keyof typeof labels)[]).map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filtro === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted hover:text-foreground")}>
              {labels[f]} <span className="opacity-70">{cont[f]}</span>
            </button>
          ))}
        </div>
        <Busca value={q} onChange={setQ} placeholder="Buscar UC" />
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">UC</th>
              <th className="px-3 py-2.5 font-medium">Ligação</th>
              <th className="px-3 py-2.5 text-right font-medium">Média kWh</th>
              <th className="px-3 py-2.5 text-right font-medium">Mínimo</th>
              <th className="px-3 py-2.5 text-right font-medium">Compensável</th>
              <th className="px-3 py-2.5 font-medium">Resultado</th>
              <th className="px-3 py-2.5 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c, i) => {
              const t = tipo(c);
              return (
                <tr key={`${c.candidata.key}-${i}`} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.candidata.apelido || "—"}</p>
                    <p className="font-mono text-[11px] text-muted">{c.candidata.instalacao}</p>
                  </td>
                  <td className="px-3 py-2 text-muted">{c.candidata.ligacaoOriginal || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{kwh(c.candidata.mediaKwh)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{kwh(c.candidata.consumoMinimoKwh)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{kwh(c.candidata.compensavelKwh)}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", t === "incluida" ? "bg-primary-soft text-primary-text" : t === "reserva" ? "bg-subtle text-muted" : "bg-attention-soft text-attention")}>
                      {t === "incluida" ? `Incluída${c.usinaDestino ? ` · ${c.usinaDestino}` : ""}` : t === "reserva" ? "Reserva" : "Não elegível"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[13px] text-muted">{c.motivo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
