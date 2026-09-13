import Link from "next/link";
import { randomUUID } from "node:crypto";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppReviewStatus, reviewHelloWorld, reviewError, type WhatsAppReviewStatus } from "@/lib/whatsapp-review";
import { WhatsAppTemplatePanel } from "../opcoes/whatsapp-template-panel";
import { ReviewSendPanel } from "./send-panel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function WhatsAppReviewPage() {
  const { permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) return <AppShell title="Acesso restrito"><p>Apenas administradores podem executar a avaliação.</p></AppShell>;
  let status: WhatsAppReviewStatus | undefined;
  let error: string | undefined;
  try {
    const { error: schemaError } = await createAdminClient().from("whatsapp_review_operations").select("id").limit(0);
    if (schemaError) error = "Preparação pendente: aplicar a migração de registro das tentativas de avaliação.";
    else status = await getWhatsAppReviewStatus();
  } catch (failure) { error = reviewError(failure); }
  const hello = status && reviewHelloWorld(status.templates);
  return <AppShell title="Demonstração WhatsApp · análise da Meta">
    <div className="mt-4 max-w-4xl space-y-5">
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Ambiente de avaliação com número de teste oficial da Meta. Não altera a conexão corporativa e não cria leads, conversas de clientes ou respostas automáticas. A coexistência do corporativo é uma etapa separada.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {status && <div className="rounded-lg border border-[#d9ded8] bg-white p-4 text-sm"><p>Remetente de teste validado: {status.sender}</p><p>Destinatário autorizado: +{status.recipient}</p><p>Credencial: válida para este aplicativo{status.tokenExpiresAt ? ` · expira em ${new Date(status.tokenExpiresAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })} (Fortaleza)` : ""}.</p></div>}
      <ReviewSendPanel operationId={randomUUID()} recipient={status?.recipient ?? ""} ready={Boolean(hello)} body={hello?.components?.find(c => c.type === "BODY")?.text} />
      <section className="rounded-xl border border-[#d9ded8] bg-white p-5"><h2 className="mb-4 text-lg font-semibold">2. Criar e consultar modelo na Meta</h2><WhatsAppTemplatePanel configured={Boolean(status)} templates={status?.templates ?? []} operationId={randomUUID()} /></section>
      <section className="space-y-2 text-sm text-[#5f7180]"><h2 className="font-semibold text-[#092f38]">Roteiro da gravação</h2><p>Vídeo 1: mostre o remetente, o destinatário e a mensagem nesta tela; confirme e envie. Mostre a confirmação da API e abra o WhatsApp do destinatário para mostrar a mesma mensagem recebida.</p><p>Vídeo 2: mostre o nome e o texto do modelo, clique em Criar modelo e mostre o ID e o status retornados pela Meta. A criação não significa aprovação do modelo.</p><p>Não exiba tokens, senhas ou conversas de terceiros. Esta demonstração não garante a aprovação da análise do app.</p></section>
      <Link href="/admin/opcoes#whatsapp" className="text-sm font-semibold text-[#0f5f8f] underline">Voltar à conexão corporativa</Link>
    </div>
  </AppShell>;
}
