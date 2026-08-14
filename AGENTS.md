# Sunrise OS

## Comandos

`npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Convenções

- TypeScript estrito; valide toda escrita de entrada com Zod.
- Autorizações acontecem no servidor e são repetidas em RLS; UI não é controle de acesso.
- Não adicione segredos, dados pessoais reais ou seeds reais.
- Migrações Supabase são versionadas em `supabase/migrations`.

## Loop de trabalho

Descobrir → planejar uma fatia mínima → implementar → verificar lint/tipos/testes/build → corrigir → documentar. Preserve alterações preexistentes e não aumente escopo sem alinhamento.

## Regra de atendimento

Todo lead recebido pelo WhatsApp nasce com atendimento inicial da IA. A IA coleta dados e sinaliza quando precisa de humano. Um atendente com permissão adequada pode assumir o atendimento; a partir desse momento, respostas automáticas da IA ficam pausadas para aquela conversa. Decisões de preço, disponibilidade, contrato, pagamento, desconto e reagendamento exigem humano.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
