-- user_subscriptions ve transactions tablolarına istemci (authenticated/anon)
-- tarafından doğrudan PostgREST üzerinden yazılmasını engeller.
--
-- Tüm yazma işlemleri backend üzerinden (doğrudan Postgres bağlantısı ile)
-- yapılıyor; bu nedenle backend etkilenmez. İstemcinin doğrudan yazabilmesi
-- backend'deki doğrulamaları (plan limitleri vb.) atlamasına izin veriyordu.
-- Yalnızca kendi kayıtlarını okuma (select) politikası kalır.

-- user_subscriptions -----------------------------------------------------
drop policy if exists user_subscriptions_insert_own on public.user_subscriptions;
drop policy if exists user_subscriptions_delete_own on public.user_subscriptions;

revoke insert, update, delete on public.user_subscriptions from authenticated, anon;

-- transactions (şu an kullanılmıyor) --------------------------------------
drop policy if exists transactions_insert_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;

revoke insert, update, delete on public.transactions from authenticated, anon;
