-- Premium üyelik alanları. plan ve premium_expires_at yalnızca backend
-- tarafından (service_role veya doğrudan Postgres bağlantısı üzerinden)
-- yazılmalı; authenticated rolünün PostgREST üzerinden bu kolonlara
-- yazabilmesi güvenlik açığı olur.

alter table users add column plan text not null default 'free' check (plan in ('free', 'premium'));
alter table users add column premium_expires_at timestamptz;

-- Mevcut users_update_own politikası satır bazında auth.uid() = id
-- kontrolü yapıyor ama hangi kolonların güncellenebileceğini kısıtlamıyor.
-- Kolon bazlı yetkiyle authenticated rolünün UPDATE ile dokunabileceği
-- alanları email ile sınırlıyoruz; plan/premium_expires_at (ve id/created_at)
-- bu roldeki hiçbir kullanıcı tarafından değiştirilemez.
revoke update on public.users from authenticated;
grant update (email) on public.users to authenticated;
