-- Organiza as respostas de atendimento por etapa para manter o seletor enxuto.
alter table public.response_templates
  add column if not exists category text not null default 'Outras respostas'
  check (char_length(category) between 2 and 80);

create index if not exists response_templates_category_sort_idx
  on public.response_templates (category, sort_order, title);

update public.response_templates
set category = 'Outras respostas'
where category is null or btrim(category) = '';

insert into public.response_templates (title, body, category, is_active, sort_order) values
('Primeira resposta completa', $$Oi, [nome]! 💛 Que bom saber que vocês estão pensando em celebrar esse momento na Sunrise.

Nosso Mini Wedding foi criado para casamentos intimistas, com até 50 convidados, realizados em dias e horários selecionados enquanto a Sunrise funciona normalmente.

A ideia é aproveitar toda a estrutura e a gastronomia da casa para oferecer uma celebração linda à beira-mar, mas mais simples e acessível do que um casamento tradicional.

Me conta: vocês imaginam algo assim, mais intimista, ou estão buscando uma festa maior e exclusiva?$$, 'Primeiro contato', true, 10),
('Resposta curta para lead de anúncio', $$Oi, [nome]! Seja bem-vinda à Sunrise 💛

Trabalhamos com Mini Weddings intimistas para até 50 convidados, em dias e horários selecionados, aproveitando a estrutura da Sunrise em funcionamento.

Para eu te orientar melhor, qual é a data desejada e quantas pessoas vocês imaginam convidar?$$, 'Primeiro contato', true, 20),
('Quando pergunta apenas o valor', $$Oi, [nome]! O valor depende principalmente da quantidade de convidados, da data e da composição escolhida.

Nosso formato principal é o Mini Wedding para até 50 pessoas, em dias e horários selecionados, com a Sunrise funcionando normalmente. Isso nos permite oferecer uma experiência à beira-mar mais leve e acessível.

Quantos convidados vocês imaginam e para qual data? Com essas informações, consigo indicar a opção mais adequada.$$ , 'Primeiro contato', true, 30),
('Coleta objetiva de informações', $$Perfeito! Para eu verificar o melhor formato para vocês, me passa, por favor:

• data ou mês desejado;
• quantidade estimada de convidados;
• horário que imaginam para a celebração;
• se desejam cerimônia e recepção ou apenas recepção;
• o que é indispensável para vocês nesse dia.

Com isso, consigo direcionar a proposta sem incluir uma estrutura maior do que vocês realmente precisam.$$ , 'Primeiro contato', true, 40),
('Lead compatível com Mini Wedding', $$Pelo que você me contou, o formato de Mini Wedding combina bastante com o que vocês imaginam. 💛

Ele foi pensado para celebrações de até 50 convidados, em dias e horários selecionados, aproveitando a estrutura da Sunrise e a vista para o mar. Assim, vocês conseguem viver um casamento bonito e bem organizado sem assumir toda a complexidade de uma festa tradicional.

Vou preparar a opção mais adequada considerando [número] convidados e [data ou período].$$, 'Perfil do evento', true, 50),
('Lead acima de 50 convidados', $$Para [número] convidados, já saímos da proposta do nosso Mini Wedding e entramos no formato de evento de casamento. Nesse caso, precisamos considerar outra estrutura, operação e disponibilidade da casa, por isso o orçamento é personalizado.

Posso verificar essa possibilidade para vocês. A ideia é manter a experiência à beira-mar, mas dimensionar corretamente tudo o que o evento exige. 😊$$, 'Perfil do evento', true, 60),
('Sábado ou horário de maior movimento', $$Entendi, [nome]. O nosso formato mais acessível de Mini Wedding acontece em dias e horários selecionados, porque utiliza a estrutura da Sunrise durante o funcionamento da casa.

Para [sábado à noite/outro período solicitado], precisamos verificar a disponibilidade e avaliar um formato de evento com operação específica, que pode ter outra composição e investimento.

Vocês têm flexibilidade para uma data durante a semana ou preferem que eu consulte somente o formato de evento para esse período?$$, 'Perfil do evento', true, 70),
('Busca exclusividade total', $$No Mini Wedding, a Sunrise permanece em funcionamento e a celebração acontece em um espaço organizado para o grupo, conforme a composição contratada.

Se a exclusividade da casa for indispensável para vocês, precisamos avaliar outro formato de evento, sujeito à disponibilidade e a um orçamento específico. Quer que eu faça esse direcionamento?$$, 'Perfil do evento', true, 80),
('Formato não é compatível', $$Obrigada por me explicar o que vocês imaginam, [nome]. Pelo número de convidados e pelo formato desejado, a proposta de Mini Wedding não atenderia bem ao evento de vocês.

Posso consultar a possibilidade de um evento de casamento personalizado na Sunrise. Nesse formato, a disponibilidade, a estrutura e o investimento são avaliados separadamente.$$ , 'Perfil do evento', true, 90),
('Antes de enviar a proposta', $$Perfeito, [nome]. Com base no que vocês me contaram, vou enviar uma proposta para [número] convidados, considerando [data ou período].

Ela apresenta a estrutura e os serviços incluídos na opção indicada. Itens adicionais ou personalizações podem ser avaliados à parte. Se surgir qualquer dúvida durante a leitura, pode me chamar por aqui.$$ , 'Proposta', true, 100),
('Envio da proposta de Mini Wedding', $$[nome], preparei a proposta do Mini Wedding para vocês. 💛

Esse formato aproveita a estrutura e a gastronomia da Sunrise em funcionamento para criar uma celebração intimista à beira-mar, com uma operação mais simples do que a de um grande evento.

Estou enviando o material logo abaixo. Depois que você olhar, posso explicar os itens e verificar os próximos passos com vocês.$$ , 'Proposta', true, 110),
('Envio de orçamento personalizado', $$[nome], estou enviando a proposta personalizada para o casamento de vocês, considerando [número] convidados e [data ou período].

Como esse formato ultrapassa a proposta do Mini Wedding, a estrutura e a operação foram avaliadas como evento de casamento. Leia com calma e me sinalize os pontos que gostariam de conversar ou ajustar.$$ , 'Proposta', true, 120),
('Explicação sobre itens não incluídos', $$A proposta contempla somente os itens descritos no material. Serviços como [decoração/bolo e doces/celebrante/outro item] não estão incluídos nesta composição e, caso vocês desejem, podemos verificar as possibilidades separadamente.

Prefiro deixar isso claro desde o início para que vocês consigam comparar o investimento real sem surpresas.$$ , 'Proposta', true, 130),
('Verificação após envio da proposta', $$Conseguiu abrir a proposta, [nome]?

Antes de avançarmos, quero confirmar se o formato ficou claro: a opção enviada considera [número] convidados, [data ou período] e [resumo das condições principais].

Se estiver alinhado ao que vocês imaginam, podemos agendar uma visita para conhecerem o espaço e visualizarem melhor a celebração.$$ , 'Proposta', true, 140),
('Convite para conhecer o espaço', $$Acho que o próximo passo ideal é vocês conhecerem a Sunrise e verem pessoalmente como o Mini Wedding pode funcionar no espaço. 💛

Na visita, mostramos a área prevista para a celebração, explicamos a dinâmica da casa e tiramos as dúvidas sobre a proposta.

Tenho disponibilidade em [opção 1] ou [opção 2]. Qual horário funciona melhor para vocês?$$, 'Visita', true, 150),
('Visita sem horários definidos', $$Podemos agendar uma visita à Sunrise para vocês conhecerem o espaço e conversarmos sobre a proposta.

Quais dias e períodos costumam funcionar melhor para vocês: manhã, tarde ou início da noite? A partir disso, verifico as opções disponíveis com a equipe.$$ , 'Visita', true, 160),
('Confirmação do agendamento', $$Visita confirmada 💛

Data: [data]
Horário: [horário]
Local: Sunrise Beach Club
Responsável pelo atendimento: [responsável]

Se precisarem alterar o horário, avisem por aqui. Será um prazer receber vocês e mostrar as possibilidades para a celebração.$$ , 'Visita', true, 170),
('Lembrete no dia anterior', $$Oi, [nome]! Passando para lembrar da nossa visita amanhã, [data], às [horário], na Sunrise. 💛

Estaremos esperando vocês. Se houver qualquer imprevisto, é só me avisar por aqui.$$ , 'Visita', true, 180),
('Lembrete no mesmo dia', $$Bom dia, [nome]! Nossa visita está confirmada para hoje às [horário].

Quando vocês chegarem à Sunrise, podem informar que vieram conversar sobre o casamento com [responsável]. Até já!$$, 'Visita', true, 190),
('Reagendamento solicitado pelo cliente', $$Sem problema, [nome]. Vamos remarcar para um momento mais tranquilo para vocês.

Tenho disponibilidade em [opção 1] ou [opção 2]. Alguma dessas opções funciona?$$, 'Visita', true, 200),
('Cliente não compareceu à visita', $$Oi, [nome]. Sentimos sua falta na visita de hoje e espero que esteja tudo bem.

Se vocês ainda quiserem conhecer o espaço, posso verificar um novo horário. Prefere [opção 1] ou [opção 2]?$$, 'Visita', true, 210),
('Agradecimento e resumo da visita', $$[nome], foi um prazer receber vocês hoje na Sunrise. 💛

Pelo que conversamos, a proposta considera [número] convidados, [data ou período] e [principais escolhas]. Ficou pendente confirmarmos [pendência, se houver].

Vou [ação combinada] até [prazo]. Se vocês lembrarem de qualquer outra dúvida, podem me enviar por aqui.$$ , 'Pós-visita e reserva', true, 220),
('Envio de proposta ajustada', $$Como combinamos na visita, ajustei a proposta considerando [alterações].

Estou enviando a nova versão abaixo. Confere, por favor, se ela representa o que vocês imaginaram. Se estiver tudo certo, explico o processo para reserva da data e formalização.$$ , 'Pós-visita e reserva', true, 230),
('Cliente quer avançar', $$Que alegria saber que vocês querem celebrar com a Sunrise, [nome]! 💛

O próximo passo é formalizar a contratação e realizar o pagamento do sinal previsto na proposta. A data só é confirmada após essa etapa.

Vou enviar [contrato/dados/instruções] para vocês conferirem. Assim que a confirmação estiver concluída, registro a reserva e seguimos com o planejamento.$$ , 'Pós-visita e reserva', true, 240),
('Confirmação da reserva', $$Tudo confirmado, [nome]! 💛

O casamento de vocês está reservado para [data], às [horário], considerando inicialmente [número] convidados e a composição [nome do pacote].

A partir de agora, seguimos com os próximos alinhamentos conforme o cronograma combinado. Estamos muito felizes em participar desse momento.$$ , 'Pós-visita e reserva', true, 250),
('Um dia após o envio', $$Oi, [nome]! Passando para saber se você conseguiu olhar a proposta com calma e se ficou alguma dúvida sobre o formato do Mini Wedding.

Se ajudar, posso explicar os principais pontos por aqui ou agendar uma visita para vocês conhecerem o espaço.$$ , 'Acompanhamento', true, 260),
('Três dias depois', $$Oi, [nome]! Queria entender se a proposta está próxima do que vocês imaginam para a celebração.

Existe algum ponto que esteja dificultando a decisão, como data, quantidade de convidados, formato ou composição? Assim consigo orientar vocês com mais precisão.$$ , 'Acompanhamento', true, 270),
('Último retorno do ciclo', $$Oi, [nome]. Vou encerrar este acompanhamento por enquanto para não ficar insistindo, mas deixo o canal aberto caso vocês queiram retomar. 💛

Se a ideia de uma celebração intimista à beira-mar continuar fazendo sentido, será um prazer verificar novamente as opções disponíveis.$$ , 'Acompanhamento', true, 280),
('Reativação futura', $$Oi, [nome]! Há algum tempo conversamos sobre o casamento de vocês na Sunrise e lembrei do projeto para [data ou período].

Vocês já definiram o formato da celebração ou ainda estão avaliando possibilidades? Se ainda fizer sentido, posso atualizar as informações e verificar a disponibilidade.$$ , 'Acompanhamento', true, 290),
('Por que acontece durante a semana', $$Os dias e horários selecionados fazem parte da proposta do Mini Wedding. Ao aproveitar a estrutura da Sunrise em funcionamento, conseguimos simplificar a operação e oferecer uma celebração à beira-mar mais acessível do que um casamento tradicional.

Se vocês precisarem de outro dia ou horário, podemos verificar a possibilidade de um evento personalizado, sujeito à disponibilidade e a outro orçamento.$$ , 'Dúvidas e objeções', true, 300),
('A casa estará funcionando', $$Sim. No formato de Mini Wedding, a Sunrise permanece em funcionamento normalmente. A celebração é organizada na área prevista para o grupo, conforme a composição contratada.

Se vocês buscam exclusividade total da casa, precisamos avaliar o formato de evento de casamento, com disponibilidade e investimento específicos.$$ , 'Dúvidas e objeções', true, 310),
('Receio de parecer simples demais', $$Intimista não significa sem cuidado. A proposta é concentrar o investimento no que realmente importa para vocês: um ambiente bonito, boa experiência para os convidados, gastronomia e organização.

A diferença é que não precisamos criar toda a estrutura de um grande evento do zero.$$ , 'Dúvidas e objeções', true, 320),
('Pedido de desconto', $$Entendo que o investimento é uma parte importante da decisão. Antes de falar em desconto, posso revisar com vocês a quantidade de convidados e a composição escolhida para identificar o que é realmente essencial.

Assim, buscamos uma opção mais adequada sem comprometer os itens que sustentam a experiência do evento.$$ , 'Dúvidas e objeções', true, 330),
('Comparação com outro espaço', $$Faz sentido comparar. Para a comparação ser justa, vale observar o que cada proposta inclui: estrutura, mobiliário, alimentação, bebidas, equipe, limpeza, segurança, duração e itens adicionais.

Na Sunrise, também existe o diferencial da experiência à beira-mar e da estrutura já disponível. Se você me disser qual ponto quer comparar, explico exatamente como ele aparece na nossa proposta.$$ , 'Dúvidas e objeções', true, 340),
('Decoração', $$A decoração depende da composição escolhida. Na proposta enviada, estão incluídos somente os itens descritos no material.

Caso vocês desejem uma decoração específica, podemos verificar as possibilidades e apresentar o impacto no orçamento antes da contratação.$$ , 'Dúvidas e objeções', true, 350),
('Reserva provisória da data', $$A disponibilidade pode ser consultada, mas a data só é confirmada após a formalização e o pagamento do sinal previsto na proposta.

Se vocês quiserem avançar, envio agora as orientações para a próxima etapa.$$ , 'Dúvidas e objeções', true, 360),
('Número de convidados indefinido', $$Podemos trabalhar com uma estimativa inicial, mas é importante que ela seja realista, porque alterações na quantidade de convidados podem impactar o valor e até o formato do evento.

Hoje, vocês imaginam até 30, entre 31 e 50 ou mais de 50 pessoas?$$ , 'Dúvidas e objeções', true, 370),
('Encerramento cordial', $$Obrigada por me avisar, [nome]. Desejo que a celebração de vocês seja linda e exatamente como imaginaram. 💛

As portas da Sunrise continuam abertas e será um prazer receber vocês em outra oportunidade.$$ , 'Encerramento', true, 380)
on conflict (lower(title)) do update
set body = excluded.body,
    category = excluded.category,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;
