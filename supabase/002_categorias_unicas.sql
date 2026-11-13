-- Stash — corrige categorias duplicadas e impede novas duplicatas.
-- Rode no SQL Editor do Supabase (pode rodar mais de uma vez sem problema).

-- 1) descobre as cópias: para cada nome+tipo, fica a categoria mais antiga
drop table if exists copias;
create temp table copias as
select id, fica from (
  select id,
         first_value(id) over (partition by user_id, tipo, lower(trim(nome)) order by created_at, id) as fica
  from categorias
) x
where id <> fica;

-- 2) move lançamentos e contas fixas para a categoria que fica
update transacoes t set categoria_id = c.fica from copias c where t.categoria_id = c.id;
update recorrentes r set categoria_id = c.fica from copias c where r.categoria_id = c.id;

-- 3) apaga as cópias
delete from categorias where id in (select id from copias);

-- 4) a partir de agora o banco não aceita duas categorias com o mesmo nome e tipo
create unique index if not exists categorias_nome_unico on categorias (user_id, tipo, lower(trim(nome)));
