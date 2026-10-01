import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";
import { corporateReportExportRows, summarizeCorporateEvents, type CorporateReportFilters } from "@/lib/corporate-report";

export async function GET(request: Request) {
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => ["financeiro", "gerencia", "direcao", "admin_owner"].includes(permission))) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const format = query.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters: CorporateReportFilters = { start: query.get("inicio") || undefined, end: query.get("fim") || undefined, dateBy: normalizeDateBy(query.get("criterio")), responsibleId: query.get("responsavel") || undefined, status: query.get("status") || undefined };
  const { data, error } = await supabase.from("contracted_events").select("id,status,event_type,event_date,leads(name,company,created_at,responsible_id,profiles!leads_responsible_id_fkey(display_name)),quotes(total_amount_cents,approved_at),contracted_event_payments(status,amount_cents,paid_at),contracted_event_costs(status,estimated_amount_cents,actual_amount_cents,commission_kind)").limit(1000);
  if (error) return NextResponse.json({ error: "Não foi possível gerar o relatório." }, { status: 500 });
  const rows = corporateReportExportRows(summarizeCorporateEvents((data ?? []) as never[], filters));
  const fileName = `eventos-corporativos-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows), { FS: ";" });
    return new NextResponse(`\ufeff${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}.csv"` } });
  }
  const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(book, sheet, "Eventos corporativos");
  return new NextResponse(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fileName}.xlsx"` } });
}
function normalizeDateBy(value: string | null): CorporateReportFilters["dateBy"] { return value === "approval" || value === "payment" || value === "event" ? value : "lead"; }
