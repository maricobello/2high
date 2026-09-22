import { ArrowLeft, ExternalLink, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TemperatureBadge } from "@/components/admin/kanban";
import { ActivityForm, LeadActions, ReprocessButton } from "@/components/admin/lead-actions";
import { FindingCard } from "@/components/diagnostic/finding-card";
import { formatBRL, formatDateTime } from "@/lib/utils";
import { db } from "@/modules/db";
import { diagnosticUrl } from "@/modules/crm/service";
import { FIELD_LABELS, type InvoiceData } from "@/modules/invoice/types";
import { billRangeInfo, FREE_MARKET_STATUS, SOLAR_STATUS, SOLUTION_LABELS, stageLabel } from "@/modules/leads/types";
import { storage } from "@/modules/storage";

export const dynamic = "force-dynamic";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function fmtValue(key: keyof InvoiceData, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (key === "history") return `${(v as unknown[]).length} meses`;
  if (typeof v === "number") return /Amount/.test(key) ? formatBRL(v) : v.toLocaleString("pt-BR");
  return String(v);
}

export default async function LeadDetail(props: PageProps<"/admin/leads/[id]">) {
  const { id } = await props.params;
  const lead = await db().getLead(id);
  if (!lead) notFound();
  const [invoice, diag, activities, followUps, partners] = await Promise.all([
    db().getLatestInvoice(id),
    db().getLatestDiagnostic(id),
    db().listActivities(id),
    db().listFollowUps(id),
    db().listPartners(),
  ]);
  const fileUrl = invoice ? await storage().signedUrl(invoice.storagePath, 300) : null;
  const phone = lead.phone.replace(/\D/g, "");
  const waLink = `https://wa.me/55${phone}?text=${encodeURIComponent(`Olá, ${lead.name.split(" ")[0]}! Aqui é da equipe de energia, sobre o diagnóstico ${lead.protocol}.`)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
            <ArrowLeft className="size-3" /> Pipeline
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.company || lead.name}</h1>
            <TemperatureBadge t={lead.temperature} score={lead.score} />
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium">{stageLabel(lead.stage)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {lead.protocol} · {lead.source} · criado em {formatDateTime(lead.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1fa855] px-3 text-sm font-semibold text-white">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a href={diagnosticUrl(lead)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-medium">
            <ExternalLink className="size-4" /> Ver Raio-X
          </a>
          <ReprocessButton id={lead.id} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Section title="Contato">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted">Nome</dt><dd className="font-medium">{lead.name}</dd></div>
              <div><dt className="text-xs text-muted">CNPJ</dt><dd className="font-medium">{lead.cnpj || "—"}</dd></div>
              <div><dt className="text-xs text-muted">Telefone</dt><dd className="flex items-center gap-1.5 font-medium"><Phone className="size-3.5 text-muted" />{lead.phone}</dd></div>
              <div><dt className="text-xs text-muted">E-mail</dt><dd className="flex items-center gap-1.5 font-medium"><Mail className="size-3.5 text-muted" /><a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a></dd></div>
              <div><dt className="text-xs text-muted">Local</dt><dd className="font-medium">{[lead.city, lead.state].filter(Boolean).join(" / ") || "—"}</dd></div>
              <div><dt className="text-xs text-muted">Conta informada</dt><dd className="font-medium">{billRangeInfo(lead.billRange)?.label ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted">Solar</dt><dd className="font-medium">{SOLAR_STATUS.find((s) => s.value === lead.solarStatus)?.label ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted">Mercado Livre</dt><dd className="font-medium">{FREE_MARKET_STATUS.find((s) => s.value === lead.freeMarketStatus)?.label ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted">Solução recomendada</dt><dd className="font-medium">{lead.recommendedSolutions.map((s) => SOLUTION_LABELS[s]).join(", ") || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted">Sinais de intenção</dt><dd className="text-xs">{lead.intentSignals.join(", ") || "—"}</dd></div>
            </dl>
          </Section>

          {diag && (
            <Section title="Diagnóstico" action={<span className="text-xs text-muted">motor v{diag.engineVersion} · resumo: {diag.summarySource}</span>}>
              <p className="mb-4 text-sm leading-relaxed">{diag.summary}</p>
              <div className="space-y-3">
                {diag.audit.findings.map((f) => (
                  <FindingCard key={f.code} finding={f} plainText={diag.findingTexts?.[f.code]} />
                ))}
              </div>
            </Section>
          )}

          {invoice && (
            <Section
              title="Fatura e dados extraídos"
              action={
                fileUrl && (
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    <FileText className="size-4" /> {invoice.fileName}
                  </a>
                )
              }
            >
              <p className="mb-3 text-xs text-muted">
                Status: {invoice.status} · método: {invoice.extractionMethod ?? "—"} · leitura: {invoice.ocrProvider ?? "—"} · completude:{" "}
                {invoice.validation ? `${Math.round(invoice.validation.completeness * 100)}%` : "—"}
              </p>
              {invoice.extracted ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr>
                        <th className="py-1.5 pr-3">Campo</th>
                        <th className="py-1.5 pr-3">Valor</th>
                        <th className="py-1.5 pr-3">Fonte</th>
                        <th className="py-1.5">Confiança</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(Object.keys(FIELD_LABELS) as (keyof InvoiceData)[])
                        .filter((k) => {
                          const val = invoice.extracted![k];
                          return Array.isArray(val) ? val.length > 0 : val !== null;
                        })
                        .map((k) => {
                          const meta = invoice.fieldMeta?.[k];
                          return (
                            <tr key={k}>
                              <td className="py-1.5 pr-3 text-muted">{FIELD_LABELS[k]}</td>
                              <td className="py-1.5 pr-3 font-medium tabular">{fmtValue(k, invoice.extracted![k])}</td>
                              <td className="py-1.5 pr-3 text-xs">{meta?.source ?? "—"}</td>
                              <td className="py-1.5 text-xs tabular" title={meta?.note}>
                                {meta ? `${Math.round(meta.confidence * 100)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">Sem dados extraídos.</p>
              )}
              {invoice.validation?.issues.length ? (
                <ul className="mt-4 space-y-1 rounded-xl bg-subtle p-3 text-xs">
                  {invoice.validation.issues.map((i, idx) => (
                    <li key={idx} className={i.severity === "error" ? "text-attention" : i.severity === "warning" ? "text-analysis" : "text-muted"}>
                      [{i.severity}] {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Gestão comercial">
            <LeadActions
              id={lead.id}
              stage={lead.stage}
              owner={lead.owner}
              partnerId={lead.partnerId}
              potentialValue={lead.potentialValue}
              potentialCommission={lead.potentialCommission}
              notes={lead.notes}
              followUpOptOut={lead.followUpOptOut}
              partners={partners.map((x) => ({ id: x.id, name: x.name }))}
            />
          </Section>

          {lead.scoreBreakdown && (
            <Section title={`Score ${lead.score ?? "—"}/100`}>
              <div className="space-y-2.5">
                {lead.scoreBreakdown.map((c) => (
                  <div key={c.key}>
                    <div className="flex justify-between text-xs">
                      <span>{c.label}</span>
                      <span className="tabular text-muted">
                        {c.points}/{c.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(c.points / c.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Registrar contato">
            <ActivityForm id={lead.id} />
          </Section>

          {followUps.length > 0 && (
            <Section title="Follow-up automático">
              <ul className="space-y-2 text-sm">
                {followUps.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span>
                      #{f.step} · {f.channel}
                    </span>
                    <span className="text-xs text-muted">
                      {f.status} · {formatDateTime(f.sentAt ?? f.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Histórico">
            <ol className="relative space-y-4 border-l border-border pl-4">
              {activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-white bg-primary" />
                  <p className="text-xs text-muted">
                    {formatDateTime(a.createdAt)} · {a.type}
                    {a.channel ? ` · ${a.channel}` : ""} · {a.author ?? "—"}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line leading-relaxed">{a.content}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
