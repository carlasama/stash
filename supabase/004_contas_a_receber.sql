-- Stash — novo tipo de conta: "valor a receber" (dinheiro emprestado).
-- Rode no SQL Editor do Supabase.
alter table contas drop constraint if exists contas_tipo_check;
alter table contas add constraint contas_tipo_check
  check (tipo in ('corrente','poupanca','carteira','investimento','a_receber'));
