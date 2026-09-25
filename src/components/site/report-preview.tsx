import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prévia do relatório de auditoria: mostra O QUE o cliente recebe.
 * É um exemplo de layout — sem valores e sem dados de clientes.
 */
const ROWS: { item: string; base: string; status: "ok" | "atencao" }[] = [
  { item: "Classe e modalidade tarifária", base: "REN ANEEL 1.000/2021", status: "ok" },
  { item: "Leituras e consumo estimado", base: "REN ANEEL 1.000/2021", status: "atencao" },
  { item: "Demanda contratada e ultrapassagens", base: "REN ANEEL 1.000/2021", status: "ok" },
  { item: "Energia reativa", base: "REN ANEEL 1.000/2021", status: "ok" },
  { item: "ICMS sobre demanda", base: "Súmula 391, STJ", status: "atencao" },
  { item: "Crédito de ICMS na produção (indústria)", base: "LC 87/96, art. 33", status: "atencao" },
];

const FIELDS = ["Unidade consumidora", "Distribuidora", "Período analisado", "Faturas lidas"];

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-2.5 rounded-full bg-subtle", className)} />;
}

export function ReportPreview() {
  return (
    <figure className="overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_40px_100px_-40px_rgba(7,11,22,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <p className="text-[15px] font-bold tracking-tight">Relatório de auditoria</p>
        <span className="rounded-full bg-subtle px-2.5 py-1 text-[12px] font-medium text-muted">Exemplo de layout</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border px-5 py-5 sm:grid-cols-4 sm:px-7">
        {FIELDS.map((f, i) => (
          <div key={f}>
            <dt className="text-[12px] text-muted">{f}</dt>
            <dd className="mt-2">
              <Bar className={i % 2 ? "w-16" : "w-24"} />
            </dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-border">
        {ROWS.map((r) => (
          <li key={r.item} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:px-7">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{r.item}</p>
              <p className="text-[12.5px] text-muted sm:hidden">{r.base}</p>
            </div>
            <p className="hidden text-[13px] text-muted sm:block">{r.base}</p>
            <span className="hidden w-24 sm:block" title="Calculado na auditoria">
              <Bar className="w-full" />
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 justify-self-end rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
                r.status === "ok" ? "bg-opportunity-soft text-[#11603f]" : "bg-analysis-soft text-[#8a4105]",
              )}
            >
              {r.status === "ok" ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
              {r.status === "ok" ? "Verificado" : "Atenção"}
            </span>
          </li>
        ))}
      </ul>

      <figcaption className="border-t border-border bg-background px-5 py-3 text-[12.5px] text-muted sm:px-7">
        Exemplo de layout. Não contém dados de clientes. Os valores são calculados na auditoria.
      </figcaption>
    </figure>
  );
}
