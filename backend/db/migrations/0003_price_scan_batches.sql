-- Haftalık fiyat taramasının Message Batch'leri (priceScanner.js). Sonuç 24
-- saate kadar sürebildiği için batch id'si burada tutulur; backend tarama
-- sırasında yeniden başlarsa açılışta 'pending' kayıtların sonuçları alınıp
-- işlenir. catalog_ids: batch'e giden katalog kayıtları (custom_id'ler).
create table price_scan_batches (
  id text primary key,
  catalog_ids uuid[] not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
