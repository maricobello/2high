/** De onde vem a injeção mensal usada no estudo, em uma frase com a conta. */
import { injecaoMensal } from "./engine";
import { aplicacaoDaFatura } from "./fatura";
import type { Usina } from "./types";

const n = (v: number) => Math.round(v).toLocaleString("pt-BR");

export function origemInjecao(u: Usina): string {
  const E = injecaoMensal(u);
  if (!(E > 0)) return "Falta a injeção: envie a fatura, o recorte do Orange ou informe a energia injetada e os meses.";
  if (u.injecaoMensalProjetada != null && u.injecaoMensalProjetada > 0) {
    if (u.fonteInjecao === "fatura" && u.fatura) {
      const a = aplicacaoDaFatura(u.fatura);
      const base = a.base === "excedente" ? "excedente distribuído" : "energia injetada menos o consumo da usina";
      return `Da fatura (${u.fatura.distribuidora || "distribuidora"}): média de ${a.mesesUsados.length} ${a.mesesUsados.length === 1 ? "mês" : "meses"} de ${base} = ${n(E)} kWh/mês.`;
    }
    return `Digitada em "Injeção mensal projetada": ${n(E)} kWh/mês.`;
  }
  const fonte = u.fontePeriodo === "painel" ? `"Injetada" do recorte do Orange` : u.fontePeriodo === "planilha" ? "energia injetada da planilha modelo" : "energia injetada do período";
  return `${n(u.energiaInjetadaPeriodo)} kWh (${fonte}) ÷ ${u.meses} ${u.meses === 1 ? "mês" : "meses"} = ${n(E)} kWh/mês.`;
}
