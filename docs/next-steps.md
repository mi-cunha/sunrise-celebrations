# Próximo passo a passo — Fase 3: operação do evento aprovado

## Resultado esperado

Evoluir gradualmente o evento aprovado para uma operação controlada, sem mudar ou regredir os fluxos existentes de contatos, atendimento, orçamentos e eventos. A sequência adiciona contratos, financeiro/custos e hospitalidade somente após cada recorte ser validado.

## 1. Descobrir e fixar o recorte

1. Revisar o modelo atual de evento, orçamento aprovado, pagamentos, permissões e RLS.
2. Confirmar quais entidades e telas da Fase 3 já existem antes de cada migration.
3. Separar os dados comerciais, financeiros, operacionais e de hospitalidade.
4. Definir critérios de aceite e cenários de autorização antes de implementar cada subfase.

## 2. Fase 3a — Contratos e termos

1. Modelar tipos, status, versão e dados editáveis de documento vinculados ao evento aprovado.
2. Criar regras configuráveis para sugerir contrato completo, termo simplificado ou aceite de proposta.
3. Considerar tipo/complexidade do evento, valor, convidados, sinal, parcelamento, decoração, fornecedores, exclusividade, horário e cerimônia.
4. Evoluir os rascunhos versionados, revisão humana, histórico e emissão já implementados para templates configuráveis e sincronização dos estados enviado/assinado/cancelado.
5. Não criar cláusulas jurídicas definitivas sem validação humana ou jurídica.

## 3. Fase 3b — Financeiro e custos

1. Modelar valores cobrados, sinal, parcelas, vencimentos, recebimentos e status de pagamento.
2. Registrar custos de alimentos/bebidas, equipe, decoração, fornecedores, impressão, cortesias e outros.
3. Calcular receita, custo total estimado, margem bruta, comissão e lucro estimado.
4. Garantir que toda cortesia e material impresso tenham custo estimado registrado.
5. Restringir custos, margem e indicadores a `financeiro`, `gerencia` e `admin_owner`, no servidor e em RLS.

## 4. Fase 3c — Hospitalidade e materiais simples

1. Modelar itens de cortesia, recepção, mesa, pós-evento e material impresso.
2. Registrar nome, tipo, descrição, custo, momento de uso, visibilidade, responsável e status.
3. Permitir múltiplas cortesias, itens personalizados e indicação de comunicação ao cliente ou uso interno.
4. Registrar mini cardápio, menu de drinks, cartão de boas-vindas, plaquinha de reservado, roteiro e cartão de agradecimento.
5. Integrar custos ao financeiro e itens ao checklist; gerar conteúdo-base, sem implementar design avançado.

## 5. Verificar e consolidar cada subfase

1. Testar autorizações positivas e negativas, cálculos, vínculos com o evento e preservação de funcionalidades existentes.
2. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
3. Revisar migrations, RLS, logs, variáveis de ambiente e diff para segredos ou dados reais.
4. Atualizar `docs/progress.md`, `docs/architecture.md` e decisões documentadas ao concluir cada recorte.

## Fora do escopo deste passo

- Alterar a usabilidade ou substituir fluxos já entregues.
- Criar redação jurídica definitiva automaticamente.
- Gerar design avançado de materiais impressos.
- Antecipar a integração oficial com WhatsApp.
