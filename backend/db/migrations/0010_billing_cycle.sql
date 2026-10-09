-- Ödeme günü ve plan dönemi.
--
-- user_subscriptions.billing_date (0006) ayın gününü (1–31) tutar. Yıllık
-- planlarda bir sonraki ödeme tarihini hesaplayabilmek için ay da gerekir;
-- bu yüzden billing_month (1–12) eklenir. Ayın 29–31'i olmayan aylarda
-- ödeme ayın son günü kabul edilir (hesap istemcide yapılır).
--
-- Plan dönemi (aylık/yıllık) katalog kaydına aittir: mevcut kayıtların hepsi
-- aylık faturalanır (Adobe'nin "Yıllık Taahhüt, Aylık Ödeme" planı da aylık
-- ödenir).

alter table subscriptions_catalog
  add column billing_cycle text not null default 'monthly'
  check (billing_cycle in ('monthly', 'yearly'));

alter table user_subscriptions add column billing_month integer;

alter table user_subscriptions
  add constraint user_subscriptions_billing_month_check
  check (billing_month is null or (billing_month between 1 and 12));

-- Ay, gün olmadan anlamsız.
alter table user_subscriptions
  add constraint user_subscriptions_billing_month_needs_day_check
  check (billing_month is null or billing_date is not null);
