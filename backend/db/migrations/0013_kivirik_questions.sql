-- Kıvırık soru sistemi (Faz 1).
--
-- Sorular cron ile değil, istemci sorduğunda (Kıvırık'a dokununca / rozet
-- için uygulama açılınca) anlık hesaplanır. Bu tablolar yalnızca verilen
-- cevapları ve ertelemeleri tutar. Soru metinleri ve koşulları kodda.
-- Tüm yazmalar backend üzerinden (doğrudan Postgres bağlantısı) yapılır;
-- istemci rolleri yalnızca kendi satırlarını okuyabilir (bkz. 0008).

-- user_subscriptions: soruların doldurduğu alanlar ------------------------
-- Kullanıcıya özel fiyat için mevcut custom_price / custom_currency
-- kullanılır (0011); ayrı bir user_price kolonu yok.
alter table user_subscriptions
  add column payment_channel text
    check (payment_channel is null or payment_channel in
      ('app_store', 'google_play', 'web_card', 'operator', 'someone_else')),
  add column share_count smallint
    check (share_count is null or share_count between 1 and 20),
  add column is_trial boolean,
  add column trial_ends_at date,
  add column planned_end_at date,
  add column cancelled_at timestamptz;

-- Kullanım sıklığı dört seçeneğe geçer. Eski değerler eşlenir:
-- "Haftada birkaç" -> "Haftada birkaç kez", "Nadiren" -> "Neredeyse hiç".
alter table user_subscriptions drop constraint user_subscriptions_usage_frequency_check;

update user_subscriptions set usage_frequency = 'Haftada birkaç kez'
  where usage_frequency = 'Haftada birkaç';
update user_subscriptions set usage_frequency = 'Neredeyse hiç'
  where usage_frequency = 'Nadiren';

alter table user_subscriptions
  add constraint user_subscriptions_usage_frequency_check
  check (usage_frequency is null or usage_frequency in
    ('Her gün', 'Haftada birkaç kez', 'Ayda birkaç kez', 'Neredeyse hiç'));

-- Kullanıcı ayarları (kullanıcı başına bir satır) --------------------------
-- reminder_days_before: ödeme hatırlatması kaç gün önce (null = sorulmadı,
-- uygulama 1 gün varsayar). Hesaplı kullanıcıda cihaz yerine burada durur.
create table user_settings (
  user_id uuid primary key references users (id) on delete cascade,
  reminder_days_before smallint
    check (reminder_days_before is null or reminder_days_before in (0, 1, 3, 7)),
  is_student boolean,
  monthly_budget numeric(10, 2) check (monthly_budget is null or monthly_budget >= 0),
  updated_at timestamptz not null default now()
);

-- Kıvırık cevapları --------------------------------------------------------
-- period: tek seferlik sorularda 'once', periyodiklerde dönem anahtarı
-- (ör. '2026-10', '2026-Q4', 'price:<id>').
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

-- Ertelemeler: until null ise soru bir daha sorulmaz ("Bunu bir daha sorma").
create table kivirik_dismissals (
  user_id uuid not null references users (id) on delete cascade,
  question_key text not null,
  user_subscription_id uuid references user_subscriptions (id) on delete cascade,
  until timestamptz,
  created_at timestamptz not null default now(),
  constraint kivirik_dismissals_unique
    unique nulls not distinct (user_id, user_subscription_id, question_key)
);

-- Kullanıcının "fiyat yanlış" bildirimleri (admin: Şüpheli fiyatlar).
create table price_reports (
  id bigserial primary key,
  catalog_id uuid not null references subscriptions_catalog (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  reported_price numeric(10, 2) not null check (reported_price > 0),
  created_at timestamptz not null default now()
);

create index idx_price_reports_catalog_id on price_reports (catalog_id);

-- Fiyat geçmişi: yeni fiyat ve kaynak. price, değişiklikten önceki fiyattır
-- (0001'den beri). Admin panelinden elle değişiklik de kayıt düşer.
alter table price_history
  add column new_price numeric(10, 2),
  add column source text not null default 'scanner' check (source in ('scanner', 'admin'));

-- RLS: kullanıcı yalnızca kendi satırlarını görür; yazma yalnızca backend.
alter table user_settings enable row level security;
create policy user_settings_select_own on user_settings for select using (auth.uid() = user_id);

alter table kivirik_answers enable row level security;
create policy kivirik_answers_select_own on kivirik_answers for select using (auth.uid() = user_id);

alter table kivirik_dismissals enable row level security;
create policy kivirik_dismissals_select_own on kivirik_dismissals for select using (auth.uid() = user_id);

alter table price_reports enable row level security;
create policy price_reports_select_own on price_reports for select using (auth.uid() = user_id);

revoke insert, update, delete on user_settings, kivirik_answers, kivirik_dismissals, price_reports
  from authenticated, anon;
