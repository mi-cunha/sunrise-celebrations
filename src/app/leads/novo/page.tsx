import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";
import { SetupNotice } from "@/components/setup-notice";
import { requireLeadManager } from "@/lib/auth";
import { defaultEventTypes, defaultLeadSources } from "@/lib/domain/lead";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function NewLead() {
 if (!hasSupabaseConfig()) return <SetupNotice />;
 const { supabase, permissions } = await requireLeadManager();
 const isOwner = permissions.includes("admin_owner");
 const { data: people } = isOwner ? await supabase.from("profiles").select("id,display_name").eq("is_active", true).order("display_name") : { data: [] };
 const { data: options } = await supabase.from("option_catalog").select("kind,name").eq("is_active", true).order("sort_order").order("name");
 const eventTypes = options?.filter(option => option.kind === "event_type") ?? defaultEventTypes.map(name => ({ name }));
 const leadSources = options?.filter(option => option.kind === "lead_source") ?? defaultLeadSources.map(name => ({ name }));
 return <AppShell title="Novo lead"><p className="mt-2 max-w-2xl text-slate-600">Registre o contato e, se houver dados, o evento potencial será criado junto.</p><section className="mt-8 rounded-xl border border-[#dbe3dc] bg-white p-5 sm:p-7"><LeadForm canAssign={isOwner} people={people ?? []} eventTypes={eventTypes} leadSources={leadSources}/></section></AppShell>;
}
