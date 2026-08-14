# Adendo ao prompt mestre: atendimento com IA primeiro e WhatsApp oficial

Este adendo foi incorporado ao `PROMPT-MESTRE-CODEX-SUNRISE.md` e é mantido separadamente como referência de decisão.

## Decisão de produto

Todo novo lead de WhatsApp começa com a IA conduzindo o atendimento: ela responde, qualifica, coleta contexto e prepara um resumo. A equipe vê o lead e um humano autorizado pode assumir; então, a IA para de responder automaticamente. O fluxo é:

`Mensagem recebida -> IA atende e qualifica -> fila aguardando humano -> humano assume -> orçamento, contrato e acompanhamento`

A IA pode coletar tipo de evento, data/período, convidados, formato e observações. Ela não promete disponibilidade, valores, descontos, contratos, pagamentos, cancelamentos ou reagendamentos; nem pede dados bancários sensíveis ou inventa condições. Dúvidas e solicitações comerciais são encaminhadas a humano.

## Propriedade do atendimento

O dono operacional da conversa é independente do responsável comercial pelo lead. Use `owner_type`/`atendimento_owner_type` com os estados `ai`, `human`, `paused_ai` e `closed`.

Mantenha, conforme o desenho final do domínio, `ai_status`, `ai_summary`, `ai_collected_fields`, `ai_confidence`, `needs_human`, dados e horário da assunção, responsável humano e horários das últimas mensagens do cliente, IA e humano.

## Assumir atendimento

Somente usuários com `atendimento`, `gerencia` ou `admin_owner` podem assumir. A ação deve:

- trocar o dono para `human`;
- registrar usuário e horário da assunção;
- atribuir o lead ao usuário atual, exceto se a gerência definir outro responsável;
- pausar a IA naquela conversa;
- criar entrada de histórico com o estado anterior.

Conversas já assumidas exigem transferência explícita. `gerencia` e `admin_owner` podem transferir; no MVP, `atendimento` não transfere.

## Encaminhamento para humano

Defina `needs_human = true` para pedido de valor, orçamento, proposta, disponibilidade, visita, prova, reunião, ligação, contrato, sinal, multa, cancelamento, reagendamento, nota fiscal, desconto, condição especial, urgência, insatisfação ou baixa confiança da IA. Encaminhe também após coletar o mínimo: contato, telefone, tipo de evento, data/período, convidados, observações, resumo e próximo passo sugerido.

## Domínio e integração

Prepare `conversations`, `messages` e `ai_triage`. Mensagens distinguem `customer`, `ai`, `human` e `system`; conversas iniciam no canal `whatsapp` e são vinculadas ao lead.

Antes da API oficial, crie os contratos `WhatsAppProvider`, `MessageWebhookHandler`, `ConversationService` e `AIInitialTriageService`, com implementação fake/local para desenvolvimento e testes. A API oficial entra depois do modelo interno, botão de assunção, permissões, simulação local e configuração segura de variáveis e webhooks. Segredos e tokens ficam somente em variáveis de ambiente.

## Primeira fatia atualizada e aceite

O primeiro fluxo é `login -> painel protegido -> lead manual ou WhatsApp simulado -> IA dona inicial -> resumo da triagem -> fila aguardando humano -> assumir atendimento -> histórico`.

Ele deve incluir fila de atendimento, simulação local, resumo mockado, ação de assunção, pausa da IA e testes para owner inicial `ai`, encaminhamento, autorização positiva/negativa e pausa após assunção.
