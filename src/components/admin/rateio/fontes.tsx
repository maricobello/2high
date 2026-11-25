"use client";

import { ChevronDown, CircleCheck, FileText, ImageIcon, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { autoAplicar, NOTA_AUTOMATICA } from "@/modules/rateio/automacao";
import { aplicacaoDaFatura, lerFaturaTexto, scoreFatura, type FaturaUsina, type ScoreLeitura } from "@/modules/rateio/fatura";
import { anonimizarFatura, mesclarIa, validarIa, type FaturaIa, type LeituraIaValidada } from "@/modules/rateio/fatura-ia";
import { aprenderLayout, type LayoutFatura } from "@/modules/rateio/layout";
import { CAMPOS_PAINEL, checarPainel, lerPainelTexto, scorePainel, type CampoPainel, type ValoresPainel } from "@/modules/rateio/painel";
import type { Usina } from "@/modules/rateio/types";
import { kwh, MESES_CURTOS } from "./format";
import { EntradaNumero } from "./numero";

let layoutsCache: LayoutFatura[] | null = null;
async function carregarLayouts(): Promise<LayoutFatura[]> {
  if (layoutsCache) return layoutsCache;
  try {
    const r = await fetch("/api/admin/rateio/layouts");
    const j = (await r.json()) as { layouts?: LayoutFatura[] };
    layoutsCache = r.ok && Array.isArray(j.layouts) ? j.layouts : [];
  } catch {
    layoutsCache = [];
  }
  return layoutsCache;
}

/**
 * Lê a fatura pelas linhas de texto: regras → layout aprendido → IA (só quando a nota não
 * chega a 70 ou quando pedido) → aprende o layout da distribuidora para a próxima vez.
 */
export async function lerFaturaLinhas(linhas: string[], arquivo: string, opcoes: { forcarIa?: boolean } = {}): Promise<FaturaUsina> {
  const layouts = await carregarLayouts();
  let f = lerFaturaTexto(linhas, arquivo, layouts);
  const precisaIa = opcoes.forcarIa || scoreFatura(f).score < NOTA_AUTOMATICA || !Object.keys(f.injetada).length;
  let validada: LeituraIaValidada | null = null;
  if (precisaIa) {
    try {
      const res = await fetch("/api/admin/rateio/fatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linhas: anonimizarFatura(linhas) }) });
      const j = (await res.json()) as { leitura?: FaturaIa; error?: string };
      if (!res.ok || !j.leitura) throw new Error(j.error ?? "falha");
      validada = validarIa(j.leitura, linhas);
      f = mesclarIa(f, validada);
    } catch (e) {
      f.avisos.push(`Leitura pela IA indisponível (${e instanceof Error ? e.message : "falha"}): ficou só a leitura por regras.`);
    }
  }
  // aprende com a leitura conferida e registra o uso, por distribuidora
  const dist = f.distribuidora || validada?.distribuidora?.toUpperCase();
  if (dist) {
    const atual = layouts.find((l) => l.distribuidora === dist) ?? null;
    const novo = aprenderLayout(atual, dist, linhas, validada?.componentes ?? {}, !!validada);
    layoutsCache = [...layouts.filter((l) => l.distribuidora !== dist), novo];
    f.layoutResumo = { distribuidora: dist, leituras: novo.leituras, leiturasIa: novo.leiturasIa, campos: Object.keys(novo.campos).length };
    fetch("/api/admin/rateio/layouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: novo }) }).catch(() => {});
  }
  return f;
}

/** Lê a fatura da usina (PDF com texto) no navegador. */
export async function lerFaturaArquivo(file: File): Promise<FaturaUsina> {
  const { lerPdf } = await import("@/modules/rateio/pdf");
  const t = await lerPdf(await file.arrayBuffer());
  if (t.semTexto) {
    const f = lerFaturaTexto(t.linhas, file.name);
    f.avisos.unshift("O PDF não tem texto (parece digitalizado). Baixe a 2ª via em PDF da agência virtual.");
    return f;
  }
  return lerFaturaLinhas(t.linhas, file.name);
}

/** Reduz a imagem (máx. 1600 px) e devolve data URL JPEG, para enviar à leitura. */
async function imagemParaDataUrl(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/** Lê o recorte da tela do Orange (imagem) pela rota do admin. */
export async function lerPainelImagemArquivo(file: Blob): Promise<ValoresPainel> {
  const imagem = await imagemParaDataUrl(file);
  const res = await fetch("/api/admin/rateio/painel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem }) });
  const j = (await res.json()) as { valores?: ValoresPainel; error?: string };
  if (!res.ok || !j.valores) throw new Error(j.error ?? "Não foi possível ler a imagem.");
  return j.valores;
}

const mesLabel = (iso: string) => `${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

const NOMES_CAMPOS: Record<string, string> = {
  injetada: "injetada",
  consumoUsina: "consumo da usina",
  excedente: "excedente",
  saldo: "saldo",
  contratadaKw: "demanda contratada",
  registradaKw: "demanda registrada",
  ultrapassagemKw: "ultrapassagem",
  despesaUltrapassagem: "despesa com ultrapassagem",
};

/** Como a fatura foi lida: regras, layout aprendido da distribuidora ou IA (e quanto a IA ainda é usada). */
function ComoFoiLida({ f, lendo, onRelerIa }: { f: FaturaUsina; lendo: boolean; onRelerIa?: () => void }) {
  const nomes = (l?: string[]) => (l ?? []).map((c) => NOMES_CAMPOS[c] ?? c).join(", ");
  const r = f.layoutResumo;
  const partes: string[] = [];
  if (f.leituraIa) partes.push(f.camposIa?.length ? `IA completou: ${nomes(f.camposIa)}` : f.conferenciaIa === "ok" ? "IA conferiu a leitura (concorda)" : f.conferenciaIa === "divergente" ? "IA leu diferente: confira" : "IA consultada");
  if (f.camposAprendidos?.length) partes.push(`layout aprendido: ${nomes(f.camposAprendidos)}`);
  if (!partes.length) partes.push("lida pelas regras, sem IA");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-subtle/50 px-3 py-2 text-xs">
      <span className="min-w-0 text-muted">
        <Sparkles className="mr-1 inline size-3.5 text-primary-text" />
        {partes.join(" · ")}
        {r && r.leituras > 0 && ` · ${r.distribuidora}: IA em ${r.leiturasIa} de ${r.leituras} leitura${r.leituras > 1 ? "s" : ""}${r.campos ? `, ${r.campos} campo${r.campos > 1 ? "s" : ""} aprendido${r.campos > 1 ? "s" : ""}` : ""}`}
      </span>
      {onRelerIa && (
        <button type="button" onClick={onRelerIa} disabled={lendo} className="font-semibold text-primary-text hover:underline disabled:opacity-50">
          {lendo ? "Lendo…" : "Reler com IA"}
        </button>
      )}
    </div>
  );
}

function Nota({ s, aplicado, rotulo }: { s: ScoreLeitura; aplicado: boolean; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const cor = s.nivel === "alta" ? "text-opportunity border-opportunity/40 bg-opportunity-soft" : s.nivel === "media" ? "text-analysis border-analysis/40 bg-analysis-soft" : "text-attention border-attention/40 bg-attention-soft";
  return (
    <div className="rounded-xl border border-border">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold", cor)}>{s.score}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Confiança da leitura {s.nivel === "alta" ? "alta" : s.nivel === "media" ? "média" : "baixa"}
          </span>
          <span className="block text-xs text-muted">
            {aplicado ? `${rotulo} aplicada ao estudo automaticamente` : s.score >= NOTA_AUTOMATICA ? "Pronta para aplicar" : `Abaixo de ${NOTA_AUTOMATICA}: confira e aplique manualmente`}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <ul className="space-y-1 border-t border-border px-3 py-2">
          {s.itens.map((i) => (
            <li key={i.texto} className="flex gap-2 text-xs">
              {i.ok ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-opportunity" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-analysis" />}
              <span className="flex-1">{i.texto}</span>
              <span className="font-mono text-muted">
                {i.pontos}/{i.max}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FontesUsina({ usina, onChange, onTransformar }: { usina: Usina; onChange: (p: Partial<Usina>) => void; onTransformar: (fn: (u: Usina) => Usina) => void }) {
  const [lendo, setLendo] = useState<"fatura" | "painel" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const f = usina.fatura ?? null;
  const p = usina.painel ?? null;

  async function carregarFatura(file: File) {
    setLendo("fatura");
    setErro(null);
    try {
      const fat = await lerFaturaArquivo(file);
      // nova leitura: volta a aplicar automaticamente
      onTransformar((u) => autoAplicar({ ...u, fatura: fat, fonteInjecao: u.fonteInjecao === "manual" ? null : u.fonteInjecao }));
    } catch (e) {
      setErro(`Fatura: ${e instanceof Error ? e.message : "falha na leitura"}`);
    } finally {
      setLendo(null);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }

  async function relerComIa(fat: FaturaUsina) {
    if (!fat.linhas?.length) return;
    setLendo("fatura");
    setErro(null);
    try {
      const nova = await lerFaturaLinhas(fat.linhas, fat.arquivo, { forcarIa: true });
      onTransformar((u) => autoAplicar({ ...u, fatura: nova, fonteInjecao: u.fonteInjecao === "manual" ? null : u.fonteInjecao }));
    } catch (e) {
      setErro(`Fatura: ${e instanceof Error ? e.message : "falha na leitura"}`);
    } finally {
      setLendo(null);
    }
  }

  async function carregarImagem(file: Blob) {
    setLendo("painel");
    setErro(null);
    try {
      const valores = await lerPainelImagemArquivo(file);
      onTransformar((u) => autoAplicar({ ...u, painel: { valores, meses: null, fonte: "imagem", lidoEm: new Date().toISOString() }, fontePeriodo: u.fontePeriodo === "manual" ? null : u.fontePeriodo }));
    } catch (e) {
      setErro(`Tela do Orange: ${e instanceof Error ? e.message : "falha na leitura"}. Você pode colar o texto da tela.`);
    } finally {
      setLendo(null);
      if (imgRef.current) imgRef.current.value = "";
    }
  }

  function lerTexto() {
    const valores = lerPainelTexto(texto);
    if (!Object.keys(valores).length) return setErro("Não reconheci os rótulos (Estimada, Injetada, Compensada, Saldo…). Copie o bloco Energia inteiro.");
    setErro(null);
    onTransformar((u) => autoAplicar({ ...u, painel: { valores, meses: null, fonte: "texto", lidoEm: new Date().toISOString() }, fontePeriodo: u.fontePeriodo === "manual" ? null : u.fontePeriodo }));
    setTexto("");
  }

  const aplic = f ? aplicacaoDaFatura(f) : null;
  const sFatura = f ? scoreFatura(f, p?.valores.injetada && p.meses ? { kwh: p.valores.injetada, meses: p.meses } : null) : null;
  const sPainel = p ? scorePainel(p, f?.injetada) : null;
  const mesesFatura = f ? [...new Set([...Object.keys(f.injetada), ...Object.keys(f.excedente)])].sort().slice(-12) : [];
  const faturaAplicada = usina.fonteInjecao === "fatura";
  const painelAplicado = usina.fontePeriodo === "painel";

  const injecaoFaturaPeriodo =
    f && p?.meses
      ? Object.entries(f.injetada)
          .filter(([, v]) => v > 0)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-p.meses)
          .reduce((a, [, v]) => a + v, 0) || null
      : null;
  const checagens = p
    ? checarPainel(p.valores, { saldoUcs: usina.ucs.reduce((a, u) => a + Math.max(0, u.saldoKwh), 0), compensadoUcsMes: 0, meses: p.meses, injecaoFaturaPeriodo }).filter(
        (c) => !/^Saldo fecha|^Injetada na tela|^Compensada não/.test(c.titulo), // já estão na nota
      )
    : [];

  function aplicarFatura() {
    if (!aplic?.injecaoMensal) return;
    onChange({ injecaoMensalProjetada: Math.round(aplic.injecaoMensal), perfilSazonal: aplic.perfilSazonal.length === 12 ? aplic.perfilSazonal : usina.perfilSazonal, fonteInjecao: "fatura" });
  }
  function aplicarPainel() {
    if (!p) return;
    if (!p.meses) return setErro("Informe quantos meses tem o período selecionado na tela do Orange.");
    onChange({ meses: p.meses, energiaContratadaPeriodo: p.valores.estimada ?? usina.energiaContratadaPeriodo, energiaGeradaPeriodo: p.valores.geracaoRealizada ?? usina.energiaGeradaPeriodo, energiaInjetadaPeriodo: p.valores.injetada ?? usina.energiaInjetadaPeriodo, fontePeriodo: "painel" });
  }

  return (
    <Card
      onPaste={(e) => {
        const img = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
        if (img) {
          e.preventDefault();
          carregarImagem(img);
        }
      }}
    >
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => e.target.files?.[0] && carregarFatura(e.target.files[0])} />
      <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && carregarImagem(e.target.files[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold">Fatura e tela do Orange</h3>
          <p className="text-xs text-muted">Envie a fatura da usina e o recorte do Orange: a leitura recebe uma nota e, se for {NOTA_AUTOMATICA} ou mais, entra no estudo sozinha.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={f ? "secondary" : "primary"} onClick={() => pdfRef.current?.click()} disabled={!!lendo}>
            {lendo === "fatura" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} {f ? "Trocar fatura" : "Fatura (PDF)"}
          </Button>
          <Button size="sm" variant={p ? "secondary" : "primary"} onClick={() => imgRef.current?.click()} disabled={!!lendo}>
            {lendo === "painel" ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />} {p ? "Trocar recorte" : "Recorte do Orange"}
          </Button>
        </div>
      </div>
      {erro && <p className="border-b border-border bg-attention-soft/40 px-4 py-2 text-sm text-attention">{erro}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-0 xl:grid-cols-2">
        {/* Fatura */}
        <div className="border-b border-border p-4 xl:border-r xl:border-b-0">
          <p className="mb-2 text-sm font-semibold">Fatura da usina</p>
          {!f ? (
            <p className="text-sm text-muted">PDF da fatura da UC geradora (2ª via com texto, qualquer distribuidora). Lemos injeção, excedente distribuído, consumo da usina, saldo e demanda. Quando as regras não bastam, a IA lê (só vale número que está na fatura) e o sistema aprende o layout da distribuidora: na próxima, lê sem IA.</p>
          ) : (
            <div className="space-y-3">
              {sFatura && <Nota s={sFatura} aplicado={faturaAplicada} rotulo="Injeção" />}
              <p className="text-xs text-muted">
                {f.arquivo} · {f.distribuidora || "distribuidora não identificada"} · referência {f.mesReferencia ? mesLabel(f.mesReferencia) : "—"}
                {f.saldoKwh != null && ` · saldo da geradora ${kwh(f.saldoKwh)} kWh`}
              </p>
              <ComoFoiLida f={f} lendo={lendo === "fatura"} onRelerIa={f.linhas?.length ? () => relerComIa(f) : undefined} />
              {aplic?.descricao.map((d) => (
                <p key={d} className="text-xs text-foreground/85">
                  {d}
                </p>
              ))}
              {f.avisos.map((a) => (
                <p key={a} className="flex gap-1.5 text-xs text-analysis">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {a}
                </p>
              ))}
              {mesesFatura.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-primary-text">{mesesFatura.length === 1 ? "Ver o mês lido" : `Ver os ${mesesFatura.length} meses lidos`}</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px]">
                      <thead className="text-left text-muted">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Mês</th>
                          <th className="py-1 pr-2 text-right font-medium">Injetada</th>
                          <th className="py-1 pr-2 text-right font-medium">Excedente distribuído</th>
                          <th className="py-1 text-right font-medium">Consumo da usina</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...mesesFatura].reverse().map((m) => (
                          <tr key={m} className={cn("border-t border-border/50", !aplic?.mesesUsados.includes(m) && "text-muted/70")}>
                            <td className="py-1 pr-2">{mesLabel(m)}</td>
                            <td className="py-1 pr-2 text-right font-mono">{f.injetada[m] != null ? kwh(f.injetada[m]) : "—"}</td>
                            <td className="py-1 pr-2 text-right font-mono">{f.excedente[m] != null ? kwh(f.excedente[m]) : "—"}</td>
                            <td className="py-1 text-right font-mono">{f.consumo[m] != null ? kwh(f.consumo[m]) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] text-muted">Meses em cinza ficam fora da média (zerados ou entrada em operação).</p>
                  </div>
                </details>
              )}
              {aplic?.injecaoMensal != null &&
                (faturaAplicada ? (
                  <Button size="sm" variant="ghost" onClick={() => onChange({ injecaoMensalProjetada: null, fonteInjecao: "manual" })}>
                    Não usar a fatura
                  </Button>
                ) : (
                  <Button size="sm" onClick={aplicarFatura}>
                    Usar no estudo
                  </Button>
                ))}
            </div>
          )}
        </div>

        {/* Painel do Orange */}
        <div className="p-4">
          <p className="mb-2 text-sm font-semibold">Tela de gestão de usinas (Orange)</p>
          {!p ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">Recorte do bloco &quot;Energia&quot; (imagem; dá para colar com Ctrl+V aqui) ou o texto copiado da tela.</p>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto da tela do Orange" placeholder={"Estimada 4.389.840\nInjetada 3.239.006\n…"} className="h-24 w-full rounded-lg border border-border bg-subtle/40 p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
              <Button size="sm" variant="secondary" disabled={!texto.trim()} onClick={lerTexto}>
                Ler texto
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sPainel && <Nota s={sPainel} aplicado={painelAplicado} rotulo="Período" />}
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-muted">Meses do período no Orange</span>
                <EntradaNumero
                  value={p.meses}
                  onValor={(v) => onTransformar((u) => autoAplicar({ ...u, painel: { ...p, meses: v ? Math.min(60, Math.max(1, Math.round(v))) : null, mesesInferidos: false } }))}
                  className="h-8 w-20 rounded-lg border border-border bg-card px-2 font-mono text-sm"
                />
                {p.mesesInferidos && <span className="text-xs text-opportunity">descoberto pela fatura</span>}
              </label>
              <details className="text-xs">
                <summary className="cursor-pointer text-primary-text">{p.fonte === "imagem" ? "Ver e corrigir os valores lidos da imagem" : "Ver os valores lidos"}</summary>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {(Object.keys(CAMPOS_PAINEL) as CampoPainel[]).map((k) => (
                    <label key={k} className="flex items-center justify-between gap-2 border-b border-border/50 py-1">
                      <span className="text-muted">{CAMPOS_PAINEL[k]}</span>
                      <EntradaNumero
                        value={p.valores[k]}
                        onValor={(v) => onTransformar((u) => autoAplicar({ ...u, painel: { ...p, valores: { ...p.valores, [k]: v ?? undefined } } }))}
                        className="w-32 rounded border border-transparent bg-transparent px-1 text-right font-mono text-foreground hover:border-border focus:border-primary focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              </details>
              {checagens.length > 0 && (
                <ul className="space-y-1">
                  {checagens.map((c) => (
                    <li key={c.titulo} className="flex gap-2 text-xs">
                      {c.ok ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-opportunity" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-analysis" />}
                      <span>
                        {c.titulo}. <span className="text-muted">{c.detalhe}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {painelAplicado ? (
                  <Button size="sm" variant="ghost" onClick={() => onChange({ fontePeriodo: "manual" })}>
                    Não aplicar automaticamente
                  </Button>
                ) : (
                  <Button size="sm" onClick={aplicarPainel}>
                    Usar no estudo
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onChange({ painel: null })}>
                  Remover
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
