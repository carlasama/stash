-- Stash — permite ajustar o limite usado do cartão
-- (compras feitas antes de começar a usar o app). Rode no SQL Editor do Supabase.
alter table cartoes add column if not exists ajuste_limite numeric(14,2) not null default 0;
