// Progresso salvo no aparelho. localStorage pode faltar (aba anônima, prévia,
// dados bloqueados): o jogo segue funcionando, só não lembra entre visitas.
import { sanitizeProgress } from "./core.js";

const KEY = "prumo.v1";

export function loadProgress(phaseCount) {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(KEY)), phaseCount);
  } catch {
    return sanitizeProgress(null, phaseCount);
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // sem armazenamento: progresso vale só nesta sessão
  }
}
