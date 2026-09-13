import { createAdminClient } from "@/lib/supabase/admin";
import { connectionCredential, MetaRequestError } from "@/lib/whatsapp-meta";
import { sendWhatsAppText } from "@/lib/whatsapp";

// Call only after authenticating an active attendant and reading the conversation through RLS.
export async function sendHumanWhatsApp(input: { requestId: string; conversationId: string; actorId: string; body: string; phoneNumberId: string; to: string }) {
  await connectionCredential(input.phoneNumberId);
  const admin = createAdminClient();
  const { data: inbound, error: inboundError } = await admin.from("conversation_messages").select("external_created_at")
    .eq("conversation_id", input.conversationId).eq("direction", "inbound").eq("message_origin", "whatsapp_cloud").eq("is_history", false)
    .not("external_message_id", "is", null).order("external_created_at", { ascending: false }).limit(1).maybeSingle();
  const age = inbound?.external_created_at ? Date.now() - Date.parse(inbound.external_created_at) : Infinity;
  if (inboundError || age < 0 || age >= 24 * 3600_000) throw new Error("A resposta livre pela API exige uma mensagem nova do cliente nas últimas 24 horas. Histórico importado e mensagens do celular não abrem essa janela.");
  const { error: reservationError } = await admin.from("conversation_messages").insert({ id: input.requestId, conversation_id: input.conversationId, actor_id: input.actorId, author: "humano", body: input.body, direction: "outbound", message_origin: "sunrise", message_type: "text", delivery_status: "pending" });
  if (reservationError) {
    if (reservationError.code !== "23505") throw new Error("Não foi possível registrar a tentativa. Nada foi enviado.");
    const { data: prior } = await admin.from("conversation_messages").select("actor_id,conversation_id,body,external_message_id,delivery_status").eq("id", input.requestId).single();
    if (!prior || prior.actor_id !== input.actorId || prior.conversation_id !== input.conversationId || prior.body !== input.body) throw new Error("Identificador de envio já utilizado. Recarregue antes de iniciar outra resposta.");
    if (prior.external_message_id && ["sent", "delivered", "read"].includes(prior.delivery_status)) return;
    throw new Error("Esta tentativa já foi registrada e não será reenviada. Confira o celular e o status antes de iniciar uma nova resposta.");
  }
  let externalId: string;
  try { externalId = await sendWhatsAppText({ body: input.body, phoneNumberId: input.phoneNumberId, to: input.to }); }
  catch (error) {
    const definitelyRejected = error instanceof MetaRequestError && !error.uncertain;
    await admin.from("conversation_messages").update({ delivery_status: definitelyRejected ? "failed" : "unknown", failure_reason: definitelyRejected ? "meta_rejected" : "confirmation_missing", ...(definitelyRejected ? { failed_at: new Date().toISOString() } : {}) }).eq("id", input.requestId);
    throw new Error(definitelyRejected ? error.message : "Envio sem confirmação. A mensagem pode ter sido enviada; confira o celular antes de iniciar outra tentativa.");
  }
  const { error: saveError } = await admin.from("conversation_messages").update({ external_message_id: externalId, delivery_status: "sent", sent_at: new Date().toISOString() }).eq("id", input.requestId);
  if (saveError) throw new Error("A Meta aceitou a mensagem, mas o CRM não conseguiu salvar a confirmação. Não reenvie; confira o celular.");
  const { error: statusError } = await admin.rpc("apply_whatsapp_status", { p_id: externalId, p_phone: input.phoneNumberId, p_status: "sent", p_at: new Date().toISOString() });
  if (statusError) throw new Error("Mensagem aceita pela Meta. O status de entrega ainda precisa ser reconciliado; não reenvie.");
}
