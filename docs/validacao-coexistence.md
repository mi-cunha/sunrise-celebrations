# Validação de coexistência — MVP.0

Estado: implementação no branch `validacao-coexistence`. Ainda não validada com o número real, não promovida a produção. Escopo: uma organização, uma WABA e um número. Não é uma implementação multi-tenant.

Verificação local em 13/09/2026: lint, TypeScript, 42 testes, build Next.js 16.3.5 e `npm audit` aprovados (zero vulnerabilidades reportadas). Os testes não comprovam elegibilidade da Meta, entrega real, carga de histórico ou integração completa do preview.

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

## Configuração do ambiente isolado

Não aplicar esta migração no banco compartilhado com a versão antiga de produção: as novas restrições de escrita tornam o fluxo antigo de envio incompatível. Banco, migração e aplicação precisam ser implantados como um conjunto compatível.

1. Disponibilizar projeto Supabase de validação separado. Não copiar contatos/histórico reais desnecessariamente. Aplicar a base do repositório em ordem e a migração `202609130001_coexistence_validation.sql`; verificar a aplicação completa em staging. Os testes automatizados exercitam as migrações relevantes a leads/conversas/WhatsApp, não todas as demais áreas do produto.
2. Criar usuário administrador de teste e profile técnico ativo. `WHATSAPP_SYSTEM_USER_ID` é o UUID desse profile no Supabase, **não** o ID de usuário do sistema na Meta.
3. Configurar variáveis apenas em Preview, preferencialmente específicas do branch. Usar URL/chaves do Supabase isolado. Não reutilizar a `service_role` de produção no preview.
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

## Bloqueio de infraestrutura observado em 13/09/2026

O painel da organização Booster impede criar projeto gratuito adicional por limite de projetos ativos. Não houve pausa, exclusão ou upgrade. É necessária escolha do responsável para liberar uma vaga ou autorizar outra infraestrutura. CLI Vercel/Supabase está autenticada em contas diferentes das sessões web da Sunrise; não usar essas credenciais para implantar no projeto errado.

Fonte principal: [Meta — onboarding de usuários do WhatsApp Business App](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), consultada em 13/09/2026. Dependências de teste PostgreSQL local: [PGlite](https://pglite.dev/docs/).
