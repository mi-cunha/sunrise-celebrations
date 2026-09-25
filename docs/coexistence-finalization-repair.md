# Finalização e importação de coexistência

## Escopo

Correção local no branch `validacao-coexistence`. Não altera produção, credenciais existentes, número, webhook ou dados do Supabase. Não chama `/register` nem desconecta a conta. Respostas automáticas continuam fora do escopo.

## Alterações

- Um código OAuth recebido pode ser finalizado mesmo sem o evento de sessão da janela Meta. IDs informados ainda precisam corresponder à allowlist do servidor. O token é validado por app/permissões e precisa acessar a WABA e o número configurados. Sem código OAuth, não há finalização.
- Uma opção desmarcada por padrão permite solicitar contatos e histórico imediatamente após a confirmação. A autorização de compartilhamento na Meta continua necessária. Falha na importação não é apresentada como falha da conexão, e não há repetição automática.
- Estado local `pending` aparece como “Finalização pendente no CRM”, não como prova de desconexão na Meta.
- Reautorização preserva o identificador da tentativa e o início da janela de sincronização. Para registros antigos sem `connected_at`, usa-se conservadoramente `created_at`. Isso não comprova o horário de onboarding na Meta e pode bloquear uma importação legítima; não ampliar a janela sem evidência de um novo onboarding.

## Limites e próximos passos

A falta do evento de sessão é uma fragilidade identificada, não uma causa comprovada do incidente. Nenhuma mudança aqui recupera um código OAuth antigo ou reabre o prazo do histórico.

Antes de uma reconexão real: verificar as assinaturas `history`, `smb_app_state_sync`, `smb_message_echoes` e `account_update`; confirmar com o suporte como recuperar o histórico fora da janela; obter aprovação explícita para eventual desconexão. Preparar tratamento comprovado de novo ciclo de onboarding antes de reutilizar a conexão antiga — esta correção deliberadamente não reinicia o ciclo por mera reautorização.

Documentação consultada: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users

## Verificação

Lint, TypeScript, 83 testes e build passaram. Testes de API usam mocks, sem acesso à Meta/Supabase. Cobrem ausência do evento de sessão, IDs não autorizados, origem/autorização, preservação da janela, consentimento para importação e falha parcial sem repetição. Validação real no preview ainda pendente; nenhuma publicação foi realizada.
