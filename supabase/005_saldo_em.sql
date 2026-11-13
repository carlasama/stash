-- Stash — guarda QUANDO o saldo da conta foi informado.
-- Pagamentos com data anterior não são descontados de novo. Rode no SQL Editor do Supabase.
alter table contas add column if not exists saldo_em timestamptz;
