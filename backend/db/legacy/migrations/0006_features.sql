-- Katalog kayıtlarına iptal linki, kullanıcı aboneliklerine ise kullanım
-- sıklığı, fiyat alarmı tercihi ve fatura günü bilgisi ekler.

alter table subscriptions_catalog add column cancel_url text;

alter table user_subscriptions add column usage_frequency text;

alter table user_subscriptions
  add constraint user_subscriptions_usage_frequency_check
  check (usage_frequency is null or usage_frequency in ('Her gün', 'Haftada birkaç', 'Nadiren'));

alter table user_subscriptions add column price_alert_enabled boolean not null default true;

alter table user_subscriptions add column billing_date integer;

alter table user_subscriptions
  add constraint user_subscriptions_billing_date_check
  check (billing_date is null or (billing_date between 1 and 31));
