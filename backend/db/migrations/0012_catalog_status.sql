-- Admin onaylı katalog genişletme.
--
-- status: draft (toplu eklenen, onay bekliyor) | active (mobilde görünür) |
--         hidden (admin gizledi). Mevcut kayıtların hepsi active.
-- price_status: unverified (fiyat tarayıcının bulduğu, onaylanmadı) |
--               verified (admin onayladı ya da elle girildi).
-- source_note: fiyatın nereden/nasıl bulunduğuna dair not (tarayıcı güveni,
--              para birimi uyuşmazlığı, sayfa alınamadı vb.).

alter table subscriptions_catalog
  add column status text not null default 'active'
    check (status in ('draft', 'active', 'hidden')),
  add column price_status text not null default 'unverified'
    check (price_status in ('unverified', 'verified')),
  add column source_note text;

-- Elle girilmiş mevcut fiyatlar doğrulanmış sayılır; -1 yer tutucular değil.
update subscriptions_catalog set price_status = 'verified' where current_price >= 0;

-- Taslaklar fiyatsız eklenir (fiyatı tarayıcı bulur, admin onaylar).
-- Fiyatsız kayıt yayına alınamaz.
alter table subscriptions_catalog alter column current_price drop not null;

alter table subscriptions_catalog
  add constraint subscriptions_catalog_active_needs_price_check
  check (status <> 'active' or current_price is not null);

create index idx_subscriptions_catalog_status on subscriptions_catalog (status);

-- Yeni kategoriler.
alter table subscriptions_catalog drop constraint subscriptions_catalog_category_check;

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
      'Oyun',
      'Alışveriş/Üyelik',
      'VPN/Güvenlik',
      'Spor'
    )
  );
