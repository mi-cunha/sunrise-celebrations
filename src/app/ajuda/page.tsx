import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function HelpPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  await requireUser();

  return (
    <AppShell title="Ajuda e guia de uso">
      <p className="mt-2 max-w-3xl text-slate-600">
        Um guia simples para a equipe entender o caminho principal do sistema. A ideia é crescer essa página aos poucos, junto com as dúvidas reais de uso.
      </p>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <GuideCard
          title="1. Comece pelo Painel"
          description="O Painel mostra o que precisa de atenção: atendimentos humanos, orçamentos em preparo, propostas aprovadas sem evento e pendências operacionais."
          href="/painel"
          action="Abrir painel"
        />
        <GuideCard
          title="2. Cadastre ou complete o lead"
          description="O lead reúne dados do contato, evento desejado, data, convidados e origem. Esses dados alimentam orçamento, proposta e evento."
          href="/leads/novo"
          action="Novo lead"
        />
        <GuideCard
          title="3. Monte o orçamento"
          description="Use pacotes padronizados e itens extras para criar uma proposta consistente. Quando aprovada, ela pode virar evento."
          href="/painel#orcamentos"
          action="Ver orçamentos"
        />
        <GuideCard
          title="4. Opere o evento"
          description="Depois de contratado, acompanhe checklist, cronograma, contrato, pagamentos e documentos operacionais dentro do evento."
          href="/eventos"
          action="Ver eventos"
        />
      </section>

      <section className="mt-8 space-y-4">
        <HelpSection title="Configurações" id="configuracoes">
          <p>
            A área de configurações concentra os padrões usados pela equipe: tipos de evento, origens, pacotes, itens de orçamento, textos de proposta e usuários.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/opcoes#opcoes" className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f7fbff]">
              Opções
            </Link>
            <Link href="/admin/opcoes#pacotes" className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f7fbff]">
              Pacotes
            </Link>
            <Link href="/admin/usuarios" className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f7fbff]">
              Usuários
            </Link>
          </div>
        </HelpSection>

        <HelpSection title="Fornecedores" id="fornecedores">
          <p>
            Por enquanto, fornecedores são cadastrados dentro de cada evento contratado. Isso ajuda a manter fornecedores, responsáveis e observações ligados ao evento certo.
          </p>
          <p className="mt-2">
            Mais adiante podemos criar um cadastro central de fornecedores, caso a equipe queira reaproveitar contatos recorrentes como decoração, buffet, DJ, bar, segurança e apoio operacional.
          </p>
        </HelpSection>

        <HelpSection title="Atendimentos">
          <p>
            A área de atendimentos ainda está em evolução e ficará oculta no menu principal enquanto o fluxo não estiver maduro. Por regra operacional, todo contato recebido pelo WhatsApp nasce com triagem da IA e pode ser assumido por humano quando necessário.
          </p>
        </HelpSection>

        <HelpSection title="Próximas melhorias planejadas">
          <ul className="list-disc space-y-2 pl-5">
            <li>Resumo semanal para gestão.</li>
            <li>Insights com IA sobre leads, orçamentos e eventos.</li>
            <li>Integração com WhatsApp.</li>
            <li>Imagens automáticas na proposta de acordo com o pacote escolhido.</li>
          </ul>
        </HelpSection>
      </section>
    </AppShell>
  );
}

function GuideCard({ action, description, href, title }: { action: string; description: string; href: string; title: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[#dbe3dc] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c5d7e5] hover:shadow-sm">
      <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-4 inline-flex text-sm font-semibold text-[#28608f]">{action} →</span>
    </Link>
  );
}

function HelpSection({ children, id, title }: { children: React.ReactNode; id?: string; title: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}
