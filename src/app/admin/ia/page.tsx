import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { canManageAiConversation } from "@/lib/domain/conversation";
import { saveAiKnowledge } from "./actions";

type Knowledge = { id: string; category: string; title: string; body: string; is_active: boolean; version: number; updated_at: string };

export default async function AiKnowledgePage() {
  const { supabase, permissions } = await requireUser();
  if (!canManageAiConversation(permissions)) redirect("/painel?error=forbidden");
  const { data } = await supabase.from("ai_knowledge_entries").select("id,category,title,body,is_active,version,updated_at").order("category").order("title");
  const entries = (data ?? []) as Knowledge[];
  return <AppShell title="Base da IA"><p className="mt-2 max-w-3xl text-sm text-slate-600">Somente conteúdo ativo nesta página pode ser usado pela assistente virtual. Nunca cadastre preço, disponibilidade, condições ou instruções internas.</p><section className="mt-6 space-y-4">{entries.map((entry) => <KnowledgeForm key={entry.id} entry={entry} />)}<KnowledgeForm /></section></AppShell>;
}

function KnowledgeForm({ entry }: { entry?: Knowledge }) {
  return <form action={saveAiKnowledge} className="rounded-xl border border-[#dbe3dc] bg-white p-5"><input type="hidden" name="id" value={entry?.id ?? ""} /><div className="grid gap-4 md:grid-cols-2"><label>Categoria<select name="category" defaultValue={entry?.category ?? "faq"}>{[["apresentacao", "Apresentação"], ["institucional", "Institucional"], ["faq", "Perguntas frequentes"], ["mini_wedding", "Mini Wedding"], ["transicao_humano", "Transição para humano"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Título<input name="title" required defaultValue={entry?.title ?? ""} /></label></div><label className="mt-4 block">Conteúdo autorizado<textarea name="body" required rows={4} defaultValue={entry?.body ?? ""} /></label><div className="mt-4 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input className="w-auto" type="checkbox" name="active" defaultChecked={entry?.is_active ?? true} /> Ativo</label>{entry && <span className="text-xs text-slate-500">Versão {entry.version}</span>}<button className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white">{entry ? "Salvar" : "Adicionar conteúdo"}</button></div></form>;
}
