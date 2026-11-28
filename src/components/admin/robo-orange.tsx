"use client";

import { Bot, CheckCircle2, CircleDashed, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mapa = { ok: boolean; erro?: string; inicio?: { links: unknown[] }; paginas?: { caminho: string; titulo: string; status: number; endpoints: string[]; formularios: unknown[] }[] };
type Totais = { ucs: number; consumoKwh: number; compensadoKwh: number; saldoKwh: number; custoCativoRs: number; faturaRecebidaRs: number; economiaRs: number; custoGdRs: number };
type Gerencial = { usinaId: number; usina: string; competencia: string; cliente: string; status: "ok" | "nao_processado" | "sem_dados"; totais: Totais };
type Indice = { competencia: string; em: string; arquivos: { usina: string; tipo: string }[]; erros: string[]; gerencial?: Gerencial[]; pendentes?: number; usinas?: number };
type Economia = { usinas: number; consumoKwh: number; compensadoKwh: number; economiaRs: number; custoCativoRs: number; custoGdRs: number };

const kwh = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kWh`;
const rs = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function mesAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS: Record<Gerencial["status"], string> = { ok: "lido", nao_processado: "ainda não processado no Orange", sem_dados: "sem dados" };

/** Robô do Orange: login, coleta automática (UCs do rateio + Relatório Gerencial) e economia do mês. */
export function RoboOrange() {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [teste, setTeste] = useState<string | null>(null);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [ocupado, setOcupado] = useState<"teste" | "mapa" | "coleta" | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [indice, setIndice] = useState<Indice | null>(null);
  const [economia, setEconomia] = useState<Economia | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [competencia, setCompetencia] = useState(mesAnterior());
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    fetch("/api/admin/orange/status")
      .then((r) => r.json())
      .then((j: { configurado?: boolean }) => setConfigurado(Boolean(j.configurado)))
      .catch(() => setConfigurado(false));
    fetch("/api/admin/orange/coleta")
      .then((r) => r.json())
      .then((j: { config?: { filtroUsinas?: string[] } | null; ultima?: Indice | null; economia?: Economia }) => {
        setIndice(j.ultima ?? null);
        setEconomia(j.economia ?? null);
        if (j.config?.filtroUsinas?.length) setFiltro(j.config.filtroUsinas.join(", "));
        if (j.ultima?.competencia) setCompetencia(j.ultima.competencia);
      })
      .catch(() => {});
  }, []);

  async function coletarAgora(refazerUcs = false) {
    setOcupado("coleta");
    setAviso("Coletando no Orange… pode levar até 1 minuto.");
    try {
      const filtroUsinas = filtro.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      await fetch("/api/admin/orange/coleta", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filtroUsinas }) });
      const j = (await (await fetch("/api/admin/orange/coleta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competencia, refazerUcs }) })).json()) as { ok?: boolean; erro?: string; indice?: Indice; economia?: Economia };
      if (j.ok && j.indice) {
        setIndice(j.indice);
        setEconomia(j.economia ?? null);
        const ucs = j.indice.arquivos.filter((a) => a.tipo === "ucs").length;
        setAviso(
          `${ucs} planilha(s) de UCs prontas para o rateio. ${j.indice.pendentes ? `Faltam ${j.indice.pendentes} usina(s) no Relatório Gerencial: clique em Continuar.` : "Relatório Gerencial completo."}`,
        );
      } else setAviso(`Não coletou: ${j.erro ?? "erro"}`);
    } catch {
      setAviso("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(null);
    }
  }

  async function testar() {
    setOcupado("teste");
    setTeste(null);
    try {
      const j = (await (await fetch("/api/admin/orange/status", { method: "POST" })).json()) as { ok?: boolean; erro?: string; ms?: number };
      setTeste(j.ok ? `Login no Orange funcionou (${((j.ms ?? 0) / 1000).toFixed(1)} s).` : `Não entrou: ${j.erro ?? "erro desconhecido"}`);
    } catch {
      setTeste("Não foi possível falar com o servidor.");
    } finally {
      setOcupado(null);
    }
  }

  async function mapear() {
    setOcupado("mapa");
    setMapa(null);
    try {
      setMapa((await (await fetch("/api/admin/orange/mapear", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json()) as Mapa);
    } catch {
      setMapa({ ok: false, erro: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(null);
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem área de transferência */
    }
  }

  const gerencial = [...(indice?.gerencial ?? [])].sort((a, b) => b.totais.economiaRs - a.totais.economiaRs);
  const ucsProntas = indice?.arquivos.filter((a) => a.tipo === "ucs").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 size-5 shrink-0 text-primary-text" />
        <div className="min-w-0">
          <h2 className="font-semibold">Robô do Orange (rateio GD)</h2>
          <p className="mt-1 text-sm text-muted">Entra no Orange com o usuário da Replace, baixa as UCs do rateio de cada usina e lê o Relatório Gerencial (consumo, compensado e economia), sem exportar à mão.</p>
        </div>
      </div>

      <div className="flex items-start gap-3 text-sm">
        {configurado ? <CheckCircle2 className="mt-0.5 size-4 text-opportunity" /> : <CircleDashed className="mt-0.5 size-4 text-muted" />}
        <div>
          <p className="font-medium">{configurado == null ? "Verificando credenciais…" : configurado ? "Credenciais do Orange configuradas" : "Credenciais do Orange não configuradas"}</p>
          {!configurado && configurado != null && (
            <p className="mt-1 text-xs text-muted">
              Na Vercel: projeto → Settings → Environment Variables → adicione <code>ORANGE_USUARIO</code> e <code>ORANGE_SENHA</code> (marque “Sensitive”) e faça um novo deploy.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={testar} disabled={!configurado || ocupado != null}>
          {ocupado === "teste" && <Loader2 className="size-4 animate-spin" />} Testar login
        </Button>
      </div>
      {teste && <p className="text-sm">{teste}</p>}

      <div className="rounded-xl border border-border p-4 text-sm">
        <p className="font-medium">Coleta automática (todo mês, do dia 6 ao 12, 06:37 de Brasília)</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Competência
            <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
          </label>
          <label className="w-full min-w-0 text-xs text-muted sm:w-auto sm:flex-1">
            Só estas usinas (opcional, separe por vírgula)
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="ex.: Ibititá, Alto do Pajeú, Ibotirama" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => coletarAgora(false)} disabled={!configurado || ocupado != null}>
            {ocupado === "coleta" && <Loader2 className="size-4 animate-spin" />} {indice?.pendentes && indice.competencia === competencia ? "Continuar" : "Coletar agora"}
          </Button>
          {ucsProntas > 0 && (
            <Button size="sm" variant="ghost" onClick={() => coletarAgora(true)} disabled={!configurado || ocupado != null}>
              Baixar UCs de novo
            </Button>
          )}
        </div>
        {aviso && <p className="mt-2 text-xs">{aviso}</p>}
        {indice && (
          <p className="mt-2 text-xs text-muted">
            Última coleta: {indice.competencia}, em {new Date(indice.em).toLocaleString("pt-BR")} · {indice.usinas ?? 0} usina(s) · {ucsProntas} planilha(s) de UCs (abra o Rateio GD › Buscar no Orange)
            {indice.erros.length ? ` · ${indice.erros.length} falha(s)` : ""}
          </p>
        )}
        {indice?.erros.length ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-attention">Ver falhas</summary>
            <ul className="mt-1 space-y-0.5 text-muted">
              {indice.erros.slice(0, 20).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => copiar(JSON.stringify({ competencia: indice.competencia, usinas: indice.usinas, erros: indice.erros }))}>
              <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar falhas"}
            </Button>
          </details>
        ) : null}
      </div>

      {gerencial.length > 0 && (
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Economia registrada no Relatório Gerencial · {indice?.competencia}</p>
          {economia && economia.usinas > 0 && (
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {rs(economia.economiaRs)} <span className="text-sm font-normal text-muted">em {economia.usinas} usina(s), {kwh(economia.compensadoKwh)} compensados</span>
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Usina</th>
                  <th className="py-1 pr-3 text-right font-medium">UCs</th>
                  <th className="py-1 pr-3 text-right font-medium">Consumo</th>
                  <th className="py-1 pr-3 text-right font-medium">Compensado</th>
                  <th className="py-1 pr-3 text-right font-medium">Economia</th>
                  <th className="py-1 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {gerencial.map((g) => (
                  <tr key={g.usinaId} className="border-t border-border">
                    <td className="py-1 pr-3">{g.usina}</td>
                    <td className="py-1 pr-3 text-right">{g.totais.ucs || "-"}</td>
                    <td className="py-1 pr-3 text-right">{g.totais.consumoKwh ? kwh(g.totais.consumoKwh) : "-"}</td>
                    <td className="py-1 pr-3 text-right">{g.totais.compensadoKwh ? kwh(g.totais.compensadoKwh) : "-"}</td>
                    <td className="py-1 pr-3 text-right">{g.status === "ok" ? rs(g.totais.economiaRs) : "-"}</td>
                    <td className="py-1 text-muted">{STATUS[g.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Valores do próprio Orange (Relatório Gerencial, versão atual). Competências ainda não processadas lá aparecem como pendentes e são lidas na próxima coleta.</p>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted">Diagnóstico das telas (suporte)</summary>
        <Button size="sm" variant="secondary" className="mt-2" onClick={mapear} disabled={!configurado || ocupado != null}>
          {ocupado === "mapa" && <Loader2 className="size-4 animate-spin" />} Mapear telas do Orange
        </Button>
        {mapa && (
          <div className="mt-2 text-xs">
            {!mapa.ok ? (
              <p className="text-attention">Não mapeou: {mapa.erro}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span>Mapa pronto: {mapa.paginas?.length ?? 0} telas.</span>
                <Button size="sm" variant="ghost" onClick={() => copiar(JSON.stringify(mapa))}>
                  <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar diagnóstico"}
                </Button>
              </div>
            )}
          </div>
        )}
      </details>
    </div>
  );
}
