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
      <section className="mt-4 rounded-lg border border-[#c5d7e5] bg-[#f7fbff] p-4">
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#28608f]">Manual rápido</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#092f4f]">Como usar o Sunrise OS sem se perder</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Este guia explica o caminho principal do sistema em termos simples. Use como referência para treinar a equipe e padronizar o uso no dia a dia.
        </p>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <GuideCard
          title="1. Painel"
          description="Central de trabalho com contatos recentes, orçamentos, propostas, eventos e pendências."
          href="/painel"
          action="Abrir painel"
        />
        <GuideCard
          title="2. Contato"
          description="Pessoa ou empresa interessada. Aqui ficam nome, telefone, origem, evento, data, convidados e observações."
          href="/leads/novo"
          action="Cadastrar contato"
        />
        <GuideCard
          title="3. Orçamento e proposta"
          description="É onde a equipe monta valores, pacotes, itens extras e a proposta que será apresentada ao cliente."
          href="/crm"
          action="Abrir contatos e orçamentos"
        />
        <GuideCard
          title="4. Evento contratado"
          description="Quando o orçamento é aprovado, ele vira evento. A partir daí entram checklist, fornecedores, cronograma, contrato e pagamentos."
          href="/eventos"
          action="Ver eventos"
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <HelpSection title="Jornada do evento">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Cadastre o contato com os dados disponíveis.</li>
              <li>Complete dados faltantes antes de montar a proposta.</li>
              <li>Crie o orçamento, selecione o pacote e informe o valor por pessoa.</li>
              <li>Quando o pacote tiver escolhas, marque as opções definidas pelo cliente.</li>
              <li>Revise a proposta do cliente.</li>
              <li>Marque o orçamento como enviado.</li>
              <li>Quando houver retorno, registre aprovação ou recusa.</li>
              <li>Se aprovado, crie o evento contratado.</li>
              <li>No evento, acompanhe checklist, contrato, pagamentos, fornecedores, cronograma e ficha operacional.</li>
            </ol>
          </HelpSection>

          <HelpSection title="O que cada área significa">
            <Term title="Contato" text="Pessoa ou empresa interessada em realizar um evento." />
            <Term title="Orçamento" text="Área interna onde a proposta é montada." />
            <Term title="Proposta" text="Versão visual enviada ou apresentada ao cliente." />
            <Term title="Evento contratado" text="Registro operacional criado depois que o cliente aprova o orçamento." />
            <Term title="Ficha operacional" text="Documento interno para a equipe executar o evento. Não deve conter informação financeira sensível." />
          </HelpSection>
        </div>

        <div className="space-y-4">
          <HelpSection title="Quando usar cada status">
            <StatusRow label="Novo" description="Contato recém-cadastrado, ainda sem avanço comercial." />
            <StatusRow label="Em atendimento" description="A equipe já está falando com o interessado." />
            <StatusRow label="Orçamento em elaboração" description="Existe orçamento sendo montado." />
            <StatusRow label="Proposta enviada" description="A proposta já foi compartilhada e aguarda retorno." />
            <StatusRow label="Evento fechado" description="Proposta aprovada e pronta para virar evento contratado." />
            <StatusRow label="Não avançou" description="O contato recusou ou não seguirá com o evento." />
          </HelpSection>

          <HelpSection title="Pacotes, itens e fornecedores">
            <p>
              Cada pacote reúne valor por pessoa, itens inclusos e, se necessário, opções para o cliente escolher. Itens avulsos do orçamento servem para adicionais cobrados separadamente, como DJ ou decoração.
            </p>
            <p className="mt-2">
              Para montar ou alterar pacotes, abra Configurações → Pacotes. A biblioteca de itens reutilizáveis fica dentro dessa mesma área. Fornecedores são cadastrados dentro de cada evento contratado.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/admin/opcoes#pacotes" className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f7fbff]">
                Gerenciar pacotes
              </Link>
              <Link href="/eventos" className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f7fbff]">
                Ver eventos
              </Link>
            </div>
          </HelpSection>
        </div>
      </section>

      <section className="mt-5 space-y-4">
        <HelpSection title="Como montar um pacote" id="guia-pacotes">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Em <Link href="/admin/opcoes#pacotes" className="font-semibold underline">Configurações → Pacotes</Link>, abra “Criar pacote”. Informe nome, tipos de evento e valor por pessoa.</li>
            <li>Abra o pacote criado. Para algo exclusivo, use “Adicionar item exclusivo deste pacote”.</li>
            <li>Para usar o mesmo item em vários pacotes, crie uma subcategoria e um item na “Biblioteca de itens reutilizáveis”. Depois, volte ao pacote e abra “Itens reutilizáveis e escolhas”.</li>
            <li>Selecione a subcategoria e os itens. Com mínimo e máximo zero, todos entram como itens fixos. Para dar opções ao cliente, informe quantos ele pode escolher. Por exemplo, mínimo 2 e máximo 2 significa “escolha dois”.</li>
            <li>No orçamento, aplique o pacote e salve as escolhas do cliente. Confira a proposta antes de compartilhar. A ficha operacional usa os mesmos itens escolhidos.</li>
          </ol>
          <p className="mt-3 rounded-lg bg-[#f7fbff] p-3">Pacotes já cadastrados continuam disponíveis. Os itens antigos e os da biblioteca aparecem juntos no pacote e no orçamento.</p>
        </HelpSection>

        <HelpSection title="Configurações" id="configuracoes">
          <p>
            A área de configurações concentra os padrões usados pela equipe: tipos de evento, origens, pacotes, itens de orçamento, textos de proposta e logo. Usuários e acessos ficam em uma página própria.
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

        <HelpSection title="Boas práticas antes de usar com dados reais">
          <ul className="list-disc space-y-2 pl-5">
            <li>Padronize tipos de evento, origens e pacotes principais.</li>
            <li>Cadastre apenas usuários ativos da equipe.</li>
            <li>Teste o fluxo completo com um contato fictício antes de atender clientes reais.</li>
            <li>Depois dos testes, apague os dados fictícios para não misturar indicadores.</li>
          </ul>
        </HelpSection>

        <HelpSection title="Backlog combinado">
          <ul className="list-disc space-y-2 pl-5">
            <li>Resumo semanal para gestão.</li>
            <li>Insights com IA sobre contatos, orçamentos e eventos.</li>
            <li>Integração com WhatsApp.</li>
            <li>Envio automático de resumo semanal para o grupo da gerência.</li>
            <li>Imagens automáticas na proposta de acordo com o pacote escolhido.</li>
          </ul>
        </HelpSection>
      </section>
    </AppShell>
  );
}

function GuideCard({ action, description, href, title }: { action: string; description: string; href: string; title: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[#dbe3dc] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#c5d7e5] hover:">
      <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-4 inline-flex text-sm font-semibold text-[#28608f]">{action} →</span>
    </Link>
  );
}

function HelpSection({ children, id, title }: { children: React.ReactNode; id?: string; title: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-[#dbe3dc] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

function Term({ text, title }: { text: string; title: string }) {
  return (
    <p className="mt-2">
      <span className="font-semibold text-[#18352d]">{title}:</span> {text}
    </p>
  );
}

function StatusRow({ description, label }: { description: string; label: string }) {
  return (
    <div className="border-b border-[#edf1ee] py-3 last:border-0">
      <p className="font-semibold text-[#18352d]">{label}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}
