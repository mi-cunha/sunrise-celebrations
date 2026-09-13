import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// A failed/uncertain operation is never automatically retried with the same ID.
export async function runReviewOperation(id: string, actorId: string, kind: "send" | "template", operation: () => Promise<string>) {
  z.uuid().parse(id);
  z.uuid().parse(actorId);
  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_review_operations").insert({ id, actor_id: actorId, kind });
  if (error) return { error: error.code === "23505" ? "Esta tentativa já foi registrada. Confira o resultado anterior e o WhatsApp; nenhum reenvio foi feito." : "Não foi possível registrar a tentativa. Confira a migração de avaliação; nada foi enviado." };
  let metaId: string;
  try { metaId = await operation(); }
  catch (error) {
    await admin.from("whatsapp_review_operations").update({ status: "unconfirmed" }).eq("id", id);
    throw error;
  }
  const saved = await admin.from("whatsapp_review_operations").update({ status: "accepted", meta_id: metaId }).eq("id", id);
  return { metaId, warning: saved.error ? "A Meta aceitou, mas o registro local não foi atualizado. Não repita o envio." : undefined };
}
