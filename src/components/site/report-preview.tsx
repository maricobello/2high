import { Check } from "lucide-react";

/**
 * Prévia do relatório de auditoria: mostra O QUE é conferido em cada fatura.
 * Exemplo de layout — sem valores e sem dados de clientes.
 */
const ROWS: { item: string; check: string; base: string }[] = [
  { item: "Classe e modalidade tarifária", check: "Enquadramento correto para o seu uso", base: "REN ANEEL 1.000/2021" },
  { item: "Leituras e consumo", check: "Leituras estimadas e acertos posteriores", base: "REN ANEEL 1.000/2021" },
  { item: "Demanda contratada", check: "Contrato, ultrapassagens e demanda medida", base: "REN ANEEL 1.000/2021" },
  { item: "Energia reativa", check: "Excedente cobrado versus medido", base: "REN ANEEL 1.000/2021" },
  { item: "ICMS sobre demanda", check: "Imposto só sobre a demanda utilizada", base: "Súmula 391, STJ" },
  { item: "Crédito de ICMS", check: "Energia usada na produção (indústria)", base: "LC 87/96, art. 33" },
];

export function ReportPreview() {
  return (
    <figure className="overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_40px_100px_-40px_rgba(7,11,22,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <p className="text-[15px] font-bold tracking-tight">Relatório de auditoria</p>
        <span className="rounded-full bg-subtle px-2.5 py-1 text-[12.5px] font-medium text-muted">Exemplo de layout</span>
      </div>

      <ul className="divide-y divide-border">
        {ROWS.map((r) => (
          <li key={r.item} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{r.item}</p>
              <p className="mt-0.5 text-[13.5px] text-muted">
                {r.check} <span className="text-foreground/40">·</span> {r.base}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-[12.5px] font-semibold text-foreground">
              <Check className="size-3.5 text-primary" strokeWidth={3} /> Conferido
            </span>
          </li>
        ))}
      </ul>

      <figcaption className="border-t border-border bg-background px-5 py-3 text-[12.5px] text-muted sm:px-7">
        Exemplo de layout, sem dados de clientes. Valores calculados na auditoria.
      </figcaption>
    </figure>
  );
}
