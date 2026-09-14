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

## Acesso externo restrito — 14/09/2026

`/avaliacao-meta` é uma entrada separada para o avaliador. Não cria usuário Supabase nem concede permissões no CRM. A página não carrega o AppShell nem consulta contatos/conversas; usa apenas as funções existentes de demonstração na WABA de teste e o registro durável de tentativas. O destinatário autorizado é fixo no servidor, não selecionável pelo avaliador.

O acesso exige `VERCEL_ENV=preview`, `META_REVIEWER_ENABLED=true`, hash SHA-256 de senha aleatória de 256 bits, chave HMAC separada, prazo futuro e o ator técnico existente. O script `scripts/configure-meta-reviewer-preview.mjs` configura somente a branch `validacao-coexistence` no projeto atual e gera um arquivo temporário privado (0600) para recuperação. Nunca versionar esse arquivo nem copiar a chave de assinatura para a Meta.

Sessão assinada de até uma hora, cookie Secure/HttpOnly/SameSite=Strict e path `/avaliacao-meta`. Expiração configurada ou rotação da senha invalida sessões. Cada ação revalida sessão e ticket assinado, vinculado à sessão e ao tipo da operação. Há uma tentativa por função em cada janela de hora do relógio, compartilhada entre novos logins e instâncias pela chave primária já existente. O ticket expira no fim dessa janela; recarregar a página gera o ticket atual. Falha de credencial da Meta é verificada antes de reservar a tentativa. Falhas após envio externo não geram reenvio automático.

As ações administrativas continuam exigindo login e permissão de administrador. O cookie de avaliação não autentica qualquer rota do CRM. Production falha fechado, mesmo se alguém copiar variáveis de avaliação para ela. Não há alteração de RLS, migração nova, registro do número corporativo ou respostas automáticas.

O acesso da Vercel é uma camada separada: usar apenas link compartilhável autorizado para o preview, não o segredo de bypass de automação do projeto/webhook. O link dispensa login Vercel, mas não dispensa a senha de avaliação nem o login normal do CRM. Não remover a proteção global do projeto. Referência: [Vercel — Shareable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).

Antes de submeter: verificar acesso anônimo ao login, rejeição de senha incorreta, login válido, bloqueio de URLs do CRM sem sessão Supabase e token Meta válido; preencher as instruções com URL compartilhável e somente a credencial de avaliação. A demonstração usa o remetente de teste, não prova coexistência. A aprovação pela Meta permanece externa.

Revogação: desativar `META_REVIEWER_ENABLED` e republicar o preview; revogar também o link compartilhável na Vercel. Sem redeploy, a configuração antiga continua no deployment existente. A expiração de 30 dias do acesso é conferida no servidor em cada requisição. Não apagar registros de tentativas ou dados do Supabase para revogar acesso.
