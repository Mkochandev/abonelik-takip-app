-- Row Level Security politikaları.
--
-- Not: policy'ler auth.uid() = user_id/id karşılaştırması yapıyor, bu yüzden
-- users.id, Supabase Auth kullanıcısının id'siyle (auth.uid()) eşleşmek
-- zorunda. Bunu garanti altına almak için users.id, auth.users(id)'ye
-- referans verecek şekilde güncellendi.
alter table users
  add constraint users_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- users -------------------------------------------------------------------
-- Kullanıcı yalnızca kendi kaydını görebilir ve güncelleyebilir.
alter table users enable row level security;

create policy users_select_own
  on users for select
  using (auth.uid() = id);

create policy users_update_own
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_subscriptions --------------------------------------------------------
-- Kullanıcı yalnızca kendi user_id'siyle eşleşen kayıtları görebilir,
-- ekleyebilir ve silebilir.
alter table user_subscriptions enable row level security;

create policy user_subscriptions_select_own
  on user_subscriptions for select
  using (auth.uid() = user_id);

create policy user_subscriptions_insert_own
  on user_subscriptions for insert
  with check (auth.uid() = user_id);

create policy user_subscriptions_delete_own
  on user_subscriptions for delete
  using (auth.uid() = user_id);

-- transactions ----------------------------------------------------------
-- Kullanıcı yalnızca kendi user_id'siyle eşleşen kayıtları görebilir,
-- ekleyebilir ve silebilir.
alter table transactions enable row level security;

create policy transactions_select_own
  on transactions for select
  using (auth.uid() = user_id);

create policy transactions_insert_own
  on transactions for insert
  with check (auth.uid() = user_id);

create policy transactions_delete_own
  on transactions for delete
  using (auth.uid() = user_id);

-- subscriptions_catalog -----------------------------------------------
-- Herkes okuyabilir. Yazma işlemleri yalnızca backend'in kullandığı
-- service_role anahtarıyla yapılır; service_role RLS'i tamamen bypass
-- ettiği için insert/update/delete policy'si tanımlanmadı -- bu da
-- authenticated/anon rollerinin bu tabloya hiçbir şey yazamayacağı
-- anlamına gelir.
alter table subscriptions_catalog enable row level security;

create policy subscriptions_catalog_select_public
  on subscriptions_catalog for select
  using (true);

-- price_history --------------------------------------------------------
-- Herkes okuyabilir. Yazma yalnızca service_role ile yapılır (yukarıdaki
-- subscriptions_catalog notuyla aynı gerekçe).
alter table price_history enable row level security;

create policy price_history_select_public
  on price_history for select
  using (true);
