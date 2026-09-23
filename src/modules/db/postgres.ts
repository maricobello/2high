import "server-only";
import postgres from "postgres";
import { nationalNumber, samePhone } from "@/modules/leads/phone";
import type {
  ActivityRecord,
  DiagnosticRecord,
  FollowUpRecord,
  InvoiceRecord,
  LeadListFilter,
  LeadRecord,
  NotificationRecord,
  PartnerRecord,
  PrivacyRequestRecord,
  Repository,
  SimulationRecord,
} from "./types";

/**
 * Driver PostgreSQL direto (ex.: Supabase via pooler em modo transação).
 * Usa um papel dedicado (DATABASE_URL) — dispensa a service role do Supabase.
 */
const JSON_COLUMNS = new Set([
  "score_breakdown",
  "utm",
  "extracted",
  "field_meta",
  "validation",
  "audit",
  "finding_texts",
  "meta",
  "input",
  "result",
]);
const NUMERIC_KEYS = new Set(["potentialValue", "potentialCommission", "commissionRate"]);

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

type Sql = ReturnType<typeof postgres>;
let shared: Sql | null = null;

export function getSql(url: string): Sql {
  if (!shared) {
    shared = postgres(url, {
      prepare: false, // obrigatório no pooler em modo transação
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: url.includes("localhost") ? false : "require",
    });
  }
  return shared;
}

function fromRow<T>(row: Record<string, unknown> | undefined | null): T | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toCamel(k);
    out[key] = v instanceof Date ? v.toISOString() : NUMERIC_KEYS.has(key) && typeof v === "string" ? Number(v) : v;
  }
  return out as T;
}

export class PostgresRepository implements Repository {
  constructor(private sql: Sql) {}

  private row(rec: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v === undefined || k === "id" || k === "createdAt") continue;
      const col = toSnake(k);
      out[col] = JSON_COLUMNS.has(col) && v !== null ? this.sql.json(v as never) : v;
    }
    return out;
  }

  private async insert<T>(table: string, rec: Record<string, unknown>): Promise<T> {
    const r = this.row(rec);
    const [row] = await this.sql`insert into ${this.sql(table)} ${this.sql(r)} returning *`;
    return fromRow<T>(row)!;
  }

  private async update<T>(table: string, id: string, patch: Record<string, unknown>): Promise<T> {
    const r = this.row(patch);
    if (!Object.keys(r).length) {
      const [row] = await this.sql`select * from ${this.sql(table)} where id = ${id}`;
      return fromRow<T>(row)!;
    }
    const [row] = await this.sql`update ${this.sql(table)} set ${this.sql(r)} where id = ${id} returning *`;
    if (!row) throw new Error(`[db] ${table}: registro não encontrado`);
    return fromRow<T>(row)!;
  }

  private many<T>(rows: readonly Record<string, unknown>[]): T[] {
    return rows.map((r) => fromRow<T>(r)!);
  }

  /* ---------------- leads ---------------- */
  createLead(lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">) {
    return this.insert<LeadRecord>("leads", lead as unknown as Record<string, unknown>);
  }
  updateLead(id: string, patch: Partial<LeadRecord>) {
    return this.update<LeadRecord>("leads", id, { ...patch, updatedAt: new Date().toISOString() });
  }
  async getLead(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [r] = await this.sql`select * from leads where id = ${id}`;
    return fromRow<LeadRecord>(r);
  }
  async getLeadByToken(token: string) {
    const [r] = await this.sql`select * from leads where access_token = ${token}`;
    return fromRow<LeadRecord>(r);
  }
  async findLeadByPhone(digits: string) {
    const tail = nationalNumber(digits).slice(-8);
    if (tail.length < 8) return null;
    const rows = await this.sql`select * from leads where phone like ${"%" + tail} order by created_at desc limit 20`;
    return this.many<LeadRecord>(rows).find((l) => samePhone(l.phone, digits)) ?? null;
  }
  async findLeadByEmail(email: string) {
    const [r] = await this.sql`select * from leads where lower(email) = ${email.trim().toLowerCase()} order by created_at desc limit 1`;
    return fromRow<LeadRecord>(r);
  }
  async deleteLead(id: string) {
    await this.sql`delete from leads where id = ${id}`;
  }
  async listLeads(filter: LeadListFilter = {}) {
    const q = filter.q?.trim() ? `%${filter.q.trim()}%` : null;
    const rows = await this.sql`
      select * from leads
      where (${filter.stage ?? null}::text is null or stage = ${filter.stage ?? null})
        and (${filter.temperature ?? null}::text is null or temperature = ${filter.temperature ?? null})
        and (${q}::text is null or name ilike ${q} or company ilike ${q} or email ilike ${q} or cnpj ilike ${q} or protocol ilike ${q} or phone ilike ${q})
      order by created_at desc
      limit ${filter.limit ?? 500}`;
    return this.many<LeadRecord>(rows);
  }

  /* ---------------- faturas ---------------- */
  createInvoice(inv: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">) {
    return this.insert<InvoiceRecord>("invoices", inv as unknown as Record<string, unknown>);
  }
  updateInvoice(id: string, patch: Partial<InvoiceRecord>) {
    return this.update<InvoiceRecord>("invoices", id, { ...patch, updatedAt: new Date().toISOString() });
  }
  async getLatestInvoice(leadId: string) {
    const [r] = await this.sql`select * from invoices where lead_id = ${leadId} order by created_at desc limit 1`;
    return fromRow<InvoiceRecord>(r);
  }
  async listInvoices(leadId: string) {
    return this.many<InvoiceRecord>(await this.sql`select * from invoices where lead_id = ${leadId}`);
  }

  /* ---------------- diagnósticos ---------------- */
  saveDiagnostic(d: Omit<DiagnosticRecord, "id" | "createdAt">) {
    return this.insert<DiagnosticRecord>("diagnostics", d as unknown as Record<string, unknown>);
  }
  async getLatestDiagnostic(leadId: string) {
    const [r] = await this.sql`select * from diagnostics where lead_id = ${leadId} order by created_at desc limit 1`;
    return fromRow<DiagnosticRecord>(r);
  }

  /* ---------------- atividades / notificações ---------------- */
  addActivity(a: Omit<ActivityRecord, "id" | "createdAt">) {
    return this.insert<ActivityRecord>("lead_activities", a as unknown as Record<string, unknown>);
  }
  async listActivities(leadId: string) {
    return this.many<ActivityRecord>(await this.sql`select * from lead_activities where lead_id = ${leadId} order by created_at desc limit 200`);
  }
  addNotification(n: Omit<NotificationRecord, "id" | "createdAt">) {
    return this.insert<NotificationRecord>("notifications", n as unknown as Record<string, unknown>);
  }

  /* ---------------- follow-ups ---------------- */
  async createFollowUps(items: Omit<FollowUpRecord, "id" | "createdAt">[]) {
    for (const it of items) await this.insert("follow_ups", it as unknown as Record<string, unknown>);
  }
  async listDueFollowUps(nowIso: string, limit: number) {
    return this.many<FollowUpRecord>(
      await this.sql`select * from follow_ups where status = 'pending' and due_at <= ${nowIso} order by due_at asc limit ${limit}`,
    );
  }
  async listFollowUps(leadId: string) {
    return this.many<FollowUpRecord>(await this.sql`select * from follow_ups where lead_id = ${leadId} order by step asc`);
  }
  async updateFollowUp(id: string, patch: Partial<FollowUpRecord>) {
    await this.update("follow_ups", id, patch as Record<string, unknown>);
  }
  async cancelFollowUps(leadId: string) {
    await this.sql`update follow_ups set status = 'cancelled' where lead_id = ${leadId} and status = 'pending'`;
  }

  /* ---------------- simulações ---------------- */
  createSimulation(s: Omit<SimulationRecord, "id" | "createdAt">) {
    return this.insert<SimulationRecord>("simulations", s as unknown as Record<string, unknown>);
  }
  async getLatestSimulation(leadId: string) {
    const [r] = await this.sql`select * from simulations where lead_id = ${leadId} order by created_at desc limit 1`;
    return fromRow<SimulationRecord>(r);
  }

  /* ---------------- LGPD ---------------- */
  createPrivacyRequest(r: Omit<PrivacyRequestRecord, "id" | "createdAt" | "resolvedAt">) {
    return this.insert<PrivacyRequestRecord>("privacy_requests", r as unknown as Record<string, unknown>);
  }
  async listPrivacyRequests() {
    return this.many<PrivacyRequestRecord>(await this.sql`select * from privacy_requests order by created_at desc limit 500`);
  }
  updatePrivacyRequest(id: string, patch: Partial<PrivacyRequestRecord>) {
    return this.update<PrivacyRequestRecord>("privacy_requests", id, patch as Record<string, unknown>);
  }

  /* ---------------- parceiros ---------------- */
  async listPartners() {
    return this.many<PartnerRecord>(await this.sql`select * from partners where active order by name`);
  }
  createPartner(p: Omit<PartnerRecord, "id" | "createdAt">) {
    return this.insert<PartnerRecord>("partners", p as unknown as Record<string, unknown>);
  }
}
