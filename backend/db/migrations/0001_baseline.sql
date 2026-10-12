-- Baseline: Supabase'den çıkış sonrası şema.
--
-- Supabase'de uygulanmış eski 0001–0013 migration'larının (bkz.
-- db/legacy/migrations/) bugünkü son hâli; kaynak, Supabase'in public şema
-- dökümü (db/legacy/supabase_public_schema.sql). Supabase'e özgü her şey
-- çıkarıldı: auth şeması referansları, auth.users senkron trigger'ı, RLS
-- politikaları, authenticated/anon rol yetkileri.
--
-- RLS yok: backend tek bir uygulama rolüyle bağlanır. Kullanıcı verisine
-- dokunan her sorgu user_id filtresini kendisi uygular.
--
-- Giriş sistemi artık bizde: users.password_hash (bcrypt), refresh_tokens
-- ve password_reset_tokens (token'ların yalnızca hash'i saklanır).

create extension if not exists citext;

-- updated_at kolonunu her UPDATE'te tazeler.
create function set_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- users -------------------------------------------------------------------
-- plan / premium_expires_at yalnızca backend yazar (RevenueCat webhook ve
-- sync). eriste_dismissed: kullanıcı erişte Premium'u listesinden sildi.
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  premium_expires_at timestamptz,
  eriste_dismissed boolean not null default false
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Oturum yenileme token'ları. Her kullanımda rotasyon: eskisi revoked_at
-- ile iptal edilir, replaced_by yenisini gösterir. İptal edilmiş bir token
-- tekrar gelirse kullanıcının tüm token'ları iptal edilir.
create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  replaced_by uuid references refresh_tokens (id) on delete set null
);

create index idx_refresh_tokens_user_id on refresh_tokens (user_id);

-- Şifre sıfırlama token'ları: tek kullanımlık (used_at), kısa ömürlü.
create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_password_reset_tokens_user_id on password_reset_tokens (user_id);

-- subscriptions_catalog ---------------------------------------------------
-- status: draft (onay bekliyor) | active (mobilde görünür) | hidden.
-- price_status: unverified (tarayıcının bulduğu) | verified (admin onayladı).
-- managed_by: 'revenuecat' ise kayıt uygulama tarafından yönetilir
-- (erişte Premium); herkese açık katalogda listelenmez.
create table subscriptions_catalog (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,
  plan_name text,
  current_price numeric(10, 2),
  currency text not null default 'TRY',
  source_url text,
  last_checked_at timestamptz,
  category text check (
    category in (
      'Video/Dizi-Film',
      'Müzik',
      'Kitap/Sesli Kitap',
      'Yapay Zeka',
      'Bulut Depolama',
      'Üretkenlik/Tasarım',
      'Oyun',
      'Alışveriş/Üyelik',
      'VPN/Güvenlik',
      'Spor'
    )
  ),
  cancel_url text,
  domain text,
  logo_url text,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  managed_by text check (managed_by is null or managed_by in ('revenuecat')),
  status text not null default 'active' check (status in ('draft', 'active', 'hidden')),
  price_status text not null default 'unverified'
    check (price_status in ('unverified', 'verified')),
  source_note text,
  constraint subscriptions_catalog_active_needs_price_check
    check (status <> 'active' or current_price is not null)
);

create index idx_subscriptions_catalog_category on subscriptions_catalog (category);
create index idx_subscriptions_catalog_status on subscriptions_catalog (status);

-- price_history: price değişiklikten önceki, new_price sonraki fiyat.
create table price_history (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  price numeric(10, 2) not null,
  changed_at timestamptz not null default now(),
  new_price numeric(10, 2),
  source text not null default 'scanner' check (source in ('scanner', 'admin'))
);

create index idx_price_history_catalog_id on price_history (catalog_id);

-- user_subscriptions ------------------------------------------------------
-- custom_price/custom_currency doluysa katalog fiyatının yerine geçer.
-- billing_month yalnızca yıllık planlarda, billing_date ile birlikte.
create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  started_at timestamptz not null default now(),
  usage_frequency text check (
    usage_frequency is null or usage_frequency in
      ('Her gün', 'Haftada birkaç kez', 'Ayda birkaç kez', 'Neredeyse hiç')
  ),
  price_alert_enabled boolean not null default true,
  billing_date integer check (billing_date is null or (billing_date between 1 and 31)),
  reason text,
  billing_month integer check (billing_month is null or (billing_month between 1 and 12)),
  custom_price numeric(10, 2),
  custom_currency text,
  payment_channel text check (
    payment_channel is null or payment_channel in
      ('app_store', 'google_play', 'web_card', 'operator', 'someone_else')
  ),
  share_count smallint check (share_count is null or share_count between 1 and 20),
  is_trial boolean,
  trial_ends_at date,
  planned_end_at date,
  cancelled_at timestamptz,
  unique (user_id, catalog_id),
  constraint user_subscriptions_billing_month_needs_day_check
    check (billing_month is null or billing_date is not null)
);

create index idx_user_subscriptions_user_id on user_subscriptions (user_id);
create index idx_user_subscriptions_catalog_id on user_subscriptions (catalog_id);

-- transactions (şu an kullanılmıyor) ---------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10, 2) not null,
  category text,
  description text,
  date date not null default current_date
);

create index idx_transactions_user_id on transactions (user_id);
create index idx_transactions_date on transactions (date);

-- user_settings: kullanıcı başına bir satır --------------------------------
create table user_settings (
  user_id uuid primary key references users (id) on delete cascade,
  reminder_days_before smallint
    check (reminder_days_before is null or reminder_days_before in (0, 1, 3, 7)),
  is_student boolean,
  monthly_budget numeric(10, 2) check (monthly_budget is null or monthly_budget >= 0),
  updated_at timestamptz not null default now()
);

-- Kıvırık cevapları ve ertelemeleri ----------------------------------------
create table kivirik_answers (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  user_subscription_id uuid references user_subscriptions (id) on delete cascade,
  question_key text not null,
  period text not null,
  answer text not null,
  value text,
  created_at timestamptz not null default now(),
  constraint kivirik_answers_unique
    unique nulls not distinct (user_id, user_subscription_id, question_key, period)
);

create index idx_kivirik_answers_user_id on kivirik_answers (user_id);

create table kivirik_dismissals (
  user_id uuid not null references users (id) on delete cascade,
  question_key text not null,
  user_subscription_id uuid references user_subscriptions (id) on delete cascade,
  until timestamptz,
  created_at timestamptz not null default now(),
  constraint kivirik_dismissals_unique
    unique nulls not distinct (user_id, user_subscription_id, question_key)
);

-- Kullanıcıların "fiyat yanlış" bildirimleri.
create table price_reports (
  id bigserial primary key,
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  reported_price numeric(10, 2) not null check (reported_price > 0),
  created_at timestamptz not null default now()
);

create index idx_price_reports_catalog_id on price_reports (catalog_id);

-- erişte Premium katalog kayıtları (eski 0011). Fiyat RevenueCat'ten gelir;
-- current_price yalnızca 'active' kısıtı için 0'dır. Veri aktarımı
-- (scripts/import-from-supabase.sh) kataloğu Supabase'deki hâliyle
-- yeniden doldurur; bu satırlar boş bir veritabanı içindir.
insert into subscriptions_catalog
  (app_name, plan_name, current_price, currency, billing_cycle, category, domain, logo_url,
   cancel_url, managed_by, price_status)
values
  ('erişte', 'Premium Aylık', 0, 'TRY', 'monthly', 'Üretkenlik/Tasarım', 'eriste.app',
   'https://abonelik-api.gaziustam.com/brand/eriste-gece.png',
   'https://apps.apple.com/account/subscriptions', 'revenuecat', 'verified'),
  ('erişte', 'Premium Yıllık', 0, 'TRY', 'yearly', 'Üretkenlik/Tasarım', 'eriste.app',
   'https://abonelik-api.gaziustam.com/brand/eriste-gece.png',
   'https://apps.apple.com/account/subscriptions', 'revenuecat', 'verified');
