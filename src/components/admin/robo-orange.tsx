"use client";

import { Bot, CheckCircle2, CircleDashed, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mapa = { ok: boolean; erro?: string; inicio?: { links: unknown[] }; paginas?: { caminho: string; titulo: string; status: number; endpoints: string[]; formularios: unknown[] }[] };

/** Robô do Orange: credenciais configuradas, teste de login e mapa das telas de GD. */
export function RoboOrange() {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [teste, setTeste] = useState<string | null>(null);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [ocupado, setOcupado] = useState<"teste" | "mapa" | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch("/api/admin/orange/status")
      .then((r) => r.json())
      .then((j: { configurado?: boolean }) => setConfigurado(Boolean(j.configurado)))
      .catch(() => setConfigurado(false));
  }, []);

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
      const j = (await (await fetch("/api/admin/orange/mapear", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json()) as Mapa;
      setMapa(j);
    } catch {
      setMapa({ ok: false, erro: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(null);
    }
  }

  async function copiar() {
    if (!mapa) return;
    const texto = JSON.stringify(mapa);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem área de transferência: o texto aparece abaixo para copiar à mão */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 size-5 text-primary-text" />
        <div className="min-w-0">
          <h2 className="font-semibold">Robô do Orange (rateio GD)</h2>
          <p className="mt-1 text-sm text-muted">Entra no Orange com o usuário da Replace e busca listas de UCs, Relatório Gerencial e energia das usinas, sem exportar à mão.</p>
        </div>
      </div>

      <div className="flex items-start gap-3 text-sm">
        {configurado ? <CheckCircle2 className="mt-0.5 size-4 text-opportunity" /> : <CircleDashed className="mt-0.5 size-4 text-muted" />}
        <div>
          <p className="font-medium">{configurado == null ? "Verificando credenciais…" : configurado ? "Credenciais do Orange configuradas" : "Credenciais do Orange não configuradas"}</p>
          {!configurado && configurado != null && (
            <p className="mt-1 text-xs text-muted">
              Na Vercel: projeto → Settings → Environment Variables → adicione <code>ORANGE_USUARIO</code> e <code>ORANGE_SENHA</code> (marque “Sensitive”) e faça um novo deploy. A senha fica só lá, criptografada; não vai para o código nem para o chat.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={testar} disabled={!configurado || ocupado != null}>
          {ocupado === "teste" && <Loader2 className="size-4 animate-spin" />} Testar login
        </Button>
        <Button size="sm" onClick={mapear} disabled={!configurado || ocupado != null}>
          {ocupado === "mapa" && <Loader2 className="size-4 animate-spin" />} Mapear telas do Orange
        </Button>
      </div>
      {teste && <p className="text-sm">{teste}</p>}

      {mapa && (
        <div className="rounded-xl border border-border p-4 text-sm">
          {!mapa.ok ? (
            <p className="text-attention">Não mapeou: {mapa.erro}</p>
          ) : (
            <>
              <p className="font-medium">
                Mapa pronto: {mapa.paginas?.length ?? 0} telas de GD, {mapa.paginas?.reduce((a, p) => a + p.endpoints.length, 0) ?? 0} endereços internos.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {mapa.paginas?.map((p) => (
                  <li key={p.caminho}>
                    <code>{p.caminho}</code> · {p.titulo || "sem título"} · {p.formularios.length} filtro(s) · {p.endpoints.length} endereço(s)
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="secondary" onClick={copiar}>
                  <Copy className="size-4" /> {copiado ? "Copiado" : "Copiar diagnóstico"}
                </Button>
                <span className="text-xs text-muted">Cole no chat com o Claude para ele programar a extração. Não leva senha, tokens nem dados de tabelas.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
