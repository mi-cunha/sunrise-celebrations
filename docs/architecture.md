# Arquitetura inicial

O Sunrise OS é um Next.js App Router com TypeScript estrito e Tailwind. O Supabase fornece Auth e PostgreSQL; o navegador usa apenas a chave pública. Server Components/Actions fazem leitura e escrita, validam a entrada em Zod e conferem a permissão antes da operação.

O banco é a fronteira de segurança: RLS exige usuário ativo para leitura operacional e `atendimento` ou `admin_owner` para criar/alterar leads. A função `has_permission` permite permissões acumulativas e considera `admin_owner` um privilégio superior. O trigger de criação grava o histórico no banco, evitando que a UI decida se audita ou não.

`create_lead_with_event` é uma função RPC transacional: lead, evento potencial e a entrada de histórico são persistidos juntos ou a escrita inteira é revertida.

As entidades implementadas até aqui são `profiles`, `user_permissions`, `leads`, `potential_events`, `lead_history`, `option_catalog`, `conversations` e `conversation_messages`. As conversas começam em `ia_triagem`, podem passar para `aguardando_humano`, e quando uma pessoa assume vão para `humano_assumiu` com `ai_paused = true`. Mensagens identificam autor como cliente, IA, humano ou sistema.

Antes de integrar o WhatsApp oficial, a aplicação valida o fluxo com `whatsapp_simulado` e Server Actions locais. A integração oficial entra posteriormente como adaptador seguro para webhooks/envio/templates, sem acoplar a UI a serviços externos. Ainda não há orçamento, contratos, pagamentos, API real do WhatsApp ou isolamento multiempresa. Todas as chaves usam UUID para manter uma futura chave de organização possível sem redesenhar identificadores.
