// Progresso salvo no aparelho. localStorage pode faltar (aba anônima, prévia,
// dados bloqueados): o jogo segue funcionando, só não lembra entre visitas.
import { sanitizeProfile } from "./progress.js";

const KEY = "rajada.v1";

export function loadProfile() {
  try {
    return sanitizeProfile(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return sanitizeProfile(null);
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // sem armazenamento: progresso vale só nesta sessão
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a apagar
  }
}
