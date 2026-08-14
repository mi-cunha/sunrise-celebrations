-- Fase 3: adiciona modelo híbrido para eventos com serviços pré-pagos e consumo aberto pós-evento.
alter type public.contracted_event_billing_model
  add value if not exists 'pre_pago_com_consumo_aberto';
