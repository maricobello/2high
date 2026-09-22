import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityRecord,
  DiagnosticRecord,
  FollowUpRecord,
  InvoiceRecord,
  LeadListFilter,
  LeadRecord,
  NotificationRecord,
  PartnerRecord,
  Repository,
  SimulationRecord,
} from "./types";

/**
 * Driver Supabase/PostgreSQL. Usa a service role APENAS no servidor.
 * Tabelas com RLS habilitado e sem policies públicas (acesso só via backend).
 * Colunas em snake_case; objetos aninhados ficam em jsonb (camelCase).
 */
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function rowToRecord<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

function recordToRow(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

export class SupabaseRepository implements Repository {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async insert<T>(table: string, rec: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.from(table).insert(recordToRow(rec)).select().single();
    if (error) throw new Error(`[db] ${table}.insert: ${error.message}`);
    return rowToRecord<T>(data)!;
  }
  private async update<T>(table: string, id: string, patch: Record<string, unknown>): Promise<T> {
    const clean = { ...patch };
    delete clean.id;
    delete clean.createdAt;
    const { data, error } = await this.db.from(table).update(recordToRow(clean)).eq("id", id).select().single();
    if (error) throw new Error(`[db] ${table}.update: ${error.message}`);
    return rowToRecord<T>(data)!;
  }
  private async maybeOne<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T | null> {
    const { data, error } = await query;
    if (error) throw new Error(`[db] ${error.message}`);
    return rowToRecord<T>((data as Record<string, unknown> | null) ?? null);
  }
  private async many<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const { data, error } = await query;
    if (error) throw new Error(`[db] ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map((r) => rowToRecord<T>(r)!);
  }

  createLead(lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">) {
    return this.insert<LeadRecord>("leads", lead as unknown as Record<string, unknown>);
  }
  updateLead(id: string, patch: Partial<LeadRecord>) {
    return this.update<LeadRecord>("leads", id, { ...patch, updatedAt: new Date().toISOString() });
  }
  getLead(id: string) {
    return this.maybeOne<LeadRecord>(this.db.from("leads").select("*").eq("id", id).maybeSingle());
  }
  getLeadByToken(token: string) {
    return this.maybeOne<LeadRecord>(this.db.from("leads").select("*").eq("access_token", token).maybeSingle());
  }
  async findLeadByPhone(digits: string) {
    const list = await this.many<LeadRecord>(
      this.db.from("leads").select("*").like("phone", `%${digits.slice(-8)}`).order("created_at", { ascending: false }).limit(5),
    );
    return list.find((l) => l.phone.replace(/\D/g, "").endsWith(digits.slice(-10))) ?? list[0] ?? null;
  }
  listLeads(filter: LeadListFilter = {}) {
    let q = this.db.from("leads").select("*").order("created_at", { ascending: false }).limit(filter.limit ?? 500);
    if (filter.stage) q = q.eq("stage", filter.stage);
    if (filter.temperature) q = q.eq("temperature", filter.temperature);
    if (filter.q) {
      const term = filter.q.replace(/[%,()]/g, " ").trim();
      q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,cnpj.ilike.%${term}%,protocol.ilike.%${term}%`);
    }
    return this.many<LeadRecord>(q);
  }

  createInvoice(inv: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">) {
    return this.insert<InvoiceRecord>("invoices", inv as unknown as Record<string, unknown>);
  }
  updateInvoice(id: string, patch: Partial<InvoiceRecord>) {
    return this.update<InvoiceRecord>("invoices", id, { ...patch, updatedAt: new Date().toISOString() });
  }
  getLatestInvoice(leadId: string) {
    return this.maybeOne<InvoiceRecord>(
      this.db.from("invoices").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    );
  }

  saveDiagnostic(d: Omit<DiagnosticRecord, "id" | "createdAt">) {
    return this.insert<DiagnosticRecord>("diagnostics", d as unknown as Record<string, unknown>);
  }
  getLatestDiagnostic(leadId: string) {
    return this.maybeOne<DiagnosticRecord>(
      this.db.from("diagnostics").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    );
  }

  addActivity(a: Omit<ActivityRecord, "id" | "createdAt">) {
    return this.insert<ActivityRecord>("lead_activities", a as unknown as Record<string, unknown>);
  }
  listActivities(leadId: string) {
    return this.many<ActivityRecord>(this.db.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200));
  }

  addNotification(n: Omit<NotificationRecord, "id" | "createdAt">) {
    return this.insert<NotificationRecord>("notifications", n as unknown as Record<string, unknown>);
  }

  async createFollowUps(items: Omit<FollowUpRecord, "id" | "createdAt">[]) {
    if (!items.length) return;
    const { error } = await this.db.from("follow_ups").insert(items.map((i) => recordToRow(i as unknown as Record<string, unknown>)));
    if (error) throw new Error(`[db] follow_ups.insert: ${error.message}`);
  }
  listDueFollowUps(nowIso: string, limit: number) {
    return this.many<FollowUpRecord>(
      this.db.from("follow_ups").select("*").eq("status", "pending").lte("due_at", nowIso).order("due_at", { ascending: true }).limit(limit),
    );
  }
  listFollowUps(leadId: string) {
    return this.many<FollowUpRecord>(this.db.from("follow_ups").select("*").eq("lead_id", leadId).order("step", { ascending: true }));
  }
  async updateFollowUp(id: string, patch: Partial<FollowUpRecord>) {
    await this.update("follow_ups", id, patch as Record<string, unknown>);
  }
  async cancelFollowUps(leadId: string) {
    const { error } = await this.db.from("follow_ups").update({ status: "cancelled" }).eq("lead_id", leadId).eq("status", "pending");
    if (error) throw new Error(`[db] follow_ups.cancel: ${error.message}`);
  }

  createSimulation(s: Omit<SimulationRecord, "id" | "createdAt">) {
    return this.insert<SimulationRecord>("simulations", s as unknown as Record<string, unknown>);
  }

  getLatestSimulation(leadId: string) {
    return this.maybeOne<SimulationRecord>(
      this.db.from("simulations").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    );
  }

  listPartners() {
    return this.many<PartnerRecord>(this.db.from("partners").select("*").eq("active", true).order("name"));
  }
  createPartner(p: Omit<PartnerRecord, "id" | "createdAt">) {
    return this.insert<PartnerRecord>("partners", p as unknown as Record<string, unknown>);
  }
}
