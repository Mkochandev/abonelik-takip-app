-- Servis logoları (Logo.dev) için katalog alanları. domain, logonun
-- Logo.dev'den çekileceği alan adıdır (ör. netflix.com); logo_url doluysa
-- domain yerine doğrudan o görsel kullanılır.

alter table subscriptions_catalog
  add column domain text,
  add column logo_url text;
