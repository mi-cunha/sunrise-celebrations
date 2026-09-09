# Próximo passo a passo — CRM operacional e WhatsApp

## Resultado esperado

Concluir o atendimento integrado ao WhatsApp e tornar o CRM capaz de acompanhar manualmente cada lead, sem mudar ou regredir contatos, orçamentos e eventos. Contratos, custos e hospitalidade permanecem no plano da Fase 3; automações e IA continuam fora desta fatia.

## 1. Descobrir e fixar o recorte

1. Revisar o caminho atual WhatsApp → conversa → lead → históricos e as permissões/RLS envolvidas.
2. Confirmar quais campos comerciais já existem e quais campos opcionais faltam para acompanhamento manual.
3. Definir critérios de aceite para idempotência, vínculo correto de mensagens, próxima ação e autorização.
4. Preservar os fluxos de orçamento aprovado → evento contratado e os módulos da Fase 3 existentes.

## 2. Concluir a integração de atendimento pelo WhatsApp [MVP AGORA — em andamento]

1. Associar mensagens recebidas e enviadas à conversa e ao lead corretos.
2. Manter direção, origem, timestamps, ID externo e estado de entrega para auditoria e timeline.
3. Validar assinatura, idempotência, falhas de envio e separação do handler da Meta das regras de negócio do CRM.
4. Concluir configuração/validação na Meta antes do go-live; deixar mídia, templates e observabilidade avançada como próximas subfatias da integração.

## 3. Acompanhamento manual do CRM [MVP AGORA — iniciar em paralelo]

1. Adicionar próxima ação, data, responsável e fila de follow-up vencido, todos definidos manualmente.
2. Manter pacote de interesse e faixa de orçamento como campos opcionais.
3. Derivar/atualizar último contato a partir de interação relevante.
4. Consolidar uma timeline de leitura com mensagens, histórico, status, propostas e evento relacionado.
5. Aplicar validação, autorização no servidor e RLS às novas escritas e consultas.

Status local: a implementação foi concluída com a migration `202608310001_lead_manual_follow_up.sql`; aplicar a migration e validar manualmente no Supabase antes de considerar a fatia entregue.

## 4. Preparação barata para evolução [PREPARAR AGORA — após o acompanhamento manual]

1. Preservar status existentes e apresentar grupos derivados: ativo, acompanhamento/nutrição, perdido e convertido.
2. Documentar e centralizar nomes de eventos internos, sem fila ou barramento de eventos.
3. Preservar o vínculo existente Lead → Orçamento → Evento como a conversão oficial.
4. Registrar somente dados estruturados necessários para análises futuras, sem IA ou coleta excessiva.

## 5. Backlog explícito

1. [BACKLOG] Follow-ups automáticos, nutrição, agenda comercial, scoring e automações de evento/pós-evento.
2. [IA FUTURA] Recomendações de próxima ação, previsão e análise comercial, após dados e controles adequados.
3. Manter como referência o escopo da Fase 3 em `docs/addenda/contratos-financeiro-hospitalidade.md`.

## Sequência aprovada

1. O WhatsApp continua em implementação.
2. O acompanhamento manual do CRM começa em paralelo, sem depender do go-live da Meta.
3. Depois entram os campos estruturais, `last_contact_at`, índices e eventos internos mínimos.
4. Em seguida, a timeline consolidada e os agrupamentos de funil usam as fontes de dados já existentes, inclusive mensagens quando disponíveis.

## Fora do escopo deste passo

- Criar motor de automação, filas ou event bus antes de consumidores reais.
- Mudar todos os status de lead ou reestruturar o funil sem necessidade.
- Implementar scoring, recomendação ou análise por IA.
- Duplicar mensagens e históricos em uma nova fonte de verdade.
