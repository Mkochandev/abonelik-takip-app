-- erişte Premium'un kullanıcının takip listesinde görünmesi.
--
-- managed_by: kaydın fiyatı ve kullanıcıya eklenmesi uygulama tarafından
-- yönetilir ('revenuecat'). Bu kayıtlar herkese açık katalogda listelenmez,
-- fiyat tarayıcı tarafından atlanır ve ücretsiz plan limitine sayılmaz.
alter table subscriptions_catalog
  add column managed_by text
  check (managed_by is null or managed_by in ('revenuecat'));

-- Kullanıcıya özel fiyat: erişte Premium'da App Store'un kullanıcıya
-- gösterdiği fiyat (product.price / currencyCode). Doluysa katalog fiyatının
-- yerine geçer.
alter table user_subscriptions
  add column custom_price numeric(10, 2),
  add column custom_currency text;

-- Kullanıcı erişte'yi listesinden kendisi sildiyse tekrar eklenmez.
-- (0007'deki kolon bazlı yetki nedeniyle istemci bu alanı yazamaz; yalnızca
-- backend yazar.)
alter table users add column eriste_dismissed boolean not null default false;

-- Katalog girdileri. Fiyat RevenueCat'ten gelir; katalogdaki current_price
-- yalnızca not null kısıtı için 0'dır ve gösterilmez. Logo yerel/backend
-- asset'i (gece varyantı), Logo.dev değil.
insert into subscriptions_catalog
  (app_name, plan_name, current_price, currency, billing_cycle, category, domain, logo_url,
   cancel_url, managed_by)
select v.app_name, v.plan_name, 0, 'TRY', v.billing_cycle, 'Üretkenlik/Tasarım', 'eriste.app',
       'https://abonelik-api.gaziustam.com/brand/eriste-gece.png',
       'https://apps.apple.com/account/subscriptions', 'revenuecat'
from (values
  ('erişte', 'Premium Aylık', 'monthly'),
  ('erişte', 'Premium Yıllık', 'yearly')
) as v (app_name, plan_name, billing_cycle)
where not exists (
  select 1 from subscriptions_catalog sc
  where sc.app_name = v.app_name and sc.plan_name = v.plan_name
);
