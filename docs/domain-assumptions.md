# Premissas de domínio

## Fontes analisadas

Foram analisados os arquivos externos em `C:\Users\noemi\Downloads\project_sources`:

- `ORÇAMENTO EVENTOS - EM ANDAMENTO VS2005(CORPORATIVO GERAL).csv`
- `ORÇAMENTO EVENTOS - EM ANDAMENTO VS2005.pdf`
- `ORÇAMENTO EVENTOS - EM ANDAMENTO VS2005 (1).pdf`
- `ORÇAMENTO EVENTOS - EM ANDAMENTO VS2005 (2).pdf`
- `Pacotes Casamento (1).xlsx`
- `CAFÉ DA MANHÃ.pdf`
- `PCT CASAMENTO 40 PESSOAS.pdf`

As fontes foram usadas apenas para inferir estrutura, campos e etapas. Dados pessoais, contatos, nomes reais, valores e linhas de orçamento não foram copiados para o repositório.

## Fatos observados

- A planilha/CSV de orçamentos em andamento aponta para um fluxo comercial com contato, telefone, empresa, data do evento, tipo de evento, quantidade de pessoas, proposta e sinais de pacote/decoracao.
- Os PDFs de orçamento reforçam que proposta/orçamento, total/valor e pagamento pertencem à próxima fase de modelagem financeira.
- A planilha de pacotes de casamento usa estrutura própria de pacotes, totais e valores; isso deve virar modelo de orçamento, não campos soltos no lead.
- Eventos corporativos aparecem como caso real de uso, então `empresa` é um dado opcional do lead desde a Fase 1.

## Hipóteses adotadas nesta fatia

- Todo lead começa como `novo`.
- Um lead pode ter, no máximo, um evento potencial nesta fase.
- Tipo, data e convidados são opcionais; caso algum deles exista, cria-se o registro de evento potencial.
- Empresa é opcional e fica no lead, porque pode existir lead pessoa física sem empresa.
- Tipo de evento e origem são listas administráveis. A migração inclui opções iniciais genéricas, e `admin_owner` pode adicionar novas opções no painel.
- Telefone é armazenado em formato brasileiro com DDD, usando máscara `(DD) 0000-0000` ou `(DD) 00000-0000`.
- Leads vindos de WhatsApp continuam seguindo a regra operacional de IA primeiro; decisões de preço, disponibilidade, contrato, pagamento, desconto e reagendamento exigem humano.
- A primeira versão de atendimento usa `whatsapp_simulado`; a integração oficial de WhatsApp fica como adaptador futuro, após validar o fluxo interno.
- Quando um humano assume um atendimento, `ai_paused` fica verdadeiro e mensagens automáticas deixam de ser geradas naquela conversa.
- `admin_owner` atua como privilégio superior para a primeira versão; permissões permanecem acumulativas.

## Conflitos e lacunas

- Os documentos confirmam a existência de orçamento, proposta, pacote, valores, pagamento e itens de decoração, mas não definem sozinhos uma fonte de verdade única para cálculo.
- Alguns PDFs parecem ser materiais visuais/cardápios ou propostas fechadas; eles não foram usados para criar fórmulas nesta fase.
- A nomenclatura definitiva de tipos de evento ainda deve ser validada antes de virar enum fechado.

## Perguntas que bloqueiam fases futuras

1. Qual arquivo de orçamento/pacote é a fonte de verdade para cálculo e preços?
2. Quais campos de proposta devem virar entidade própria: número da proposta, pacote, decoração, forma de pagamento, sinal, desconto, total?
3. Em qual ponto do funil o lead passa a ser evento contratado e quais dados devem ficar imutáveis?
4. Quais usuários podem ver valores, custos, margem e pagamentos em cada estado?
5. Como deve funcionar a distribuição de responsáveis e a troca de responsável?
