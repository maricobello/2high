import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/modules/auth/admin";
import { IntakeError } from "@/modules/leads/intake";

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    return json({ error: "Verifique os campos destacados.", fields }, 422);
  }
  if (err instanceof IntakeError) return json({ error: err.message }, err.status);
  if (err instanceof UnauthorizedError) return json({ error: "Não autorizado" }, 401);
  console.error("[api]", err);
  return json({ error: "Erro interno. Tente novamente em instantes." }, 500);
}
