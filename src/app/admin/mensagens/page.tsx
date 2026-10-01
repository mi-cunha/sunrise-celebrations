import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { setManagementCommissionRecipient, updateCrmMessageTemplate } from "./actions";

type Template = { id: string; kind: string; channel: string; title: string; body: string; whatsapp_template_name: string | null; is_active: boolean };

export default async function CrmMessagesSettingsPage() {
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");
  const [{ data }, { data: people }, { data: settings }] = await Promise.all([
    supabase.from("crm_message_templates").select("id,kind,channel,title,body,whatsapp_template_name,is_active").order("sort_order"),
    supabase.rpc("get_active_operational_profiles"),
    supabase.from("company_settings").select("management_commission_recipient_id").eq("id", true).maybeSingle(),
  ]);
  const templates = (data ?? []) as Template[];
  return <AppShell title="Mensagens do CRM">
    <Link href="/admin/opcoes" className="text-sm font-semibold text-[#0f5f8f] underline">← Configurações</Link>
    <p className="mt-3 max-w-3xl text-sm text-slate-600">Edite a prévia usada pela equipe. Para o WhatsApp iniciar uma conversa, informe também o nome técnico do template já aprovado na Meta. O CRM nunca envia texto livre fora da janela de 24 horas.</p>
    <form action={setManagementCommissionRecipient} className="mt-6 rounded-xl border border-[#dbe3dc] bg-white p-4"><h2 className="font-semibold">Comissão de gerência</h2><p className="mt-1 text-sm text-slate-600">Esta pessoa receberá a provisão automática de 2,5% a cada evento contratado.</p><div className="mt-3 flex flex-wrap gap-3"><select name="recipientId" defaultValue={settings?.management_commission_recipient_id ?? ""}><option value="">Definir depois</option>{(people ?? []).map((person: { id: string; display_name: string | null }) => <option key={person.id} value={person.id}>{person.display_name ?? "Usuário"}</option>)}</select><button className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white">Salvar responsável</button></div></form>
    <div className="mt-6 space-y-4">{templates.map((template) => <form key={template.id} action={updateCrmMessageTemplate} className="rounded-xl border border-[#dbe3dc] bg-white p-4"><input type="hidden" name="id" value={template.id} /><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{label(template.kind)} · {template.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</h2><label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={template.is_active} /> Ativa</label></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label>Título<input name="title" defaultValue={template.title} required /></label>{template.channel === "whatsapp" && <label>Nome técnico aprovado na Meta<input name="templateName" defaultValue={template.whatsapp_template_name ?? ""} placeholder="ex.: sunrise_primeiro_contato" /></label>}</div><label className="mt-3 block">Texto de prévia<textarea name="body" rows={3} defaultValue={template.body} required /></label><button className="mt-3 rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white">Salvar modelo</button></form>)}</div>
  </AppShell>;
}
function label(kind: string) { return ({ primeiro_contato: "Primeiro contato", retorno_cadastro: "Retorno após cadastro", convite_visita: "Convite para visita", retorno_orcamento: "Retorno sobre orçamento", proposta_whatsapp: "Envio de proposta", contrato_whatsapp: "Envio de contrato", proposta_email: "Proposta por e-mail", contrato_email: "Contrato por e-mail" } as Record<string, string>)[kind] ?? kind; }
