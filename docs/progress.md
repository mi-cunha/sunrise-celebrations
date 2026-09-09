# Progresso

- [x] Fase 1a: fundação, autenticação contratada, permissões, leads, evento potencial e histórico de criação.
- [x] Ajuste pós-fontes: campo opcional de empresa para leads corporativos e documentação das fontes analisadas.
- [x] Ajuste de cadastro: máscara/validação de telefone, preservação de campos após erro, origem/tipo de evento padronizados e tela admin de opções.
- [x] Fase 1b: atendimento com IA primeiro — modelo interno de conversas, mensagens e triagem; fila de atendimento; simulação local de WhatsApp; ação auditada de assumir atendimento e pausa da IA.
- [x] Fase 1b complementar: transferência entre atendentes, templates de resposta e métricas de fila.
- [x] Fase 1c operacional: edição de leads no atendimento, filtros, checklist de qualificação, histórico do lead no atendimento, gestão básica de usuários e métricas iniciais.
- [x] Fase 1c pendente de validação externa: recuperação de senha pós-configuração.
- [ ] Fase 1c evolução opcional: painel de acompanhamento comercial mais completo.
- [x] CRM comercial inicial: área segregada do financeiro, busca, filtros, indicadores e jornada por etapas com contato, responsável e orçamento mais recente.
- [x] Fase 2: orçamentos. Modelo de orçamento, criação a partir do lead, catálogo editável de serviços, itens, edição/remoção de itens, total, status, histórico, aprovação/recusa com motivo, trava pós-aprovação com liberação admin, proposta visual para impressão/PDF, logo configurável por arquivo e condições padronizadas de proposta.
- [ ] Fase 3: contratação e operação. Iniciada: evento contratado criado a partir de orçamento aprovado, listagem de eventos, página de detalhe, status operacional, histórico, contrato e pagamentos com acesso financeiro, checklist operacional editável/reordenável com responsável, prazo e observações, cronograma operacional editável, fornecedores do evento, ficha operacional interna gerável, catálogo inicial de pacotes por tipo de evento e pacote conectado ao orçamento, proposta e ficha operacional.
- [ ] Fase 3a: contratos e termos — sugestão de contrato completo, contrato simplificado ou termo de consentimento; rascunhos versionados, revisão humana obrigatória, emissão final e consulta de versões implementados. Pendente: templates configuráveis e sincronização completa dos estados enviado/assinado/cancelado com a versão emitida.
- [ ] Fase 3b: financeiro e custos — recebimentos, parcelas, custos internos, comissões, margens e indicadores, protegidos pelas permissões `financeiro`, `gerencia` e `admin_owner`.
- [x] Fase 3c: hospitalidade e materiais — cortesias e materiais impressos planejados, com responsáveis, status, visibilidade e custo estimado integrado ao financeiro.
- [x] Agenda operacional inicial: calendário mensal com eventos ativos, datas internas editáveis, feriados nacionais automáticos, feriados do Ceará/Fortaleza e confirmação de conflito na aprovação do orçamento, com limite de três eventos ativos por dia.
- [ ] Fase 4: WhatsApp oficial como adaptador — fundação implementada com webhook assinado, entrada idempotente e envio de texto humano. Pendente: configuração/validação na Meta, mensagens não textuais, templates aprovados e observabilidade operacional.
- [ ] Fase 4a: CRM operacional conectado ao WhatsApp — concluir associação de mensagens à conversa/lead/timeline e validar o fluxo de atendimento sem acoplamento da API da Meta às regras comerciais.
- [ ] Fase 4b: acompanhamento comercial manual — próxima ação, data, responsável e fila de follow-up vencido. Implementação local concluída; pendente aplicar a migration `202608310001_lead_manual_follow_up.sql` e validar no Supabase. Segue em paralelo à integração do WhatsApp, sem automação, scoring ou IA.
- [ ] Preparação estrutural do CRM: campos opcionais de interesse de pacote/faixa de orçamento/último contato, agrupamento conceitual do funil e vocabulário mínimo de eventos internos; sem event bus ou motor de automação.
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

## Ordem de execução aprovada

1. Manter a integração oficial do WhatsApp em andamento.
2. Em paralelo, iniciar a Fase 4b com próxima ação manual, responsável e fila de follow-up vencido.
3. Depois, implementar a preparação estrutural do CRM: campos opcionais, `last_contact_at`, índices e vocabulário de eventos internos.
4. Por fim, entregar a timeline consolidada e os agrupamentos conceituais do funil.

As etapas 3 e 4 não dependem do go-live do WhatsApp; apenas devem consumir mensagens por meio da camada de conversa quando ela estiver disponível.

- [BACKLOG] Follow-ups automáticos, nutrição de leads, agenda comercial, scoring determinístico, automações da jornada operacional, pós-evento e comunicação recorrente. Os detalhes e limites estão em `docs/addenda/crm-evolucao-comercial.md`.
- [IA FUTURA] Next Best Action, análise de conversão/perdas, previsão e inteligência comercial: somente após dados estruturados suficientes, transparência, controle humano e revisão de privacidade.

- [ ] **Conformidade LGPD e segurança antes da ativação do WhatsApp oficial:** nomear encarregado/canal de privacidade, mapear o tratamento de dados de leads, conversas e classificações por IA (finalidades, bases legais, operadores, compartilhamentos, retenção e controles), e submeter o desenho à validação jurídica. A avaliação deve cobrir a necessidade de relatório de impacto à proteção de dados (RIPD) e as hipóteses de decisões automatizadas.
- [ ] **Política de Privacidade pública e acessível sem login:** publicar uma rota estável fora da autenticação, com URL final configurada na Meta, descrevendo responsável/controlador e contato, dados tratados no atendimento por WhatsApp, finalidades, bases legais, uso de IA, compartilhamentos/operadores, retenção, medidas de segurança e direitos do titular. Validar o acesso anônimo em ambiente de produção e manter controle de versão/publicação do texto aprovado.
- [ ] **Transparência e controle no atendimento automatizado:** informar no primeiro contato que o atendimento inicial usa IA e como falar com uma pessoa; registrar a entrega desse aviso e o pedido de atendimento humano. Garantir que a assunção humana pause a IA — regra já existente — e oferecer canal para solicitar revisão humana de classificações ou encaminhamentos relevantes.
- [ ] **Minimização, retenção e descarte seguro:** definir por categoria os campos indispensáveis, prazos de retenção, gatilhos de anonimização ou exclusão, exceções legais/contratuais e procedimento auditável de descarte. Implementar jobs e testes somente após aprovação desses prazos; não eliminar versões contratuais emitidas/assinadas sem essa definição.
- [ ] **Atendimento aos direitos do titular:** criar procedimento e área administrativa autorizada para localizar, exportar, corrigir, anonimizar ou excluir dados, com verificação de identidade, registro de solicitações, prazos, decisões e exceções justificadas. Repetir as autorizações no servidor e em RLS.
- [ ] **Segurança e governança do fluxo WhatsApp/IA:** revisar RLS e permissões por menor privilégio, segredos e rotação, assinatura e idempotência do webhook, logs sem conteúdo sensível desnecessário, trilha de auditoria de acessos/alterações, monitoramento de incidentes e plano de resposta/comunicação. Executar testes de autorização positivos e negativos antes do go-live.
- [ ] **Conformidade da integração Meta/WhatsApp:** antes de habilitar produção, cadastrar a URL pública da Política de Privacidade no painel da Meta, revisar requisitos vigentes da plataforma e validar em produção o webhook, a política sem autenticação e os fluxos de opt-in/templates aplicáveis. Não ativar o atendimento oficial enquanto essa validação e a aprovação jurídica não estiverem registradas.
- Criar a permissão/perfil `direcao` e exigir aprovação da Direção na etapa de revisão humana antes da emissão final do contrato; até essa implementação, a revisão permanece restrita a `gerencia` e `admin_owner`.
- Definir política de retenção documental: preservar versões emitidas/assinadas e avaliar arquivamento ou exclusão apenas de rascunhos antigos após prazo administrativo definido; não apagar automaticamente ao concluir o evento.
- Adicionar insights de IA à agenda, incluindo feriado prolongado, concentração de eventos, semanas de alta demanda e risco operacional; os cálculos de calendário devem continuar determinísticos e a IA apenas explicar os resultados.
- Incluir imagens por pacote na proposta: as imagens devem ficar em um banco/catálogo próprio e entrar automaticamente na proposta conforme o pacote escolhido.
- Refinar a diagramação dos pacotes na proposta e na ficha operacional após testes com pacotes reais.
- Criar uma página de ajuda/manual de uso do sistema, com linguagem simples para qualquer usuário entender fluxos como lead, atendimento, orçamento, proposta, evento contratado, checklist e ficha operacional.
- Avaliar tutorial de primeiro acesso para novos usuários, com passos guiados dentro do sistema.
- Quando houver integração oficial com WhatsApp, enviar automaticamente no início da semana um resumo dos eventos da semana para o grupo da gerência.
- [BACKLOG WHATSAPP] Avaliar a API de Mensagens de Marketing para WhatsApp e a Conversions API for Business Messaging após o go-live do atendimento: incluir opt-in e descadastro, templates aprovados, limites de frequência, custos, eventos de conversão da jornada e mensuração de campanhas da Meta. Manter essa configuração separada do onboarding essencial do WhatsApp Cloud API para não bloquear o atendimento.
