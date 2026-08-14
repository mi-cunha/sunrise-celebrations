import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { canManageLeads } from "@/lib/domain/lead";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createQuoteFromLead } from "@/app/orcamentos/actions";

type QuoteSummary = {
  id: string;
  title: string;
  status: string;
  total_amount_cents: number;
  created_at: string;
};

type LeadHistory = {
  id: string;
  action: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { id } = await params;
  const { supabase, permissions } = await requireUser();
  const canManage = canManageLeads(permissions);
  const { data: lead } = await supabase
    .from("leads")
    .select("*,potential_events(*),lead_history(*, profiles(display_name)),quotes(id,title,status,total_amount_cents,created_at)")
    .eq("id", id)
    .single();

  if (!lead) notFound();
  const quotes = ([...((lead.quotes ?? []) as QuoteSummary[])]).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const history = ([...((lead.lead_history ?? []) as LeadHistory[])]).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

  return (
    <AppShell title={lead.name}>
      <Link href="/painel" className="text-sm font-semibold text-[#356451] underline">
        ← Voltar ao painel
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <section className="space-y-6 md:col-span-2">
          <section className="rounded-xl border border-[#dbe3dc] bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">Contato e evento</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">Telefone</dt>
                    <dd>{lead.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Empresa</dt>
                    <dd>{lead.company ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Status</dt>
                    <dd className="capitalize">{lead.status.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Origem</dt>
                    <dd>{lead.source ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Evento</dt>
                    <dd>{lead.event_type ?? "Não informado"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Data desejada</dt>
                    <dd>{lead.desired_date ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Convidados</dt>
                    <dd>{lead.guest_count ?? "Não informado"}</dd>
                  </div>
                </dl>
              </div>
              {canManage && (
                <form action={createQuoteFromLead}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="returnTo" value={`/leads/${lead.id}`} />
                  <button className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                    Criar orçamento
                  </button>
                </form>
              )}
            </div>
            {lead.notes && <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-slate-700">{lead.notes}</p>}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dbe3dc] bg-white">
            <div className="border-b border-[#edf1ee] p-5">
              <h2 className="font-semibold">Orçamentos</h2>
            </div>
            {quotes.length ? (
              <ul>
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex flex-col gap-3 border-b border-[#edf1ee] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/orcamentos/${quote.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {quote.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {quoteStatusLabel(quote.status)} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(quote.created_at))}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm font-semibold text-[#356451]">{formatCurrencyFromCents(quote.total_amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8">
                <h3 className="font-semibold">Ainda não há orçamentos.</h3>
                <p className="mt-1 text-slate-600">Crie o primeiro orçamento quando o lead estiver qualificado.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="rounded-xl border border-[#dbe3dc] bg-white p-5">
          <h2 className="font-semibold">Histórico</h2>
          <ol className="mt-4 space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-[#e8a849] pl-3">
                <p className="text-sm font-medium">{entry.action}</p>
                <p className="text-xs text-slate-500">
                  {entry.profiles?.display_name ?? "Usuário"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at))}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}
