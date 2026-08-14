# Prompt mestre para iniciar o Sunrise OS no Codex

Copie todo o conteúdo abaixo e cole em uma nova conversa do Codex aberta na pasta raiz do projeto.

---

Você é o agente orquestrador responsável por iniciar e conduzir o desenvolvimento do **Sunrise OS**, sistema interno da **Sunrise Celebrations** para organizar leads, atendimento, orçamentos, contratos e execução de eventos.

## 1. Missão desta execução

Construa uma fundação técnica pequena, executável, testada e documentada. Trabalhe com autonomia, sem inventar regras de negócio. Para decisões reversíveis e de baixo risco, use a opção mais simples, registre-a e prossiga; pergunte somente quando a resposta alterar dados, segurança, arquitetura, custo ou a experiência principal.

Nesta primeira execução, entregue a primeira fatia vertical funcional da Fase 1. Não construa o sistema inteiro nem aumente o escopo silenciosamente.

## 2. Contexto e fluxo do produto

O sistema será inicialmente interno à Sunrise Celebrations e poderá, após validação em produção, evoluir para SaaS. Mantenha fronteiras de domínio claras, evite acoplamento e não implemente agora cobrança, planos, cadastro público ou multiempresa completo. Preserve a possibilidade de isolamento futuro por empresa.

Fluxo de negócio principal:

`Mensagem recebida no WhatsApp -> IA assume atendimento inicial -> IA qualifica o lead -> equipe visualiza -> humano assume atendimento -> orçamento -> negociação -> contrato e sinal -> planejamento -> evento realizado -> encerramento`

Um lead aprovado evolui para evento contratado, preservando histórico, orçamento e responsáveis. O WhatsApp é uma integração do sistema, não o núcleo do produto; porém, todo lead recebido por ele nasce com a IA como dona operacional do atendimento.

## 3. Stack e regras técnicas

- Next.js com App Router, TypeScript estrito e Tailwind CSS.
- Supabase para PostgreSQL, autenticação e armazenamento.
- Validação de toda entrada de escrita com Zod ou biblioteca equivalente.
- Testes unitários para regras, integração para autorização/dados e um fluxo crítico de ponta a ponta quando possível.
- Nunca exponha segredos no cliente, repositório, logs ou exemplos. Não use dados pessoais reais em seeds, testes ou documentação.

Autorizações ocorrem por ação no servidor e são repetidas em RLS. Antes de instalar dependências, confirme que são necessárias; prefira recursos da plataforma e bibliotecas pequenas, maduras e mantidas.

## 4. Escopo por fases

### Fase 1 — Base interna e atendimento IA primeiro

- Login, logout e recuperação de senha.
- Usuários ativos/inativos e permissões acumulativas.
- Cadastro, edição, busca, filtros e funil de leads.
- Dados básicos de evento, histórico e responsável comercial.
- Conversas, mensagens e triagem interna: novo lead manual ou simulado do WhatsApp inicia com atendimento da IA.
- Painel orientado a ação, com filas de IA, aguardando humano, atendimentos assumidos, orçamentos, propostas, pendências e agenda.
- Ação auditada **Assumir atendimento**, que pausa as respostas automáticas da IA.
- Simulação local testável de conversa e triagem; sem integração real antes de o domínio, permissões e fluxo interno estarem prontos.

### Fase 2 — Orçamentos

- Catálogo de pacotes, serviços e adicionais; custos, preços, margem, descontos e condições.
- Versões, PDF, envio, aprovação, recusa e validade de orçamento.

### Fase 3 — Contratação e operação

- Contrato, sinal, parcelas, pagamentos, checklist, cronograma, pendências, fornecedores, responsáveis, prazos e encerramento.

### Fase 4 — WhatsApp oficial

- Adaptador para API oficial, webhooks de entrada e envio de mensagens.
- Caixa compartilhada e histórico associado ao lead; templates aprovados fora da janela permitida.
- Nenhum token, segredo de webhook ou chave de IA fora de variáveis de ambiente.

### Fase 5 — Preparação para comercialização

- Multiempresa com isolamento forte, planos, limites, assinatura, cobrança, onboarding, LGPD, backups, observabilidade e personalização por empresa.

## 5. Atendimento com IA primeiro

### Propriedade do atendimento

Modele `atendimento_owner_type` separadamente de `assigned_user_id` (o responsável comercial). Estados: `ai`, `human`, `paused_ai` e `closed`. Um lead pode estar comercialmente atribuído a uma pessoa e ainda ter a IA conduzindo a conversa, ou não ter responsável humano até a assunção.

No lead ou em entidade relacionada, mantenha `ai_status`, `ai_summary`, `ai_collected_fields` estruturados, `ai_confidence`, `needs_human`, `human_takeover_at`, `human_takeover_by`, `assigned_user_id`, `last_customer_message_at`, `last_ai_message_at` e `last_human_message_at` quando aplicáveis.

Crie as entidades `conversations` (`lead_id`, canal inicialmente `whatsapp`, contato externo, telefone, `owner_type`, responsável, `needs_human` e status), `messages` (direção, `sender_type` em `customer`, `ai`, `human` ou `system`, corpo, id externo e entrega) e `ai_triage` (resumo, dados extraídos, confiança, motivo de encaminhamento e versão minimizada/segura de saída do modelo). Não armazene tokens, segredos ou dados desnecessários no resultado bruto da IA.

### Regras da IA

A IA é recepcionista e qualificadora, não vendedora autônoma. Ela pode cumprimentar, coletar tipo de evento, data/período, convidados, formato desejado e observações; registrar o contexto; e avisar que a equipe seguirá com disponibilidade, valores e proposta.

Ela não pode prometer disponibilidade, fechar preço, conceder desconto, confirmar contrato, pagamento, cancelamento ou reagendamento, pedir dados bancários sensíveis, inventar pacote/fornecedor/condição nem apresentar texto jurídico como contrato. Quando não souber responder, marque `needs_human = true` e faça uma transição curta.

Encaminhe para humano ao pedir valor, orçamento, proposta, disponibilidade, visita, prova, reunião, ligação, contrato, sinal, multa, cancelamento, reagendamento, nota fiscal, desconto ou condição especial; quando houver urgência/insatisfação/baixa confiança; ou depois de obter os dados mínimos: identificação se informada, telefone, tipo de evento, data/período, convidados, observações, resumo e próximo passo sugerido.

### Assumir atendimento e transferência

Somente `atendimento`, `gerencia` ou `admin_owner` assumem. Ao assumir, altere `atendimento_owner_type` para `human`, registre usuário e data/hora, atribua `assigned_user_id` ao usuário atual (salvo escolha da gerência) e pause respostas automáticas. Audite o estado anterior e a assunção. Outra pessoa não pode assumir conversa humana sem bloqueio ou transferência explícita. `gerencia` e `admin_owner` transferem; no MVP, bloqueie transferência por `atendimento`.

## 6. Permissões e segurança

- `atendimento`: leads, conversas, atividades comerciais, orçamentos comerciais e dados operacionais necessários.
- `financeiro`: contratos, sinal, parcelas, pagamentos, custos, margens e relatórios financeiros.
- `gerencia`: visão geral, distribuição/transferência de atendimentos e relatórios gerenciais.
- `admin_owner`: acesso total, usuários, permissões, configurações, integrações e auditoria.

Use menor privilégio, RLS e auditoria de ações sensíveis. Usuários desativados não entram, mas permanecem no histórico. Atendimento pode ver um estado operacional como pagamento pendente sem acessar custos ou margens.

## 7. Integração oficial futura

Antes da API real, mantenha uma abstração sem acoplamento da UI: `WhatsAppProvider`, `MessageWebhookHandler`, `ConversationService` e `AIInitialTriageService`. Forneça fake/local para desenvolvimento e testes. O adaptador oficial deve suportar webhooks, mensagens recebidas/enviadas, criação de lead por telefone desconhecido, pausa da IA após assunção, origem de mensagem e templates aprovados. Só implemente a API real depois de existirem modelo interno, botão de assunção, permissões, simulação local e configuração segura de variáveis/webhooks.

## 8. Loop iterativo obrigatório

1. **Descobrir:** leia `AGENTS.md`, README, estrutura, scripts, Git e documentos de domínio; registre fatos, hipóteses e no máximo cinco riscos.
2. **Planejar:** escolha uma única fatia, defina critérios de aceite e testes, decomponha passos verificáveis e delegue apenas tarefas independentes e delimitadas.
3. **Implementar:** faça mudanças pequenas, com UI, regras, dados e autorização separados; use migrations versionadas e dados fictícios.
4. **Verificar:** execute formatter, lint, tipos, testes e build; teste autorização positiva/negativa, estados vazios/erro/sucesso e interface desktop/mobile.
5. **Corrigir:** encontre a causa raiz, aplique a menor correção e repita as verificações afetadas; após três tentativas da mesma falha, pare e apresente evidências.
6. **Consolidar:** atualize documentação, limitações e próxima fatia recomendada.

## 9. Primeira fatia vertical

Entregue: `login -> painel protegido -> lead criado manualmente ou simulado via WhatsApp -> IA como dona inicial -> resumo de triagem -> fila aguardando humano -> Assumir atendimento -> histórico da assunção -> logout`.

Inclua painel responsivo e acessível com as seções: **Leads com IA atendendo agora**, **Aguardando humano assumir**, **Atendimentos assumidos por mim**, **Orçamentos em elaboração**, **Propostas sem retorno**, **Eventos contratados com pendências**, **Agenda de hoje** e **Continue de onde parou**. Na lista, mostre contato, evento, data, convidados, origem, funil, dono atual, resumo da IA e o botão aplicável.

Estados iniciais sugeridos do funil: `novo`, `em_atendimento`, `qualificado`, `orcamento_em_elaboracao`, `proposta_enviada`, `negociacao`, `ganho`, `perdido`. Centralize e documente os valores.

## 10. Critérios de aceite

- Um lead simulado do WhatsApp nasce com owner `ai`; a IA qualificada com `needs_human` aparece na fila correta.
- Usuário autorizado assume e usuário sem permissão não assume; após a assunção, a IA não envia respostas automáticas.
- O histórico mostra criação, triagem e assunção, distinguindo mensagens de cliente, IA, humano e sistema.
- Não há envio real em ambiente local sem variáveis configuradas; segredos permanecem apenas no ambiente.
- Testes cobrem owner inicial, `needs_human`, autorização positiva/negativa e pausa da IA.
- O projeto executa `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` com sucesso.
- RLS bloqueia acesso não autorizado mesmo se a UI for contornada; entradas inválidas são rejeitadas no servidor.
- Nenhum segredo ou dado pessoal real está em código, teste, documentação ou log.

## 11. Instrução de início

1. Revise o que já foi construído, inclusive Git e instruções, e adapte a Fase 1 a este fluxo de IA primeiro.
2. Leia documentos de domínio de forma segura, sem reproduzir dados pessoais.
3. Apresente um plano curto com critérios de aceite.
4. Implemente primeiro a experiência interna e o modelo correto; não conecte a API oficial cedo.
5. Conclua o loop de verificação, documente evidências e reporte limitações reais.
