-- İlk şema: kullanıcılar, abonelik kataloğu, fiyat geçmişi,
-- kullanıcı abonelikleri ve gelir/gider işlemleri.

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table subscriptions_catalog (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,
  plan_name text,
  current_price numeric(10, 2) not null,
  currency text not null default 'TRY',
  source_url text,
  last_checked_at timestamptz
);

create table price_history (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  price numeric(10, 2) not null,
  changed_at timestamptz not null default now()
);

create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  started_at timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10, 2) not null,
  category text,
  description text,
  date date not null default current_date
);

create index idx_price_history_catalog_id on price_history (catalog_id);
create index idx_user_subscriptions_user_id on user_subscriptions (user_id);
create index idx_user_subscriptions_catalog_id on user_subscriptions (catalog_id);
create index idx_transactions_user_id on transactions (user_id);
create index idx_transactions_date on transactions (date);
