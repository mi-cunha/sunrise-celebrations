# Adendo de plano — Contratos, Financeiro/Custos e Hospitalidade

## Decisão de escopo

Depois de um orçamento aprovado, o Sunrise OS deve evoluir o evento contratado para uma operação controlada: documento formal adequado, valores e custos acompanháveis, cortesias planejadas e materiais simples de hospitalidade registrados.

Este adendo é de planejamento. Ele não altera a interface nem qualquer funcionalidade já implementada; as mudanças entram em fatias posteriores da Fase 3.

## Contratos e termos

O evento aprovado terá uma seção de contratos, com os tipos `contrato_completo`, `termo_simplificado` e `aceite_proposta`. Regras configuráveis poderão sugerir o tipo adequado considerando evento, valor, convidados, sinal, parcelamento, decoração, fornecedores externos, exclusividade, horário, cerimônia e complexidade operacional.

Estados previstos: `nao_necessario`, `recomendado`, `obrigatorio`, `em_elaboracao`, `gerado`, `enviado`, `assinado` e `cancelado`.

O documento parte de template editável, mantém versões, permite PDF e exibe o aviso “Revise o contrato antes do envio.” Campos comerciais e de identificação permanecem editáveis conforme autorização. Cláusulas jurídicas definitivas não serão inventadas pelo sistema: o conteúdo exigirá validação humana/jurídica.

## Financeiro e custos

Cada evento contratado terá visão separada de valores cobrados, recebimentos, custos internos, cortesias, comissão e margem estimada. Os custos cobrem alimentos/bebidas, equipe extra, decoração, fornecedores, impressão/materiais, cortesias e outros itens.

Indicadores previstos: receita total, custo total estimado, margem bruta estimada, comissão estimada e lucro estimado após custos principais. Toda cortesia e todo material impresso devem ter custo estimado que componha o financeiro.

Custos, margem e demais informações financeiras serão visíveis somente a `financeiro`, `gerencia` e `admin_owner`.

## Hospitalidade e materiais impressos

O evento terá uma seção de hospitalidade para cortesias, recepção, mesa, pós-evento e materiais impressos. Cada item terá nome, tipo, descrição, custo estimado, momento de uso, visibilidade em proposta/contrato/checklist, responsável e status `planejado`, `aprovado`, `preparado`, `concluido` ou `cancelado`.

Será possível selecionar múltiplas cortesias, criar item personalizado e definir se ele é comunicado ao cliente ou apenas interno. Materiais iniciais: mini cardápio, menu de drinks, cartão de boas-vindas, plaquinha de reservado, roteiro do evento e cartão de agradecimento. Nesta fase, o sistema gera conteúdo-base e registra custos/checklist; design avançado fica fora do escopo.

`atendimento` visualiza hospitalidade e sugere cortesias; `gerencia` aprova cortesias e custos; `admin_owner` tem acesso total.

## Critérios de aceite futuros

- Evento aprovado possui seções de contrato, financeiro e hospitalidade sem alterar os fluxos existentes de contatos, orçamentos e eventos.
- Regras sugerem o tipo de documento, que pode ser revisado e versionado antes do envio.
- Cortesias e materiais são planejados, têm custo estimado e alimentam o financeiro.
- Regras de permissão protegem custos, margem e aprovações.
- Autenticação, permissões e regras atuais permanecem íntegras; build e testes relevantes passam antes da entrega.
