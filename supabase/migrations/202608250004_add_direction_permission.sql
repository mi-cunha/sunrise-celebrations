-- Novo perfil executivo. Deve ser aplicado e confirmado antes das migrations que o utilizam.
alter type public.app_permission add value if not exists 'direcao';
