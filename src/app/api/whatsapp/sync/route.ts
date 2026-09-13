import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin, whatsappAdministrator } from "@/lib/whatsapp-auth";
import { connectionCredential, metaConfiguration, metaRequest, MetaRequestError } from "@/lib/whatsapp-meta";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const denied = await whatsappAdministrator();
  if (denied) return denied;
  const input = z.object({ confirm: z.literal(true) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Confirme a importação de contatos e histórico." }, { status: 400 });
  try {
    const { phoneNumberId } = metaConfiguration();
    const { token, connectionId } = await connectionCredential(phoneNumberId);
    const admin = createAdminClient();
    const { data: connection } = await admin.from("whatsapp_connections").select("connected_at,onboarding_id").eq("id", connectionId).single();
    if (!connection?.connected_at || Date.now() - Date.parse(connection.connected_at) >= 24 * 3600_000) throw new Error("A sincronização deve ser iniciada até 24 horas após o cadastro na Meta. Verifique a necessidade de novo onboarding.");
    for (const syncType of ["smb_app_state_sync", "history"] as const) {
      const { error: reservationError } = await admin.from("whatsapp_sync_requests").insert({ connection_id: connectionId, onboarding_id: connection.onboarding_id, sync_type: syncType, status: "requesting" });
      if (reservationError) {
        if (reservationError.code !== "23505") throw new Error("Não foi possível reservar a sincronização.");
        const { data: prior } = await admin.from("whatsapp_sync_requests").select("status").eq("connection_id", connectionId).eq("onboarding_id", connection.onboarding_id).eq("sync_type", syncType).single();
        if (prior?.status === "accepted") continue;
        throw new Error("Já existe uma tentativa sem confirmação para esta sincronização. Verifique na Meta antes de repetir; a operação é permitida apenas uma vez por cadastro.");
      }
      try {
        const payload = await metaRequest(`${phoneNumberId}/smb_app_data`, token, { messaging_product: "whatsapp", sync_type: syncType });
        const result = z.object({ request_id: z.string().min(1) }).safeParse(payload);
        if (!result.success) throw new MetaRequestError(undefined, true);
        const { error } = await admin.from("whatsapp_sync_requests").update({ status: "accepted", request_id: result.data.request_id }).eq("connection_id", connectionId).eq("onboarding_id", connection.onboarding_id).eq("sync_type", syncType);
        if (error) throw new Error("Solicitação aceita pela Meta, mas o registro local falhou. Não repita sem verificar.");
      } catch (error) {
        await admin.from("whatsapp_sync_requests").update({ status: error instanceof MetaRequestError && !error.uncertain ? "failed" : "unknown", error_code: error instanceof MetaRequestError ? error.code : null }).eq("connection_id", connectionId).eq("onboarding_id", connection.onboarding_id).eq("sync_type", syncType);
        throw error;
      }
    }
    return NextResponse.json({ accepted: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar a sincronização." }, { status: 502 }); }
}
