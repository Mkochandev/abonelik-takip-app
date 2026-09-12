# Veritabanı Şeması

Bu klasör, Supabase (Postgres) için SQL migration dosyalarını içerir. Henüz bir Supabase projesine bağlanılmadı — bu sadece şema tanımıdır.

## Tablolar

- `users` — uygulama kullanıcıları
- `subscriptions_catalog` — takip edilebilen abonelik servisleri ve güncel fiyatları (AI ile güncellenecek)
- `price_history` — katalogdaki fiyat değişikliklerinin geçmişi
- `user_subscriptions` — bir kullanıcının hangi abonelik(ler)e sahip olduğu
- `transactions` — kullanıcının gelir/gider kayıtları

## Uygulama

Supabase projesi kurulduğunda, `migrations/` altındaki dosyalar sırasıyla Supabase SQL Editor'de veya `supabase db push` ile çalıştırılabilir.
