# Sunrise OS

Base interna para leads, atendimentos e eventos da Sunrise Celebrations.

## Pré-requisitos

- Node.js 20+.
- Projeto Supabase.
- Usuários criados no Supabase Auth.
- Primeiro usuário administrativo com perfil em `public.profiles` e permissão `admin_owner`.

Não use `service_role` no cliente. O app usa apenas a URL pública e a chave pública/anon/publishable do Supabase.

## Instalação

1. Execute:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Também funciona com `NEXT_PUBLIC_SUPABASE_ANON_KEY`, se for o nome usado no projeto.

3. Aplique as migrations no Supabase SQL Editor ou Supabase CLI, nesta ordem:

   ```text
   supabase/migrations/202608110001_initial_sunrise.sql
   supabase/migrations/202608120001_lead_option_catalog.sql
   supabase/migrations/202608120002_conversation_triage.sql
   supabase/migrations/202608120003_atendimento_lead_updates.sql
   supabase/migrations/202608120004_templates_users_transfer.sql
   supabase/migrations/202608130001_quotes.sql
   supabase/migrations/202608130002_quote_item_updates.sql
   supabase/migrations/202608130003_proposal_branding_options.sql
   supabase/migrations/202608130004_logo_upload_quote_item_catalog.sql
   supabase/migrations/202608130005_admin_catalog_edit_remove.sql
   supabase/migrations/202608130006_quote_decisions_edit_unlock.sql
   ```

4. Crie o perfil do primeiro usuário autenticado e associe a permissão `admin_owner`.

5. Execute:

   ```bash
   npm run dev
   ```

6. Abra:

   ```text
   http://localhost:3000
   ```

## Verificação

Use:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

No Windows, se `npm run build` falhar com `EPERM` em `.next`, pare o servidor de desenvolvimento e tente novamente.

## Módulos atuais

- Login e recuperação de senha via Supabase Auth.
- Leads e eventos potenciais.
- Opções padronizadas de origem e tipo de evento.
- Atendimento simulado com IA primeiro.
- Handoff humano, pausa de IA e transferência entre atendentes.
- Templates de resposta.
- Edição rápida de lead dentro do atendimento.
- Checklist de qualificação.
- Histórico do lead.
- Gestão básica de usuários e permissões.
- Orçamentos com itens, catálogo editável de serviços, edição/remoção, total, status, histórico, aprovação/recusa com motivo, trava pós-aprovação com liberação admin, proposta visual para impressão/PDF, logo configurável por arquivo e condições padronizadas de proposta.

## Fontes do projeto

Arquivos reais de orçamento, pacote, PDF e planilha devem ficar fora do versionamento.

A pasta `project_sources/` está ignorada para evitar commit acidental de dados pessoais, contatos ou valores comerciais.
