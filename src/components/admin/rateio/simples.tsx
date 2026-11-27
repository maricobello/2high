"use client";

/**
 * Tela simples da usina: um gráfico (contrato × geração × carga), três números e dois botões.
 * O detalhe completo continua em "Ver detalhes".
 */
import { Check, Download, Loader2, SlidersHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { vagaNovasUcs } from "@/modules/rateio/agregar";
import { injecaoMensal } from "@/modules/rateio/engine";
import { aplicacaoDaFatura } from "@/modules/rateio/fatura";
import { useState } from "react";
import { EntradaNumero } from "./numero";
import { limiteFisico } from "@/modules/rateio/otimo-cobertura";
import type { Candidata, Parametros, ResultadoUsina, Usina } from "@/modules/rateio/types";
import { SaldoChart } from "./chart";
import { kwh } from "./format";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pctFino = (v: number) => `${(Math.floor(v * 1000) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function VisaoSimples({
  usina,
  r,
  params,
  candidatas,
  calculando,
  ocupado,
  onArquivos,
  onBaixar,
  onDetalhes,
  onChange,
}: {
  usina: Usina;
  r?: ResultadoUsina;
  params: Parametros;
  candidatas: Candidata[];
  calculando: boolean;
  ocupado: boolean;
  onArquivos: () => void;
  onBaixar: () => void;
  onDetalhes: () => void;
  onChange: (p: Partial<Usina>) => void;
}) {
  const [meses, setMeses] = useState<number | null>(null);
  const E = injecaoMensal(usina);
  const vaga = vagaNovasUcs(usina, params, candidatas);
  const contrato = vaga?.contrato;
  const temUcs = usina.ucs.length > 0;
  const pronto = temUcs && E > 0 && !!r;

  const passos = [
    { ok: temUcs, texto: temUcs ? `${usina.ucs.length} UCs` : "Lista de UCs (Orange › Unidade Rateio GD)" },
    { ok: E > 0, texto: E > 0 ? `Geração: ${kwh(E)} kWh/mês` : "Fatura da usina (PDF)" },
    { ok: !!contrato?.temContrato, texto: contrato?.temContrato ? `Contrato: ${kwh(contrato.contratadaMes)} kWh/mês` : "Recorte do Orange (bloco Energia)" },
    { ok: !!contrato && !contrato.consumoEstimado, texto: contrato && !contrato.consumoEstimado ? "Consumo do Relatório Gerencial" : "Relatório Gerencial (opcional)" },
  ];

  // fontes lidas com nota baixa: confirmação de um toque, sem abrir os detalhes
  const fat = usina.fatura ? aplicacaoDaFatura(usina.fatura) : null;
  const faturaPendente = !!fat?.injecaoMensal && usina.fonteInjecao !== "fatura" && !(E > 0);
  const painel = usina.painel;
  const painelPendente = !!painel && usina.fontePeriodo !== "painel" && !contrato?.temContrato && (painel.valores.estimada ?? 0) > 0;
  const mesesPainel = meses ?? painel?.meses ?? null;

  const lim = r ? limiteFisico(r, "proposto", params.mesesSimulacao) : 0;
  const teto = r && lim > 0 ? r.proposto.compensadoTotal / lim : null;
  const performance = contrato?.temContrato ? E / contrato.contratadaMes : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{usina.nome}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {calculando ? (
              <>
                <Loader2 className="size-4 animate-spin text-primary-text" /> Calculando o melhor rateio…
              </>
            ) : pronto ? (
              <>
                <span className="size-2 rounded-full bg-opportunity" /> Rateio pronto · soma 100%
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-analysis" /> Faltam arquivos
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pronto && (
            <Button onClick={onBaixar} disabled={ocupado || calculando}>
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Baixar planilha
            </Button>
          )}
        </div>
      </div>

          {(faturaPendente || painelPendente) && (
            <div className="space-y-2">
              {faturaPendente && fat?.injecaoMensal && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    Fatura lida: <strong className="font-mono">{kwh(fat.injecaoMensal)} kWh/mês</strong> de energia para o rateio. Confere com o PDF?
                  </span>
                  <Button size="sm" onClick={() => onChange({ injecaoMensalProjetada: Math.round(fat.injecaoMensal!), perfilSazonal: fat.perfilSazonal.length === 12 ? fat.perfilSazonal : usina.perfilSazonal, fonteInjecao: "fatura" })}>
                    Usar
                  </Button>
                </div>
              )}
              {painelPendente && painel && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    Recorte lido: contrato de <strong className="font-mono">{kwh(painel.valores.estimada ?? 0)} kWh</strong> no período. Quantos meses?
                  </span>
                  <EntradaNumero value={mesesPainel} onValor={setMeses} aria-label="Meses do período" className="h-9 w-16 rounded-lg border border-border bg-card px-2 text-center font-mono text-sm" />
                  <Button
                    size="sm"
                    disabled={!mesesPainel}
                    onClick={() =>
                      mesesPainel &&
                      onChange({
                        meses: Math.round(mesesPainel),
                        painel: { ...painel, meses: Math.round(mesesPainel) },
                        energiaContratadaPeriodo: painel.valores.estimada ?? usina.energiaContratadaPeriodo,
                        energiaGeradaPeriodo: painel.valores.geracaoRealizada ?? usina.energiaGeradaPeriodo,
                        energiaInjetadaPeriodo: painel.valores.injetada ?? usina.energiaInjetadaPeriodo,
                        fontePeriodo: "painel",
                      })
                    }
                  >
                    Usar
                  </Button>
                </div>
              )}
            </div>
          )}
      {pronto && !contrato?.temContrato && !painelPendente && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">Sem o contrato da usina. Envie o recorte do Orange (bloco Energia) para ver a meta de 90% e se cabem novas UCs.</p>
      )}

      {!pronto ? (
        <Card className="p-6 sm:p-8">
          <p className="text-lg font-semibold">Arraste os arquivos da usina para esta tela</p>
          <p className="mt-1 text-sm text-muted">Pode enviar todos juntos. A ferramenta reconhece cada um sozinha.</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {passos.map((p) => (
              <li key={p.texto} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-sm", p.ok ? "border-opportunity/40 text-foreground" : "border-border text-muted")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", p.ok ? "bg-opportunity text-background" : "border border-border")}>{p.ok && <Check className="size-4" />}</span>
                {p.texto}
              </li>
            ))}
          </ul>
          <Button className="mt-6" onClick={onArquivos} disabled={ocupado}>
            <Upload className="size-4" /> Escolher arquivos
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-5 sm:p-7">
            <p className="text-sm font-semibold">Contrato, geração e carga</p>
            <p className="mt-0.5 text-xs text-muted">kWh por mês</p>
            <GraficoContrato contratada={contrato?.temContrato ? contrato.contratadaMes : null} meta={contrato?.meta ?? 0.9} geracao={E} carga={contrato?.consumidaKwh ?? 0} cargaEstimada={!!contrato?.consumoEstimado} agregar={vaga?.kwh ?? 0} />
          </Card>

          <Card className="p-5 sm:p-7">
            <p className="text-sm font-semibold">Saldo de créditos nos próximos {params.mesesSimulacao} meses</p>
            <p className="mt-0.5 mb-3 text-xs text-muted">Quanto menos saldo parado, mais energia virou desconto</p>
            <SaldoChart
              atual={[r.atual.saldoInicial, ...r.atual.meses.map((m) => m.saldoTotal)]}
              proposto={[r.proposto.saldoInicial, ...r.proposto.meses.map((m) => m.saldoTotal)]}
              estresse={[r.propostoEstresse.saldoInicial, ...r.propostoEstresse.meses.map((m) => m.saldoTotal)]}
              mesesDoAno={r.proposto.meses.map((m) => m.mes)}
              fatorEstresse={params.fatorConsumoEstresse}
            />
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Numero titulo="Compensa" valor={teto != null ? pctFino(teto) : "—"} texto="da energia que é possível compensar" bom={teto != null && teto >= 0.98} />
            <Numero
              titulo="Geração da usina"
              valor={performance != null ? pct(performance) : `${kwh(E)}`}
              texto={performance != null ? "do contrato" : "kWh/mês (sem contrato informado)"}
              bom={performance != null ? performance >= 0.9 : null}
            />
            <Numero
              titulo="Novas UCs"
              valor={vaga && vaga.kwh > 0 ? `+${kwh(vaga.kwh)}` : "Não agregar"}
              texto={vaga && vaga.kwh > 0 ? `kWh/mês${vaga.ucsQueCabem ? ` · ≈ ${vaga.ucsQueCabem} UCs` : ""}` : vaga?.limitadoPor === "contrato" ? "a carga já chegou à meta do contrato" : "a geração não comporta mais carga"}
              bom={vaga ? vaga.kwh > 0 : null}
            />
          </div>
          {vaga && <p className="text-sm text-muted">{vaga.texto}</p>}
        </>
      )}

      <button type="button" onClick={onDetalhes} className="flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline">
        <SlidersHorizontal className="size-4" /> Ver detalhes do cálculo
      </button>
    </div>
  );
}

function Numero({ titulo, valor, texto, bom }: { titulo: string; valor: string; texto: string; bom: boolean | null }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{titulo}</p>
      <p className={cn("mt-2 font-mono text-3xl font-semibold tracking-tight", bom === true ? "text-opportunity" : bom === false ? "text-analysis" : "text-foreground")}>{valor}</p>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </Card>
  );
}

/** Barras horizontais na mesma escala, com a linha da meta do contrato. */
function GraficoContrato({ contratada, meta, geracao, carga, cargaEstimada, agregar }: { contratada: number | null; meta: number; geracao: number; carga: number; cargaEstimada: boolean; agregar: number }) {
  const max = Math.max(contratada ?? 0, geracao, carga + agregar, 1) * 1.08;
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const linhas = [
    ...(contratada != null ? [{ nome: "Contrato", valor: contratada, cor: "bg-muted/40" }] : []),
    { nome: "Geração", valor: geracao, cor: "bg-primary-text" },
    { nome: cargaEstimada ? "Carga das UCs (estimada)" : "Carga das UCs", valor: carga, cor: "bg-primary" },
  ];
  const metaKwh = contratada != null ? meta * contratada : null;
  return (
    <div className="relative mt-5">
      <div className="space-y-4">
        {linhas.map((l) => (
          <div key={l.nome}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-foreground/85">{l.nome}</span>
              <span className="font-mono text-muted">{kwh(l.valor)}</span>
            </div>
            <div className="relative h-7 rounded-lg bg-subtle/60">
              <div className={cn("absolute inset-y-0 left-0 rounded-lg transition-[width] duration-500 motion-reduce:transition-none", l.cor)} style={{ width: w(l.valor) }} />
              {l.nome.startsWith("Carga") && agregar > 0 && (
                <div
                  className="absolute inset-y-0 rounded-r-lg border border-dashed border-opportunity bg-opportunity/20"
                  style={{ left: w(l.valor), width: w(agregar) }}
                  title={`Pode agregar ${kwh(agregar)} kWh/mês`}
                />
              )}
              {metaKwh != null && <div className="absolute -inset-y-1 w-0.5 bg-volt" style={{ left: w(metaKwh) }} aria-hidden />}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {metaKwh != null && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-volt" /> Meta: {pct(meta)} do contrato ({kwh(metaKwh)})
          </span>
        )}
        {agregar > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-dashed border-opportunity bg-opportunity/20" /> Espaço para novas UCs
          </span>
        )}
      </div>
    </div>
  );
}
