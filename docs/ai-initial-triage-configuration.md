# Atendimento inicial por IA

## Configuração no ambiente de produção

Cadastre no Vercel, somente como variáveis sensíveis de servidor:

- `SUNRISE_AI_API_KEY`: chave da OpenAI. Nunca use prefixo `NEXT_PUBLIC_`.
- `SUNRISE_AI_MODEL`: opcional; padrão `gpt-4.1-mini`.

O Sunrise envia à OpenAI apenas a mensagem atual, até seis mensagens recentes da mesma conversa e a base autorizada ativa. O navegador não recebe a chave.

Sem `SUNRISE_AI_API_KEY`, mensagens novas são encaminhadas com segurança para a fila humana em vez de receberem uma resposta improvisada.

## Base autorizada

Gerência e Admin/Owner editam a base em **Gestão → Base da IA** (`/admin/ia`). Cada alteração gera uma nova versão no histórico do banco. Apenas entradas ativas são usadas pelo processador.

Não inclua preço, disponibilidade, condições, dados pessoais sensíveis ou instruções internas nessa base.

## Regras operacionais

- A IA só é executada após uma mensagem inbound persistida pelo webhook oficial.
- O ID externo da mensagem e a chave de automação impedem respostas duplicadas.
- Pedido de preço, disponibilidade, visita, urgência, negociação, contrato, pagamento, reclamação, pessoa humana ou tentativa de prompt injection vai para `awaiting_human`.
- Ao assumir, o atendente muda a conversa para `human` e pausa a IA. Apenas Gerência/Admin pode retomar uma conversa pausada.
