-- Stash — esquema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Cada usuário só enxerga os próprios dados (Row Level Security).

create extension if not exists "pgcrypto";

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('receita','despesa')),
  cor text not null default '#2563eb',
  orcamento numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente','poupanca','carteira','investimento','a_receber')),
  saldo_inicial numeric(14,2) not null default 0,
  saldo_em timestamptz,
  cor text not null default '#2563eb',
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  limite numeric(14,2) not null default 0,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  cor text not null default '#1b1b1d',
  conta_id uuid references contas on delete set null,
  arquivado boolean not null default false,
  ajuste_limite numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists recorrentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  descricao text not null,
  valor numeric(14,2) not null,
  tipo text not null check (tipo in ('receita','despesa')),
  dia int not null check (dia between 1 and 31),
  categoria_id uuid references categorias on delete set null,
  conta_id uuid references contas on delete set null,
  cartao_id uuid references cartoes on delete set null,
  inicio text not null,            -- 'YYYY-MM'
  fim text,                        -- 'YYYY-MM' ou null (sem fim)
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists transacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  descricao text not null,
  valor numeric(14,2) not null,
  tipo text not null check (tipo in ('receita','despesa','transferencia','pagamento_fatura')),
  data date not null,
  categoria_id uuid references categorias on delete set null,
  conta_id uuid references contas on delete set null,
  conta_destino_id uuid references contas on delete set null,
  cartao_id uuid references cartoes on delete cascade,
  fatura text,                     -- 'YYYY-MM' (mês de vencimento da fatura)
  pago boolean not null default true,
  parcela int,
  parcelas int,
  grupo uuid,
  recorrente_id uuid references recorrentes on delete set null,
  competencia text,                -- 'YYYY-MM' (para contas fixas)
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  alvo numeric(14,2) not null default 0,
  atual numeric(14,2) not null default 0,
  prazo date,
  cor text not null default '#16a34a',
  created_at timestamptz not null default now()
);

create index if not exists transacoes_user_data on transacoes (user_id, data);
create index if not exists transacoes_user_fatura on transacoes (user_id, cartao_id, fatura);

do $$
declare t text;
begin
  foreach t in array array['categorias','contas','cartoes','recorrentes','transacoes','metas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dono" on %I', t);
    execute format('create policy "dono" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- não permite categorias repetidas (mesmo nome e tipo)
create unique index if not exists categorias_nome_unico on categorias (user_id, tipo, lower(trim(nome)));
