// Estatísticas anônimas, opcionais. Só existem se o build definir um endereço
// (RAJADA_ANALYTICS_URL) e o jogador ligar em Ajustes. Sem endereço, o jogo
// não faz nenhuma chamada de rede. Ver docs/lancamento.md.

const ENDPOINT = typeof __ANALYTICS_URL__ !== "undefined" ? __ANALYTICS_URL__ : "";
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

export function createAnalytics(getProfile, platform) {
  const enabled = () => Boolean(ENDPOINT) && getProfile().settings.analytics && Boolean(getProfile().id);
  return {
    available: Boolean(ENDPOINT),
    track(event, props = {}) {
      if (!enabled()) return;
      const body = JSON.stringify({ event, props, id: getProfile().id, platform, v: VERSION, t: Date.now() });
      try {
        if (!navigator.sendBeacon?.(ENDPOINT, body)) {
          fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
        }
      } catch {
        // sem rede: a estatística se perde, o jogo segue
      }
    },
  };
}

// Identificador aleatório, criado só quando o jogador liga as estatísticas.
export function newInstallId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
