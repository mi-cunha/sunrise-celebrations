# Próximo passo — transição para Fase 2

## Checklist final da Fase 1

1. Aplicar todas as migrations:
   - `supabase/migrations/202608110001_initial_sunrise.sql`
   - `supabase/migrations/202608120001_lead_option_catalog.sql`
   - `supabase/migrations/202608120002_conversation_triage.sql`
   - `supabase/migrations/202608120003_atendimento_lead_updates.sql`
   - `supabase/migrations/202608120004_templates_users_transfer.sql`
   - `supabase/migrations/202608130001_quotes.sql`
   - `supabase/migrations/202608130002_quote_item_updates.sql`
   - `supabase/migrations/202608130003_proposal_branding_options.sql`
   - `supabase/migrations/202608130004_logo_upload_quote_item_catalog.sql`
   - `supabase/migrations/202608130005_admin_catalog_edit_remove.sql`
   - `supabase/migrations/202608130006_quote_decisions_edit_unlock.sql`
2. Reiniciar o servidor local após alterações de `.env.local` ou migrations.
3. Validar `/atendimentos`:
   - criar conversa simulada;
   - usar templates de resposta;
   - responder como humano;
   - transferir atendimento;
   - encerrar atendimento.
4. Validar `/admin/usuarios`:
   - editar nome de usuário;
   - alterar permissões;
   - ativar/desativar usuário.
5. Validar recuperação de senha:
   - clicar em “Esqueci minha senha”;
   - receber e-mail do Supabase;
   - abrir link;
   - redefinir senha;
   - entrar com a nova senha.

## Fase 2 — orçamentos

Objetivo: transformar um lead qualificado em orçamento estruturado.

Primeira fatia:

1. Criar modelo de dados para orçamento.
2. Criar orçamento a partir de um lead/evento potencial.
3. Adicionar itens com quantidade e valor unitário.
4. Calcular total.
5. Exibir orçamento dentro da página do lead e do atendimento.
6. Registrar mudanças no histórico.

Fatia atual:

1. Editar itens de um orçamento existente.
2. Remover itens.
3. Recalcular o total automaticamente após edição/remoção.
4. Registrar edição/remoção no histórico.
5. Criar proposta visual do orçamento para impressão/salvar em PDF.
6. Permitir logo configurável e opções padronizadas/manual para proposta.
7. Permitir logo por arquivo local e catálogo de itens/serviços do orçamento.
8. Permitir edição/remoção dos catálogos administrativos em accordions.
9. Registrar aprovação/recusa com motivo e proteger edição pós-aprovação com liberação admin.

Próximas fatias prováveis:

- geração de PDF interno automatizado;
- regras de aprovação/recusa;
- vínculo com contratação.
