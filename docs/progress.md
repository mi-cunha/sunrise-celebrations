# Progresso

- [x] Fase 1a: fundação, autenticação contratada, permissões, leads, evento potencial e histórico de criação.
- [x] Ajuste pós-fontes: campo opcional de empresa para leads corporativos e documentação das fontes analisadas.
- [x] Ajuste de cadastro: máscara/validação de telefone, preservação de campos após erro, origem/tipo de evento padronizados e tela admin de opções.
- [x] Fase 1b: atendimento com IA primeiro — modelo interno de conversas, mensagens e triagem; fila de atendimento; simulação local de WhatsApp; ação auditada de assumir atendimento e pausa da IA.
- [x] Fase 1b complementar: transferência entre atendentes, templates de resposta e métricas de fila.
- [x] Fase 1c operacional: edição de leads no atendimento, filtros, checklist de qualificação, histórico do lead no atendimento, gestão básica de usuários e métricas iniciais.
- [x] Fase 1c pendente de validação externa: recuperação de senha pós-configuração.
- [ ] Fase 1c evolução opcional: painel de acompanhamento comercial mais completo.
- [x] Fase 2: orçamentos. Modelo de orçamento, criação a partir do lead, catálogo editável de serviços, itens, edição/remoção de itens, total, status, histórico, aprovação/recusa com motivo, trava pós-aprovação com liberação admin, proposta visual para impressão/PDF, logo configurável por arquivo e condições padronizadas de proposta.
- [ ] Fase 3: contratação e operação. Iniciada: evento contratado criado a partir de orçamento aprovado, listagem de eventos, página de detalhe, status operacional, histórico, contrato e pagamentos com acesso financeiro, checklist operacional editável/reordenável com responsável, prazo e observações, cronograma operacional editável, fornecedores do evento, ficha operacional interna gerável, catálogo inicial de pacotes por tipo de evento e pacote conectado ao orçamento, proposta e ficha operacional.
- [ ] Fase 3a: contratos e termos — sugestão de contrato completo, contrato simplificado ou termo de consentimento; rascunhos versionados, revisão humana obrigatória, emissão final e consulta de versões implementados. Pendente: templates configuráveis e sincronização completa dos estados enviado/assinado/cancelado com a versão emitida.
- [ ] Fase 3b: financeiro e custos — recebimentos, parcelas, custos internos, comissões, margens e indicadores, protegidos pelas permissões `financeiro`, `gerencia` e `admin_owner`.
- [ ] Fase 3c: hospitalidade e materiais — cortesias e materiais impressos planejados, com responsáveis, status, visibilidade e custo estimado integrado ao financeiro.
- [ ] Fase 4: WhatsApp oficial como adaptador — webhooks, envio, templates aprovados e observabilidade, após a validação da Fase 1b.
- [ ] Fase 5: multiempresa e comercialização.

## Critério para iniciar Fase 3

A Fase 3 pode iniciar quando:

1. As migrations até `202608130006_quote_decisions_edit_unlock.sql` estiverem aplicadas.
2. O fluxo lead → orçamento → proposta → aprovação estiver validado.
3. A edição pós-aprovação estiver protegida e liberável por admin quando necessário.

## Próximos critérios da Fase 3

Para avançar na fase de contratação/operação:

1. Aplicar as migrations até `202608140017_event_contract_payments.sql`.
2. Validar a criação de evento a partir de orçamento aprovado.
3. Validar status operacional e checklist editável do evento contratado.
4. Preservar os fluxos existentes de contatos, orçamentos e eventos durante a inclusão dos módulos da Fase 3a–3c.

## Próximas fatias da Fase 3

1. **Fase 3a — Contratos e termos:** modelar documentos e versões; implementar regras configuráveis que sugerem `contrato_completo`, `termo_simplificado` ou `aceite_proposta`; incluir revisão humana obrigatória antes do envio e geração de PDF.
2. **Fase 3b — Financeiro e custos:** separar valores cobrados, recebidos, custos internos, cortesias e comissão; calcular receita, custo, margem e lucro estimados; aplicar acesso financeiro no servidor e RLS.
3. **Fase 3c — Hospitalidade e materiais:** registrar cortesias, recepção, mesa, pós-evento e materiais simples; exigir custo estimado, responsável e status; refletir custos no financeiro e itens no checklist.

O detalhamento completo do adendo está em `docs/addenda/contratos-financeiro-hospitalidade.md`.

## Pendências futuras registradas

- Definir política de retenção documental: preservar versões emitidas/assinadas e avaliar arquivamento ou exclusão apenas de rascunhos antigos após prazo administrativo definido; não apagar automaticamente ao concluir o evento.
- Incluir imagens por pacote na proposta: as imagens devem ficar em um banco/catálogo próprio e entrar automaticamente na proposta conforme o pacote escolhido.
- Refinar a diagramação dos pacotes na proposta e na ficha operacional após testes com pacotes reais.
- Criar uma página de ajuda/manual de uso do sistema, com linguagem simples para qualquer usuário entender fluxos como lead, atendimento, orçamento, proposta, evento contratado, checklist e ficha operacional.
- Avaliar tutorial de primeiro acesso para novos usuários, com passos guiados dentro do sistema.
- Quando houver integração oficial com WhatsApp, enviar automaticamente no início da semana um resumo dos eventos da semana para o grupo da gerência.
