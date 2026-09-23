import "server-only";
import { env } from "@/lib/env";

/**
 * Cliente para Dados Abertos da ANEEL (CKAN datastore).
 * Uso previsto: tarifas homologadas por distribuidora/subgrupo/modalidade para
 * comparar com as tarifas lidas na fatura. Não está no caminho crítico do
 * pipeline: se indisponível, o diagnóstico segue normalmente.
 *
 * Configure ANEEL_TARIFF_RESOURCE_ID com o resource_id do conjunto
 * "Tarifas de Aplicação das Distribuidoras de Energia Elétrica".
 */
const BASE = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

export interface AneelTariffRow {
  [column: string]: string | number | null;
}

const cache = new Map<string, { at: number; rows: AneelTariffRow[] }>();
const TTL = 24 * 3600_000;

export async function fetchAneelTariffs(query: { distributor: string; subgroup?: string; modality?: string; limit?: number }): Promise<AneelTariffRow[] | null> {
  if (!env.aneelTariffResourceId) return null;
  const q = [query.distributor, query.subgroup, query.modality].filter(Boolean).join(" ");
  const key = `${q}|${query.limit ?? 50}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  try {
    const url = `${BASE}?resource_id=${encodeURIComponent(env.aneelTariffResourceId)}&q=${encodeURIComponent(q)}&limit=${query.limit ?? 50}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; result?: { records?: AneelTariffRow[] } };
    const rows = json.success ? (json.result?.records ?? []) : [];
    cache.set(key, { at: Date.now(), rows });
    return rows;
  } catch (err) {
    console.warn("[aneel] indisponível:", err instanceof Error ? err.message : err);
    return null;
  }
}
