/** Evento que leva o visitante ao formulário de análise (hero da home). */
export const OPEN_ANALYSIS_EVENT = "aferi:analisar";

export function openAnalysis() {
  window.dispatchEvent(new Event(OPEN_ANALYSIS_EVENT));
}

/** O quiz avisa em que etapa está (para o atalho de voltar ao diagnóstico). */
export const QUIZ_PROGRESS_EVENT = "aferi:quiz-progresso";
