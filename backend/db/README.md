# Veritabanı

PostgreSQL 17 (Hetzner, kendi sunucumuz). Veritabanları: `eriste` (canlı) ve
`eriste_dev` (geliştirme); uygulama rolü `eriste_app`. Bağlantı adresi
`DATABASE_URL` ortam değişkeninden okunur.

## Migration'lar

`migrations/` altındaki `NNNN_ad.sql` dosyaları ad sırasıyla uygulanır:

```sh
npm run migrate              # uygulanmamışları uygula
npm run migrate -- --status  # yalnızca durumu göster
```

Çalıştırıcı (`scripts/migrate.js`) uygulananları `schema_migrations`
tablosunda tutar ve her dosyayı ayrı bir transaction içinde çalıştırır. Yeni
bir değişiklik için bir sonraki numarayla yeni dosya ekle; uygulanmış bir
dosyayı değiştirme.

`0001_baseline.sql`, Supabase'den çıkış sonrası tam şemadır.

## Tablolar

- `users`: kullanıcılar (e-posta, bcrypt şifre hash'i, plan)
- `refresh_tokens`, `password_reset_tokens`: oturum ve şifre sıfırlama token'larının hash'leri
- `subscriptions_catalog`: takip edilebilen servisler ve güncel fiyatları
- `price_history`: katalogdaki fiyat değişiklikleri
- `user_subscriptions`: kullanıcının takip ettiği abonelikler
- `user_settings`: kullanıcı başına ayarlar
- `kivirik_answers`, `kivirik_dismissals`: Kıvırık sorularının cevapları ve ertelemeleri
- `price_reports`: kullanıcıların "fiyat yanlış" bildirimleri
- `transactions`: gelir/gider kayıtları (şu an kullanılmıyor)

RLS yok: backend tek bir rolle bağlanır. Kullanıcı verisine dokunan her
sorgu `user_id` filtresini kendisi uygulamalıdır.

## Arşiv

- `legacy/supabase_public_schema.sql`: Supabase'in public şema dökümü (baseline'ın kaynağı)
- `legacy/migrations/`: Supabase döneminin 0001–0013 migration'ları (yalnızca referans, çalıştırılmaz)
