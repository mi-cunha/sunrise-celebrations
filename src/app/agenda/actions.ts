"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type CalendarFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string>; version?: number };

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Informe um título.").max(120, "Use até 120 caracteres."),
  entryType: z.enum(["evento_casa", "data_importante", "bloqueio", "manutencao"]),
  startDate: z.iso.date("Informe a data inicial."),
  endDate: z.iso.date("Informe a data final."),
  notes: z.string().trim().max(1200, "Use até 1200 caracteres.").optional(),
}).refine((value) => value.endDate >= value.startDate, { message: "A data final deve ser igual ou posterior à inicial.", path: ["endDate"] });

const deleteSchema = z.object({ id: z.string().uuid() });

export async function saveCalendarEntry(_: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const raw = {
    id: String(formData.get("id") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    entryType: String(formData.get("entryType") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw as Record<string, string>, version: Date.now() };

  const { supabase, user, permissions } = await requireUser();
  if (!permissions.some((permission) => permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) return { error: "Você não tem permissão para alterar a agenda.", version: Date.now() };
  const payload = { title: parsed.data.title, entry_type: parsed.data.entryType, start_date: parsed.data.startDate, end_date: parsed.data.endDate, notes: parsed.data.notes || null };
  const result = parsed.data.id
    ? await supabase.from("calendar_entries").update(payload).eq("id", parsed.data.id)
    : await supabase.from("calendar_entries").insert({ ...payload, created_by: user.id });
  if (result.error) return { error: result.error.message, values: raw as Record<string, string>, version: Date.now() };
  revalidatePath("/agenda");
  return { success: parsed.data.id ? "Data atualizada." : "Data adicionada à agenda.", version: Date.now() };
}

export async function deleteCalendarEntry(_: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Data inválida.", version: Date.now() };
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) return { error: "Você não tem permissão para alterar a agenda.", version: Date.now() };
  const { error } = await supabase.from("calendar_entries").delete().eq("id", parsed.data.id);
  if (error) return { error: error.message, version: Date.now() };
  revalidatePath("/agenda");
  return { success: "Data removida.", version: Date.now() };
}
