# Arquitetura inicial

O Sunrise OS é um Next.js App Router com TypeScript estrito e Tailwind. O Supabase fornece Auth e PostgreSQL; o navegador usa apenas a chave pública. Server Components/Actions fazem leitura e escrita, validam a entrada em Zod e conferem a permissão antes da operação.

O banco é a fronteira de segurança: RLS exige usuário ativo para leitura operacional e `atendimento` ou `admin_owner` para criar/alterar leads. A função `has_permission` permite permissões acumulativas e considera `admin_owner` um privilégio superior. O trigger de criação grava o histórico no banco, evitando que a UI decida se audita ou não.

`create_lead_with_event` é uma função RPC transacional: lead, evento potencial e a entrada de histórico são persistidos juntos ou a escrita inteira é revertida.

As entidades implementadas até aqui incluem `profiles`, `user_permissions`, `leads`, `potential_events`, `lead_history`, `option_catalog`, `conversations`, `conversation_messages`, `quotes` e `contracted_events`, além das entidades operacionais de contrato, pagamentos, custos, hospitalidade, checklist, cronograma e fornecedores. As conversas começam em `ia_triagem`, podem passar para `aguardando_humano`, e quando uma pessoa assume vão para `humano_assumiu` com `ai_paused = true`. Mensagens identificam autor como cliente, IA, humano ou sistema.

O WhatsApp é uma fronteira de transporte: webhooks e envios alimentam `conversations` e `conversation_messages`, que se vinculam ao lead. A fundação oficial atual prevê conexão, entrada idempotente e envio de texto humano; a regra comercial não deve ser colocada no handler da Meta. A timeline comercial pode compor mensagens e históricos de domínio sem duplicá-los em uma nova fonte de verdade.

O funil preserva os status atuais e poderá expor grupos derivados (ativo, acompanhamento/nutrição, perdido e convertido). A conversão já é a relação `lead → quote → contracted_event`, criada transacionalmente na aprovação do orçamento. Próxima ação, último contato e dados opcionais de interesse/preço são preparação barata para o CRM operacional; eventos internos permanecem, por enquanto, vocabulário e registros transacionais, sem event bus.

O próximo desenho da Fase 3 estende o evento aprovado, sem substituir as entidades ou fluxos atuais: contratos/termos versionados e revisáveis; financeiro separado entre cobrança, recebimento, custo, cortesia e margem; e hospitalidade com itens planejados e custos rastreáveis. O acesso financeiro permanece restrito no servidor e em RLS a `financeiro`, `gerencia` e `admin_owner`. Modelagem e implementação desses módulos ainda são pendentes; requisitos, limites e critérios de aceite constam em `docs/addenda/contratos-financeiro-hospitalidade.md`.

A automação de follow-up, nutrição, agenda comercial, scoring e inteligência com IA não pertencem ao MVP atual. O roteiro e as fronteiras estão em `docs/addenda/crm-evolucao-comercial.md`. Ainda não há isolamento multiempresa. Todas as chaves usam UUID para manter uma futura chave de organização possível sem redesenhar identificadores.
