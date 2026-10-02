-- Separada da migration seguinte para que os novos valores do enum possam ser
-- usados com segurança nas funções SQL em uma transação posterior.
alter type public.quote_status add value if not exists 'em_negociacao' after 'enviado';
alter type public.quote_status add value if not exists 'cancelado' after 'recusado';
