/** Evento que leva o visitante ao formulário de análise (hero da home). */
export const OPEN_ANALYSIS_EVENT = "aferi:analisar";

export function openAnalysis() {
  window.dispatchEvent(new Event(OPEN_ANALYSIS_EVENT));
}
