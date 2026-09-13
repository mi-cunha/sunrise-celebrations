# Validação de coexistência — MVP.0

Estado: implementação no branch `validacao-coexistence`. Ainda não validada com o número real, não promovida a produção. Escopo: uma organização, uma WABA e um número. Não é uma implementação multi-tenant.

Verificação local em 13/09/2026: lint, TypeScript, 43 testes e build Next.js 16.3.5 aprovados; `npm audit` também aprovado na verificação anterior (zero vulnerabilidades reportadas). Os testes não comprovam elegibilidade da Meta, entrega real, carga de histórico ou integração completa do preview.

## O que mudou

- Cadastro exige administrador ativo, mesma origem e WABA/Phone ID autorizados no servidor.
- Pré-verificação de configuração, App Secret e tabelas antes de consumir o código da Meta. O Configuration ID ainda deve ser conferido no aplicativo correto na Meta; a pré-verificação não certifica sua propriedade.
- Código trocado no servidor; token conferido quanto a app/permissões, criptografado com AES-256-GCM e vinculado a app/número. Tabela sem acesso para `anon`/`authenticated`.
- “Conectado” somente com `is_on_biz_app=true`, `platform_type=CLOUD_API` e inscrição de `crm-sun` na WABA. Um webhook sozinho não certifica a conexão. Não usa `/register`.
- Sincronização de contatos e histórico solicitada pelo administrador, nessa ordem, até 24h após o onboarding. Reserva persistida por ciclo antes de cada chamada; timeout/resultado desconhecido nunca repetido automaticamente.
- Sem resposta automática no WhatsApp. Entrada e eco gravados por RPC transacional; CRM inicia com IA pausada. Simulações não podem ser inseridas como mensagens reais.
- Status persistidos e reconciliados mesmo quando chegam antes da confirmação de envio ou fora de ordem.
- Tentativa humana registrada antes do envio; ID estável impede repetição da mesma tentativa. Resultado incerto exige conferência, não retry automático. Janela de 24h considera apenas entrada nova pela API nesta conversa, nunca histórico ou eco.
- Conversa atualiza a cada 5s quando visível, mostra origem/status e deduplica histórico contra mensagens atuais.

## Configuração com o Supabase existente (autorizada em 13/09/2026)

A migração foi adaptada e aplicada no projeto Celebrations após ensaio com rollback. Foram preservados os 3 atendimentos e 8 registros de mensagens existentes. As novas políticas aceitam o formato de resposta humana da versão antiga, mantendo bloqueadas entradas reais forjadas e alterações de roteamento pelo cliente. A exceção de compatibilidade para o envio legado só deve ser removida após encerrar o uso da versão antiga. Não reaplicar a migração: tabelas/políticas já existem no banco real.

1. Usar o Supabase Celebrations existente, ref `mcdrfjwasuxkdaspqmuz`, conforme escolha explícita do usuário. Preview compartilha dados reais; não é descartável nem isolado. Não executar fixtures persistentes contra este banco. Os testes automatizados usam PostgreSQL em memória e exercitam as migrações relevantes a leads/conversas/WhatsApp, não todas as demais áreas do produto.
2. Reutilizar administrador e profile técnico ativos. `WHATSAPP_SYSTEM_USER_ID` é o UUID desse profile no Supabase, **não** o ID de usuário do sistema na Meta.
3. As seis variáveis sensíveis existentes de Supabase/Meta (URL, chave pública, service_role, App Secret, profile técnico, verify token) foram habilitadas também para Preview sem alterar valores nem disponibilidade em Production. A Vercel não permite reler seus valores; o escopo comum de Preview deve ficar restrito a código confiável deste repositório. As novas configurações são específicas do branch `validacao-coexistence`. Não habilitar deploys de forks não confiáveis com esses segredos.
4. Configurar `NEXT_PUBLIC_META_APP_ID=1966660290718855` (`crm-sun`) e `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=4473682106181135`. App Secret precisa pertencer ao **mesmo** app. Produção foi observada com App ID de outro aplicativo; não copiar essa combinação.
5. Configurar `WHATSAPP_ALLOWED_WABA_ID=1800002930569834`, `WHATSAPP_ALLOWED_PHONE_NUMBER_ID=631897616670252`, versão Graph conforme painel, `WHATSAPP_VERIFY_TOKEN` aleatório e `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` aleatória de 32 bytes em hex. Armazenar a chave em gerenciador seguro; sua perda impede descriptografar os tokens. Não enviar segredos ao Git ou ao chat.
6. Manter `WHATSAPP_REVIEW_ENABLED=false`. Tokens antigos de avaliação e `WHATSAPP_ACCESS_TOKEN` não são fallback para o envio oficial.
7. Dar ao preview URL estável HTTPS. Configurar domínio/login OAuth e URLs públicas de privacidade, termos e exclusão no app correto. Meta não consegue entregar webhooks a um preview protegido por login da Vercel: validar a acessibilidade **somente do endpoint** `/api/whatsapp/webhook`, mantendo o restante autenticado.
8. Coordenar a URL de callback de `crm-sun`, que é compartilhada pelo aplicativo: registrar valor anterior e janela de validação antes de mudá-la. Inscrever `messages`, `smb_message_echoes`, `smb_app_state_sync`, `history` e `account_update`. Validar challenge/HMAC com o App Secret correto antes de solicitar importação.

## Roteiro de aceite com o usuário

1. Confirmar estado/elegibilidade no Meta Business/Developer. O uso interno não garante acesso à coexistência: a documentação lista Solution Partner/Tech Provider como requisito. Não enviar declarações empresariais inexatas para contornar revisão.
2. Informar antes do QR que o onboarding pode desvincular dispositivos conectados e alterar recursos do app; manter aplicativo atualizado e considerar essas limitações com o responsável pelo número.
3. Administrador inicia cadastro no CRM. Usuário finaliza etapas e QR no WhatsApp Business. A resposta precisa confirmar Business App + CLOUD_API e inscrição da WABA.
4. Manter app aberto e solicitar sincronização. Conferir request IDs e webhooks. Recusa de histórico (`2593109`) não impede mensagens novas e não equivale a falha técnica genérica.
5. Com um contato de teste autorizado, enviar mensagem nova ao corporativo: uma entrada no CRM, nenhuma resposta automática.
6. Responder pelo painel: confirmar recebimento no contato e status de envio/entrega; leitura depende das configurações aplicáveis do destinatário.
7. Responder pelo celular: uma mensagem espelhada no CRM com origem Business App.
8. Reentregar payload assinado em ambiente de teste: sem duplicação. Reentregar status fora de ordem: sem regressão. Testar falha de token e tentativa duplicada sem novo envio.
9. Só promover a produção após registrar essas evidências. A aprovação/elegibilidade, fuso e pagamento da WABA são dependências externas, não corrigidas por testes de código.

## Limites e recuperação

- Não usa API não oficial, não remove o número e não chama registro/migração convencional.
- Webhook processa sincronicamente (60s), com recibos sem payload bruto; falhas retornam 500 para retry da Meta. Ainda não há fila durável externa, dead-letter queue ou ensaio com histórico volumoso. Validar payloads/tempo da hospedagem antes da importação real; esta implementação não certifica operação em escala.
- Mídias aparecem como tipo/legenda; download, player e envio de anexos estão fora desta fatia. Texto acima de 4.000 caracteres é exibido truncado para respeitar o esquema atual.
- Uma tentativa com status `pending` antigo/`unknown` não pode ser reenviada automaticamente. Conferir no WhatsApp e investigar; recarregar para uma nova tentativa somente após decisão humana. Não há garantia de exactly-once entre a Meta e o banco em caso de falha após envio.
- Reserva de sync `requesting`/`unknown` exige conferência na Meta. Não apagar reservas para forçar retry. Um onboarding realmente novo cria outro ciclo; preservar os registros anteriores.
- Manter backup seguro da chave de criptografia; rotação requer recriptografia ou novo onboarding, nunca apenas sobrescrever a chave.
- Um token previamente existente em Graph Explorer não foi revogado por limpar seu campo; avaliar sua revogação separadamente sem invalidar outras integrações por engano.

## Decisão de infraestrutura e implantação

O limite de projetos gratuitos deixou de ser bloqueio: o usuário autorizou usar o projeto existente. Não houve pausa, exclusão ou upgrade. A CLI Vercel foi autorizada como `mi-cunha` em diretório temporário próprio; o login global dos outros projetos não foi substituído. A CLI Supabase continua com outra conta: a migração foi executada na sessão web autenticada de Celebrations, não pela CLI.

O script `scripts/configure-coexistence-preview.mjs` confere projeto/equipe, preserva valores existentes e não imprime segredos. A chave de criptografia foi gerada diretamente para a Vercel. Não executar de novo para tentar recuperar o valor: a variável sensível existente é preservada, nunca rotacionada implicitamente. A disponibilidade da produção não comprova ainda o teste de coexistência no preview.

Fonte principal: [Meta — onboarding de usuários do WhatsApp Business App](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), consultada em 13/09/2026. Dependências de teste PostgreSQL local: [PGlite](https://pglite.dev/docs/).

## Evidências de implantação e pendências

- Preview do commit `c3e4607` publicado e READY: `dpl_HMdBn7gpDbSUS368MDLJnGQzE45U`, URL `https://sunrise-celebrations-l9vxr03kp-booster7.vercel.app`. Alias de trabalho: `https://sunrise-celebrations-git-validacao-coexistence-booster7.vercel.app`.
- Banco real: tabelas/funções novas persistidas; `authenticated` sem SELECT nas credenciais e sem EXECUTE em `ingest_whatsapp_message(jsonb,uuid)`. Contagens existentes preservadas: 3 conversas, 8 mensagens.
- URLs legais de `crm-sun` salvas e confirmadas após recarregar a Meta: `/politica-de-privacidade`, `/termos-de-uso` e `/exclusao-de-dados`, todas no domínio de produção, HTTP 200.
- `scripts/smoke-coexistence-preview.mjs`: seis verificações HTTP aprovadas no deployment acima, incluindo páginas públicas e rejeições sem sessão/assinatura, usando o bypass de automação autorizado da Vercel somente em memória. O proxy redireciona APIs privadas sem sessão para `/login` (307); isso não comprova o bloqueio CSRF de uma sessão autenticada, coberto separadamente pelos testes locais.
- Ainda pendentes: sessão administrativa no preview, correspondência real do App Secret, domínio/OAuth de preview, callback Meta apontado ao código novo, onboarding pelo celular e mensagens reais. O callback permanece em produção; não iniciar teste real antes de ajustá-lo, pois a versão antiga pode responder automaticamente.
- A proteção da Vercel continua ativa. Para callback de preview, a Meta precisa de acesso de automação via query parameter; nunca registrar o URL com seu segredo no Git ou em relatórios. A versão de produção do app não foi promovida.
