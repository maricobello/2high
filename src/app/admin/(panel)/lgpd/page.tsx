import Link from "next/link";
import { RequestStatusSelect } from "@/components/admin/privacy-actions";
import { formatDateTime } from "@/lib/utils";
import { db } from "@/modules/db";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  acesso: "Acesso",
  correcao: "Correção",
  exclusao: "Exclusão",
  revogacao: "Revogação",
  portabilidade: "Portabilidade",
  informacao: "Informação",
};

export default async function LgpdPage() {
  const requests = await db().listPrivacyRequests();
  const open = requests.filter((r) => r.status === "aberta" || r.status === "em_andamento");
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5">
        <h1 className="font-semibold">Solicitações de titulares (LGPD)</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} em aberto. Prazo recomendado de resposta: 15 dias. Para exclusão, abra o lead e use “Excluir dados (LGPD)” — remove registros e arquivos de fatura.
        </p>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border bg-subtle/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Protocolo</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Recebido</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs">{r.protocol}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{r.email}</p>
                  {r.message && <p className="mt-1 max-w-xs text-xs text-foreground/70">{r.message}</p>}
                </td>
                <td className="px-4 py-3">{LABELS[r.type]}</td>
                <td className="px-4 py-3">
                  {r.leadId ? (
                    <Link href={`/admin/leads/${r.leadId}`} className="text-primary hover:underline">
                      abrir lead
                    </Link>
                  ) : (
                    <span className="text-muted">não vinculado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <RequestStatusSelect id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {!requests.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Nenhuma solicitação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
