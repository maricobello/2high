import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
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
 * Driver local (arquivo JSON) para desenvolvimento e demonstração sem Supabase.
 * NÃO usar em produção: não é compartilhado entre instâncias serverless.
 */
interface Store {
  leads: LeadRecord[];
  invoices: InvoiceRecord[];
  diagnostics: DiagnosticRecord[];
  activities: ActivityRecord[];
  notifications: NotificationRecord[];
  followUps: FollowUpRecord[];
  simulations: SimulationRecord[];
  partners: PartnerRecord[];
  privacyRequests: PrivacyRequestRecord[];
}

const empty = (): Store => ({
  leads: [],
  invoices: [],
  diagnostics: [],
  activities: [],
  notifications: [],
  followUps: [],
  simulations: [],
  partners: [],
  privacyRequests: [],
});

export class LocalRepository implements Repository {
  private file: string;
  private store: Store | null = null;
  private mtimeMs = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = path.join(dir, "db.json");
  }

  /** Relê o arquivo quando outra instância (outra rota/worker) o alterou. */
  private async load(): Promise<Store> {
    try {
      const { mtimeMs } = await stat(this.file);
      if (this.store && mtimeMs === this.mtimeMs) return this.store;
      this.store = { ...empty(), ...(JSON.parse(await readFile(this.file, "utf8")) as Store) };
      this.mtimeMs = mtimeMs;
    } catch {
      if (!this.store) this.store = empty();
    }
    return this.store;
  }

  /** Serializa escritas para evitar corrida entre requisições concorrentes. */
  private mutate<T>(fn: (s: Store) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const s = await this.load();
      const result = fn(s);
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(s));
      await rename(tmp, this.file);
      this.mtimeMs = (await stat(this.file)).mtimeMs;
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private now() {
    return new Date().toISOString();
  }

  async createLead(lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">) {
    return this.mutate((s) => {
      const rec: LeadRecord = { ...lead, id: randomUUID(), createdAt: this.now(), updatedAt: this.now() };
      s.leads.push(rec);
      return structuredClone(rec);
    });
  }
  async updateLead(id: string, patch: Partial<LeadRecord>) {
    return this.mutate((s) => {
      const i = s.leads.findIndex((l) => l.id === id);
      if (i < 0) throw new Error("Lead não encontrado");
      s.leads[i] = { ...s.leads[i], ...patch, id, updatedAt: this.now() };
      return structuredClone(s.leads[i]);
    });
  }
  async getLead(id: string) {
    const s = await this.load();
    return structuredClone(s.leads.find((l) => l.id === id) ?? null);
  }
  async getLeadByToken(token: string) {
    const s = await this.load();
    return structuredClone(s.leads.find((l) => l.accessToken === token) ?? null);
  }
  async findLeadByPhone(digits: string) {
    const s = await this.load();
    const tail = digits.slice(-10);
    const found = [...s.leads].reverse().find((l) => l.phone.replace(/\D/g, "").endsWith(tail));
    return structuredClone(found ?? null);
  }
  async findLeadByEmail(email: string) {
    const s = await this.load();
    const e = email.trim().toLowerCase();
    return structuredClone([...s.leads].reverse().find((l) => l.email.toLowerCase() === e) ?? null);
  }
  async deleteLead(id: string) {
    await this.mutate((s) => {
      s.leads = s.leads.filter((l) => l.id !== id);
      s.invoices = s.invoices.filter((x) => x.leadId !== id);
      s.diagnostics = s.diagnostics.filter((x) => x.leadId !== id);
      s.activities = s.activities.filter((x) => x.leadId !== id);
      s.notifications = s.notifications.filter((x) => x.leadId !== id);
      s.followUps = s.followUps.filter((x) => x.leadId !== id);
      s.simulations = s.simulations.map((x) => (x.leadId === id ? { ...x, leadId: null } : x));
      s.privacyRequests = s.privacyRequests.map((x) => (x.leadId === id ? { ...x, leadId: null } : x));
    });
  }
  async listLeads(filter: LeadListFilter = {}) {
    const s = await this.load();
    const q = filter.q?.toLowerCase().trim();
    return structuredClone(
      s.leads
        .filter((l) => (!filter.stage || l.stage === filter.stage) && (!filter.temperature || l.temperature === filter.temperature))
        .filter((l) => !q || [l.name, l.company, l.email, l.cnpj, l.protocol, l.phone].some((v) => v?.toLowerCase().includes(q)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 500),
    );
  }

  async createInvoice(inv: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">) {
    return this.mutate((s) => {
      const rec: InvoiceRecord = { ...inv, id: randomUUID(), createdAt: this.now(), updatedAt: this.now() };
      s.invoices.push(rec);
      return structuredClone(rec);
    });
  }
  async updateInvoice(id: string, patch: Partial<InvoiceRecord>) {
    return this.mutate((s) => {
      const i = s.invoices.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Fatura não encontrada");
      s.invoices[i] = { ...s.invoices[i], ...patch, id, updatedAt: this.now() };
      return structuredClone(s.invoices[i]);
    });
  }
  async getLatestInvoice(leadId: string) {
    const s = await this.load();
    const list = s.invoices.filter((x) => x.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone(list[0] ?? null);
  }

  async listInvoices(leadId: string) {
    const s = await this.load();
    return structuredClone(s.invoices.filter((x) => x.leadId === leadId));
  }

  async saveDiagnostic(d: Omit<DiagnosticRecord, "id" | "createdAt">) {
    return this.mutate((s) => {
      const rec: DiagnosticRecord = { ...d, id: randomUUID(), createdAt: this.now() };
      s.diagnostics.push(rec);
      return structuredClone(rec);
    });
  }
  async getLatestDiagnostic(leadId: string) {
    const s = await this.load();
    const list = s.diagnostics.filter((x) => x.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone(list[0] ?? null);
  }

  async addActivity(a: Omit<ActivityRecord, "id" | "createdAt">) {
    return this.mutate((s) => {
      const rec: ActivityRecord = { ...a, id: randomUUID(), createdAt: this.now() };
      s.activities.push(rec);
      return structuredClone(rec);
    });
  }
  async listActivities(leadId: string) {
    const s = await this.load();
    return structuredClone(s.activities.filter((a) => a.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async addNotification(n: Omit<NotificationRecord, "id" | "createdAt">) {
    return this.mutate((s) => {
      const rec: NotificationRecord = { ...n, id: randomUUID(), createdAt: this.now() };
      s.notifications.push(rec);
      return structuredClone(rec);
    });
  }

  async createFollowUps(items: Omit<FollowUpRecord, "id" | "createdAt">[]) {
    await this.mutate((s) => {
      for (const it of items) s.followUps.push({ ...it, id: randomUUID(), createdAt: this.now() });
    });
  }
  async listDueFollowUps(nowIso: string, limit: number) {
    const s = await this.load();
    return structuredClone(
      s.followUps
        .filter((f) => f.status === "pending" && f.dueAt <= nowIso)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, limit),
    );
  }
  async listFollowUps(leadId: string) {
    const s = await this.load();
    return structuredClone(s.followUps.filter((f) => f.leadId === leadId).sort((a, b) => a.step - b.step));
  }
  async updateFollowUp(id: string, patch: Partial<FollowUpRecord>) {
    await this.mutate((s) => {
      const i = s.followUps.findIndex((f) => f.id === id);
      if (i >= 0) s.followUps[i] = { ...s.followUps[i], ...patch, id };
    });
  }
  async cancelFollowUps(leadId: string) {
    await this.mutate((s) => {
      for (const f of s.followUps) if (f.leadId === leadId && f.status === "pending") f.status = "cancelled";
    });
  }

  async createSimulation(sim: Omit<SimulationRecord, "id" | "createdAt">) {
    return this.mutate((s) => {
      const rec: SimulationRecord = { ...sim, id: randomUUID(), createdAt: this.now() };
      s.simulations.push(rec);
      return structuredClone(rec);
    });
  }

  async getLatestSimulation(leadId: string) {
    const s = await this.load();
    const list = s.simulations.filter((x) => x.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone(list[0] ?? null);
  }

  async createPrivacyRequest(r: Omit<PrivacyRequestRecord, "id" | "createdAt" | "resolvedAt">) {
    return this.mutate((s) => {
      const rec: PrivacyRequestRecord = { ...r, id: randomUUID(), createdAt: this.now(), resolvedAt: null };
      s.privacyRequests.push(rec);
      return structuredClone(rec);
    });
  }
  async listPrivacyRequests() {
    const s = await this.load();
    return structuredClone([...s.privacyRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  async updatePrivacyRequest(id: string, patch: Partial<PrivacyRequestRecord>) {
    return this.mutate((s) => {
      const i = s.privacyRequests.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Solicitação não encontrada");
      s.privacyRequests[i] = { ...s.privacyRequests[i], ...patch, id };
      return structuredClone(s.privacyRequests[i]);
    });
  }

  async listPartners() {
    const s = await this.load();
    return structuredClone(s.partners.filter((p) => p.active));
  }
  async createPartner(p: Omit<PartnerRecord, "id" | "createdAt">) {
    return this.mutate((s) => {
      const rec: PartnerRecord = { ...p, id: randomUUID(), createdAt: this.now() };
      s.partners.push(rec);
      return structuredClone(rec);
    });
  }
}
