import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getReviewerSession } from "@/lib/meta-review-session";
import { reviewerConfig, reviewerOperationTicket } from "@/lib/meta-review-access";
import { getWhatsAppReviewStatus, reviewError, reviewHelloWorld, type WhatsAppReviewStatus } from "@/lib/whatsapp-review";
import { ReviewSendPanel } from "../admin/whatsapp-avaliacao/send-panel";
import { WhatsAppTemplatePanel } from "../admin/opcoes/whatsapp-template-panel";
import { ReviewerLoginForm } from "./login-form";
import { reviewerLogoutAction, reviewerSendAction, reviewerTemplateAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "Avaliação Meta | crm-sun", robots: { index: false, follow: false } };

export default async function ReviewerPage() {
  if (!reviewerConfig()) notFound();
  const session = await getReviewerSession();
  let status: WhatsAppReviewStatus | undefined;
  let error: string | undefined;
  if (session) {
    try { status = await getWhatsAppReviewStatus(); } catch (failure) { error = reviewError(failure); }
  }
  const hello = status && reviewHelloWorld(status.templates);
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">crm-sun · Avaliação da integração WhatsApp</h1>
    <p>Acesso exclusivo à demonstração com o número de teste oficial da Meta. Esta sessão não permite acessar o CRM, contatos, conversas, propostas ou dados de clientes.</p>
    {!session ? <ReviewerLoginForm /> : <>
      <form action={reviewerLogoutAction}><button className="underline">Sair da avaliação</button></form>
      <p className="rounded-lg bg-amber-50 p-4 text-sm">Envios manuais, sem chatbot ou disparos em massa. O número corporativo não é alterado. Limite: uma tentativa por função a cada hora, sem reenvio automático.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {status && <p>Remetente oficial de teste: {status.sender}. Destinatário autorizado pela equipe: +{status.recipient}.</p>}
      <ReviewSendPanel operationId={reviewerOperationTicket("send", session)} recipient={status?.recipient ?? ""} ready={Boolean(hello)} body={hello?.components?.find(c => c.type === "BODY")?.text} sendAction={reviewerSendAction} externalReviewer />
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">2. Criar e consultar modelo na Meta</h2>
        <WhatsAppTemplatePanel configured={Boolean(status)} templates={status?.templates ?? []} operationId={reviewerOperationTicket("template", session)} defaultName={`sunrise_confirmacao_${randomUUID().slice(0, 8)}`} createAction={reviewerTemplateAction} />
      </section>
      <section className="space-y-2 text-sm"><h2 className="font-semibold">Como testar</h2><p>1. Confirme o destinatário fixo e clique em Enviar mensagem de demonstração. O painel mostra o identificador retornado pela API oficial. O recebimento no aparelho está documentado no screencast anexado à análise.</p><p>2. Informe nome e conteúdo de um modelo de teste e clique em Criar modelo. Confira o identificador e o estado retornados pela Meta; PENDING significa aguardando aprovação, não falha na criação.</p><p>A autenticação deste painel usa uma credencial de avaliação própria. A conexão corporativa por Login do Facebook para Empresas e coexistência permanece em implantação, fora deste acesso restrito.</p></section>
    </>}
  </main>;
}
