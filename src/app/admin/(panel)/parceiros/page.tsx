import { PartnerForm } from "@/components/admin/partner-form";
import { db } from "@/modules/db";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const partners = await db().listPartners();
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="mb-4 font-semibold">Novo parceiro</h1>
        <PartnerForm />
      </section>
      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-subtle/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Parceiro</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3 text-right">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partners.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.kind}</td>
                <td className="px-4 py-3 text-muted">{[p.contactEmail, p.contactPhone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3 text-right tabular">{p.commissionRate !== null ? `${(p.commissionRate * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
            {!partners.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  Nenhum parceiro cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
