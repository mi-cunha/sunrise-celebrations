# Demonstração para análise do app crm-sun

## Finalidade e limites

`/admin/whatsapp-avaliacao` demonstra mensagens reais e gerenciamento de modelos com o número de teste oficial da Meta. Não é uma conexão de coexistência, não conecta o corporativo e não valida sincronização de histórico. Não há IA, resposta automática ou gravação de contatos/mensagens de demonstração nas conversas dos clientes.

O cadastro corporativo permanece bloqueado pelo erro Meta 2655111 (Advanced Access de `whatsapp_business_messaging` e `whatsapp_business_management`). A demonstração serve como evidência para a análise; não garante aprovação.

## Preparação feita em 13/09/2026

- Branch: `validacao-coexistence`, mesmo projeto Vercel e Supabase Celebrations.
- Meta crm-sun: app `1966660290718855`; WABA de teste `915488050924122`; remetente Phone ID `1158464910693095`, final 5604, conferidos em “Etapa 1. Experimente”.
- Migração `202609130002_whatsapp_review_operations.sql` aplicada via SQL Editor no Supabase existente. Conferência: RLS ativo, authenticated sem SELECT/INSERT; 3 conversas e 8 mensagens originais preservadas. Não reaplicar essa migração.
- IDs do ambiente de teste configurados apenas no Preview da branch. Variáveis de Production preservadas.
- Ativação ainda depende de token válido gerado pelo usuário no crm-sun e destinatário pessoal autorizado. Nenhum envio real executado nesta preparação.
- Verificação: 59 testes passando, tipos/lint/build aprovados; preview com tela autenticada conferida visualmente e seis verificações HTTP de segurança aprovadas. Botões de escrita permanecem bloqueados enquanto faltarem as credenciais. A prova de entrega real e de criação do modelo ainda não foi executada.

## Configuração segura

As variáveis da branch Preview são `WHATSAPP_REVIEW_ENABLED=true`, `WHATSAPP_REVIEW_ACCESS_TOKEN`, `WHATSAPP_REVIEW_PHONE_NUMBER_ID`, `WHATSAPP_REVIEW_WABA_ID`, `WHATSAPP_REVIEW_RECIPIENT`. Recipient: país+DDD+número, somente dígitos. Token e destinatário são sensíveis, sem prefixo NEXT_PUBLIC e sem valores em arquivos versionados.

`scripts/configure-whatsapp-review-preview.mjs` recebe o diretório autorizado do Vercel CLI e JSON via stdin com `token` e `recipient`. Não colocar segredos nos argumentos do shell, histórico, saída de ferramentas ou documentação. Sem JSON, o script configura apenas os IDs de teste, sem ativar envios. Após configurar, redeploy e conferência explícita do alias estável são necessários.

A página exige administrador ativo; ações repetem autorização no servidor e recebem proteção Origin/Host de Server Actions. Antes de cada operação, o servidor confirma app/scopes/validade da credencial e propriedade do remetente de teste na WABA. Ativos corporativos são recusados. Não há `/register` nem alteração na tabela de conexões.

### Ativação e divergência de metadados

Após o usuário gerar a credencial e selecionar seu destinatário pessoal, token e destinatário foram configurados como segredos somente na branch Preview, com `WHATSAPP_REVIEW_ENABLED=true`. O usuário confirmou recebimento de uma mensagem enviada pelo teste da Meta; isso ainda não comprova envio pelo CRM. Não registrar o número pessoal nem o token neste documento.

Consulta somente leitura no Graph API Explorer v26.0 confirmou que o número de teste oficial listado em “Etapa 1. Experimente” retorna `account_mode=LIVE`. A validação aceita SANDBOX ou a combinação exata já verificada de app `1966660290718855`, WABA `915488050924122`, Phone ID `1158464910693095` e display de teste `15556735604`. Não autoriza outros remetentes LIVE. Alterar essa exceção exige nova verificação explícita dos ativos na Meta.

Envio limitado ao modelo `hello_world`, idioma `en_US`, previamente consultado como APPROVED, e exclusivamente ao destinatário configurado no servidor. O destinatário também precisa estar verificado na lista de teste da Meta. Se o modelo não existir, o envio fica bloqueado; conferir modelos disponíveis antes de adaptar o código, sem presumir aprovação.

Cada tentativa tem UUID e reserva durável no banco antes da chamada externa. Repetição do mesmo UUID é recusada. Falhas/timeout permanecem sem reenvio automático. Uma nova página permite uma nova tentativa explícita; conferir o WhatsApp antes de repeti-la. O registro armazena apenas ator, tipo, horário, estado e ID da Meta, nunca credencial ou texto/número do destinatário.

## Gravações pelo usuário

1. Abrir `/admin/whatsapp-avaliacao` logado como administrador. Confirmar o remetente de teste, seu próprio destinatário e credencial válida. Não gravar telas com tokens.
2. Vídeo de messaging: mostrar o conteúdo do modelo, marcar confirmação e clicar em “Enviar mensagem de demonstração” no Sunrise OS. Mostrar o ID aceito pela Meta e a mesma mensagem recebida no WhatsApp web ou celular do destinatário. HTTP aceito não é confirmação de entrega.
3. Vídeo de management: mostrar nome/texto previamente preenchidos; clicar em “Criar modelo”; mostrar ID retornado e lista/status da Meta. Criação e aprovação são estados diferentes. O modelo é real, criado somente na WABA de teste.
4. Conferir cada vídeo antes de enviar à análise do app. Não expor conversas de terceiros, senhas, tokens ou dados de clientes. Preenchimento de declarações/termos e submissão final ficam com o usuário.

Os webhooks do número de teste não entram no CRM corporativo devido à allowlist existente. A entrega nessa demonstração é verificada no WhatsApp do destinatário; o painel não inventa recibos de entrega. O callback corporativo continua apontando para o preview autorizado anteriormente.

Referência técnica: [coleção oficial da Meta — WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), que documenta consulta de remetentes SANDBOX. Instruções de vídeo verificadas diretamente no painel Tech Provider do app.
