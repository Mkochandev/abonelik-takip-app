-- subscriptions_catalog tablosuna kategori kolonu ekler ve mevcut
-- kayıtları kategorilerine göre günceller.

alter table subscriptions_catalog add column category text;

alter table subscriptions_catalog
  add constraint subscriptions_catalog_category_check
  check (
    category in (
      'Video/Dizi-Film',
      'Müzik',
      'Kitap/Sesli Kitap',
      'Yapay Zeka',
      'Bulut Depolama',
      'Üretkenlik/Tasarım',
      'Spor'
    )
  );

create index idx_subscriptions_catalog_category on subscriptions_catalog (category);

-- Mevcut 31 kaydı app_name'e göre kategorilere eşle.

-- Video/Dizi-Film: Netflix, Disney+, Exxen, HBO Max
update subscriptions_catalog set category = 'Video/Dizi-Film'
  where app_name in ('Netflix', 'Disney+', 'Exxen', 'HBO Max');

-- Müzik: Spotify, YouTube Premium
update subscriptions_catalog set category = 'Müzik'
  where app_name in ('Spotify', 'YouTube Premium');

-- Kitap/Sesli Kitap: Storytel
update subscriptions_catalog set category = 'Kitap/Sesli Kitap'
  where app_name in ('Storytel');

-- Yapay Zeka: ChatGPT Plus, Claude Pro
update subscriptions_catalog set category = 'Yapay Zeka'
  where app_name in ('ChatGPT Plus', 'Claude Pro');

-- Bulut Depolama: iCloud+, Google One
update subscriptions_catalog set category = 'Bulut Depolama'
  where app_name in ('iCloud+', 'Google One');

-- Üretkenlik/Tasarım: Adobe Creative Cloud, Canva Pro, Microsoft 365
update subscriptions_catalog set category = 'Üretkenlik/Tasarım'
  where app_name in ('Adobe Creative Cloud', 'Canva Pro', 'Microsoft 365');

-- Spor: TABii Spor
update subscriptions_catalog set category = 'Spor'
  where app_name in ('TABii Spor');
