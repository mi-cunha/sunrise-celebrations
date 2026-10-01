# Configuração de entregas do CRM

## WhatsApp oficial

O envio iniciado pelo CRM usa somente mensagens-modelo aprovadas quando não existe uma mensagem do cliente nas últimas 24 horas. Para cada modelo em **Gestão > Mensagens CRM**, preencha o nome técnico aprovado na Meta. A conexão oficial já continua usando as variáveis existentes:

- `NEXT_PUBLIC_META_APP_ID`
- `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_ALLOWED_WABA_ID`
- `WHATSAPP_ALLOWED_PHONE_NUMBER_ID`

## E-mail de proposta e contrato

O projeto ainda não possui um serviço de e-mail ou um gerador de arquivos PDF no servidor. Antes de ativar o envio de documentos, configure um provedor transacional e uma origem de PDF público ou armazenamento privado com URL assinada. As variáveis esperadas para a próxima camada são:

- `SUNRISE_EMAIL_PROVIDER` (por exemplo, `resend`)
- `SUNRISE_EMAIL_API_KEY`
- `SUNRISE_EMAIL_FROM`
- `SUNRISE_DOCUMENTS_ORIGIN`

Nunca inclua essas variáveis no código, no repositório ou em variáveis públicas do navegador.
