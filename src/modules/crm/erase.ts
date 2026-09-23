import "server-only";
import { db } from "@/modules/db";
import { storage } from "@/modules/storage";

/** Exclusão definitiva dos dados de um lead (arquivos de fatura + registros). */
export async function eraseLead(leadId: string): Promise<{ files: number }> {
  const invoices = await db().listInvoices(leadId);
  let files = 0;
  for (const inv of invoices) {
    try {
      await storage().remove(inv.storagePath);
      files++;
    } catch (err) {
      console.error("[erase] falha ao remover arquivo", inv.storagePath, err);
    }
  }
  await db().deleteLead(leadId);
  return { files };
}
