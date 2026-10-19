-- Katalog keşfi (scripts/discover-catalog.mjs, admin paneli "Keşfi başlat" /
-- "Fiyatları bul"): web araması ile yeni servis/plan ve fiyat bulma.

-- 6 yeni kategori. Mevcut 10 kategorinin adı değişmez (dergi Kitap/Sesli
-- Kitap'a, şifre yöneticisi VPN/Güvenlik'e dahil). Liste
-- src/config/categories.js ile aynı olmalı.
alter table subscriptions_catalog drop constraint subscriptions_catalog_category_check;
alter table subscriptions_catalog add constraint subscriptions_catalog_category_check check (
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
    'Spor',
    'Eğitim/Dil',
    'Sağlık/Meditasyon',
    'Haber/Gazete',
    'Yazılım/Geliştirici',
    'Sosyal/Tanışma',
    'Diğer'
  )
);

-- price_confidence / price_evidence: fiyat bulma aşamasının güven düzeyi ve
-- sayfadaki fiyat cümlesinden kısa alıntı (bulunamadıysa sebebi).
-- pricing_url: keşifte bulunan resmi fiyat sayfası (source_url ise fiyatın
-- görüldüğü sayfa). popularity: Türkiye'deki tahmini yaygınlık.
-- source_tags: kaynak etiketleri ('ai-discovery', 'app-store-price');
-- source_note serbest not olarak kalır.
alter table subscriptions_catalog
  add column price_confidence text check (price_confidence in ('high', 'medium', 'low')),
  add column price_evidence text,
  add column pricing_url text,
  add column popularity text check (popularity in ('high', 'medium', 'low')),
  add column source_tags text[] not null default '{}';

-- Keşif / fiyat bulma çalıştırmaları: durum, harcanan arama ve token,
-- özet (eklenen/atlanan, kalan iş). Panel son çalıştırmaları buradan gösterir.
create table discovery_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('discover', 'prices')),
  mode text not null check (mode in ('sync', 'batch')),
  trigger text not null check (trigger in ('cli', 'admin')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'stopped', 'failed')),
  max_searches integer not null,
  searches_used integer not null default 0,
  fetches_used integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  batch_id text,
  progress jsonb,
  summary jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_discovery_runs_started_at on discovery_runs (started_at desc);
