import type {
  BillRange,
  FreeMarketStatus,
  IntentSignal,
  LeadSource,
  ProcessingStatus,
  SolarStatus,
  SolutionCode,
  Stage,
  Temperature,
} from "@/modules/leads/types";
import type { FieldMetaMap, InvoiceData, ValidationResult } from "@/modules/invoice/types";
import type { AuditResult } from "@/modules/rules-engine/types";
import type { ScoreComponent } from "@/modules/scoring/score";

export interface LeadRecord {
  id: string;
  protocol: string;
  accessToken: string;
  name: string;
  company: string | null;
  cnpj: string | null;
  phone: string;
  email: string;
  state: string | null;
  city: string | null;
  billRange: BillRange | null;
  solarStatus: SolarStatus | null;
  freeMarketStatus: FreeMarketStatus | null;
  source: LeadSource;
  stage: Stage;
  score: number | null;
  temperature: Temperature | null;
  scoreBreakdown: ScoreComponent[] | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  recommendedSolutions: SolutionCode[];
  opportunities: string[];
  potentialValue: number | null;
  potentialCommission: number | null;
  partnerId: string | null;
  owner: string | null;
  notes: string | null;
  intentSignals: IntentSignal[];
  followUpOptOut: boolean;
  consentAt: string;
  marketingConsent: boolean;
  utm: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: string;
  leadId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: "received" | "processing" | "processed" | "failed";
  ocrProvider: string | null;
  ocrText: string | null;
  extracted: InvoiceData | null;
  fieldMeta: FieldMetaMap | null;
  validation: ValidationResult | null;
  extractionMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticRecord {
  id: string;
  leadId: string;
  invoiceId: string | null;
  audit: AuditResult;
  summary: string;
  summarySource: "llm" | "template";
  findingTexts: Record<string, string>;
  engineVersion: string;
  createdAt: string;
}

export type ActivityType =
  | "system"
  | "note"
  | "contact"
  | "stage_change"
  | "whatsapp_click"
  | "notification"
  | "inbound_message"
  | "score_change"
  | "simulation";

export interface ActivityRecord {
  id: string;
  leadId: string;
  type: ActivityType;
  channel: string | null;
  content: string;
  meta: Record<string, unknown> | null;
  author: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  leadId: string | null;
  channel: "email" | "whatsapp" | "webhook";
  recipient: string;
  template: string;
  status: "sent" | "failed" | "skipped";
  providerResponse: string | null;
  createdAt: string;
}

export interface FollowUpRecord {
  id: string;
  leadId: string;
  step: number;
  channel: "whatsapp" | "email";
  dueAt: string;
  status: "pending" | "sent" | "skipped" | "failed" | "cancelled";
  sentAt: string | null;
  message: string | null;
  createdAt: string;
}

export interface SimulationRecord {
  id: string;
  leadId: string | null;
  kind: "gd" | "free_market";
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface PartnerRecord {
  id: string;
  name: string;
  kind: "comercializadora" | "gd" | "consultoria" | "representante" | "outro";
  contactEmail: string | null;
  contactPhone: string | null;
  commissionRate: number | null;
  active: boolean;
  createdAt: string;
}

export interface LeadListFilter {
  stage?: Stage;
  temperature?: Temperature;
  q?: string;
  limit?: number;
}

export type NewLead = Omit<LeadRecord, "id" | "createdAt" | "updatedAt">;

export interface Repository {
  createLead(lead: NewLead): Promise<LeadRecord>;
  updateLead(id: string, patch: Partial<LeadRecord>): Promise<LeadRecord>;
  getLead(id: string): Promise<LeadRecord | null>;
  getLeadByToken(token: string): Promise<LeadRecord | null>;
  findLeadByPhone(phoneDigits: string): Promise<LeadRecord | null>;
  listLeads(filter?: LeadListFilter): Promise<LeadRecord[]>;

  createInvoice(inv: Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">): Promise<InvoiceRecord>;
  updateInvoice(id: string, patch: Partial<InvoiceRecord>): Promise<InvoiceRecord>;
  getLatestInvoice(leadId: string): Promise<InvoiceRecord | null>;

  saveDiagnostic(d: Omit<DiagnosticRecord, "id" | "createdAt">): Promise<DiagnosticRecord>;
  getLatestDiagnostic(leadId: string): Promise<DiagnosticRecord | null>;

  addActivity(a: Omit<ActivityRecord, "id" | "createdAt">): Promise<ActivityRecord>;
  listActivities(leadId: string): Promise<ActivityRecord[]>;

  addNotification(n: Omit<NotificationRecord, "id" | "createdAt">): Promise<NotificationRecord>;

  createFollowUps(items: Omit<FollowUpRecord, "id" | "createdAt">[]): Promise<void>;
  listDueFollowUps(nowIso: string, limit: number): Promise<FollowUpRecord[]>;
  listFollowUps(leadId: string): Promise<FollowUpRecord[]>;
  updateFollowUp(id: string, patch: Partial<FollowUpRecord>): Promise<void>;
  cancelFollowUps(leadId: string): Promise<void>;

  createSimulation(s: Omit<SimulationRecord, "id" | "createdAt">): Promise<SimulationRecord>;
  getLatestSimulation(leadId: string): Promise<SimulationRecord | null>;

  listPartners(): Promise<PartnerRecord[]>;
  createPartner(p: Omit<PartnerRecord, "id" | "createdAt">): Promise<PartnerRecord>;
}
