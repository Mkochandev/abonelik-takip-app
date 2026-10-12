# Görev: Supabase'den çıkış, kendi Postgres'imiz ve kendi giriş sistemimiz

Backend şu an Supabase'e bağlı: veritabanı Supabase Postgres, giriş sistemi Supabase Auth (`@supabase/supabase-js`, `auth.users`, `auth.uid()` kullanan RLS politikaları). Bunu tamamen bırakıyoruz.

Yeni ortam: Hetzner'de Ubuntu 24.04 (arm64) üzerinde **PostgreSQL 17**. Veritabanları `eriste` (canlı) ve `eriste_dev` (geliştirme), kullanıcı `eriste_app`. Postgres sadece localhost'ta dinliyor; geliştirmede SSH tüneliyle bağlanacağım (`localhost:5433`).

Supabase şemasının dökümü: `backend/db/legacy/supabase_public_schema.sql`. Veri ve kullanıcılar sunucuda duruyor (`~/goc/public.dump` pg_dump custom format, `~/goc/auth_users.csv`: id, email, encrypted_password, email_confirmed_at, created_at). Şu an 3 kullanıcı ve 86 katalog kaydı var.

## Çalışma şekli

1. Önce kodu incele ve raporla: Supabase'in kullanıldığı her yer (backend ve mobil; `supabase-js`, `auth.uid()`, RLS, Supabase'e özgü fonksiyonlar, `auth.users`'a referans veren FK'lar), mevcut auth endpoint'lerinin yolları ve cevap biçimleri, mobilde token'ın nerede ve nasıl saklandığı. Plan yaz, **onayımı bekle**.
2. Aşağıdaki fazları sırayla uygula; her fazın sonunda dur, değişen dosyaları ve test komutlarını yaz.
3. Gizli bilgi (şifre, JWT secret, bağlantı adresi) koda ya da repoya girmez; `.env.example`'da sadece değişken adları.
4. Commit atma.

## Faz A: Şema ve migration altyapısı

- `backend/db/migrations/` altında yeni bir **baseline**: `supabase_public_schema.sql`'den türet, ama:
  - Supabase'e özgü her şeyi çıkar: `auth` şemasına referanslar, `auth.uid()` kullanan RLS politikaları, `ENABLE ROW LEVEL SECURITY`, `supabase_*` rolleri/GRANT'ler, Supabase eklentileri (gerekmiyorsa).
  - Yeni `users` tablosu: `id uuid PK DEFAULT gen_random_uuid()`, `email citext UNIQUE NOT NULL`, `password_hash text NOT NULL`, `email_verified_at timestamptz NULL`, `created_at`, `updated_at`. (`citext` eklentisini aç.)
  - `auth.users(id)`'e giden bütün FK'lar `users(id) ON DELETE CASCADE` olsun.
  - `refresh_tokens(id, user_id FK CASCADE, token_hash text UNIQUE, expires_at, created_at, revoked_at NULL, replaced_by NULL)`.
  - `password_reset_tokens(id, user_id FK CASCADE, token_hash UNIQUE, expires_at, used_at NULL, created_at)`.
  - Mevcut 0001–0010 migration'larının bugünkü son hâlini yansıtsın (hepsi zaten Supabase'de uygulanmış durumda; döküm bunun kanıtı).
- Basit bir migration çalıştırıcı: `npm run migrate` → `schema_migrations` tablosuna bakar, uygulanmamış dosyaları sırayla, her birini transaction içinde çalıştırır. Eski Supabase migration dosyalarını `backend/db/legacy/migrations/` altına taşı (silme).

## Faz B: Veri aktarımı scripti

`backend/scripts/import-from-supabase.sh` (sunucuda çalışacak), parametre olarak hedef veritabanı adını alsın (`eriste_dev` ya da `eriste`):
1. `auth_users.csv`'yi geçici tabloya yükle, `users`'a aynı `id`, küçük harfe çevrilmiş `email`, `encrypted_password` → `password_hash`, `email_confirmed_at` → `email_verified_at`, `created_at` ile ekle.
2. `public.dump`'tan **sadece veri** (`pg_restore --data-only --no-owner --disable-triggers` gerekiyorsa) ile tabloları doldur; FK sırasına dikkat et. Uymayan/çıkarılmış tablolar varsa onları atla ve raporla.
3. Sequence'leri (`setval`) güncelle.
4. Sonda tablo başına satır sayılarını yazdır (Supabase'deki sayılarla karşılaştıracağım).
Script tekrar çalıştırılabilir olsun (önce hedef tabloları boşaltıp yeniden doldurur; `--yes` olmadan canlı veritabanında çalışmaz).

## Faz C: Kendi giriş sistemimiz (backend)

- Şifreler: **bcrypt** (Supabase hash'leri `$2a$`/`$2b$` bcrypt; mevcut kullanıcılar aynı şifreyle girebilmeli). `bcryptjs` kullan (arm64'te native derleme derdi olmasın), maliyet 12. Şifre en az 8 karakter.
- Token'lar:
  - **Access token**: JWT (HS256, `JWT_SECRET`), 15 dakika, içinde sadece `sub` (user id).
  - **Refresh token**: 32 byte rastgele, veritabanında **hash'i** tutulur, 60 gün, her kullanımda **rotasyon** (eskisi iptal, yenisi verilir); iptal edilmiş bir token tekrar kullanılırsa o kullanıcının tüm refresh token'larını iptal et.
- Endpoint'ler: mevcut yolları ve cevap biçimlerini mümkün olduğunca koru (mobil az değişsin). Gerekenler: kayıt, giriş, çıkış (refresh token'ı iptal), `me`, **`POST /api/auth/refresh`**, **`POST /api/auth/forgot-password`**, **`POST /api/auth/reset-password`**, **`DELETE /api/auth/me`** (hesabı ve tüm verisini siler; Apple 5.1.1 zorunluluğu).
- Şifre sıfırlama: 32 byte token, hash'i saklanır, 1 saat geçerli, tek kullanımlık. E-posta gönderimi bir `mailer` modülü arkasında: `RESEND_API_KEY` varsa Resend ile gönderir, yoksa (geliştirme) linki loga yazar. Link: `https://eriste.app/sifre-sifirla?token=...` (sayfayı sonra yapacağız). "Bu e-posta kayıtlı değil" gibi bilgi sızdırma; her durumda aynı cevap.
- Auth middleware: Supabase `getUser` yerine JWT doğrulama → `req.user.id`.
- **RLS yok**: tek uygulama rolü kullanılıyor; bu yüzden **her sorguda `user_id` filtresini** kontrol et. Kullanıcı verisine dokunan tüm endpoint'leri tek tek gözden geçir ve listele.
- Güvenlik: auth endpoint'lerinde rate limit (`express-rate-limit`; giriş ve şifre sıfırlamada IP + e-posta başına), e-postaları küçük harfe çevir, hata mesajları genel olsun, `helmet`, JSON body boyut sınırı. Admin paneli `ADMIN_SECRET` ile kalsın.
- `@supabase/supabase-js` ve tüm `SUPABASE_*` değişkenlerini kaldır. Yeni `.env` değişkenleri: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY` (opsiyonel), `APP_BASE_URL`, mevcut diğerleri.

## Faz D: Mobil

- Supabase istemcisi mobilde kullanılıyorsa kaldır; giriş/kayıt backend endpoint'leri üzerinden.
- Token saklama: **`expo-secure-store`** (Keychain). Native paket olduğu için yeni build gerekecek; bitince hatırlat.
- API istemcisi: istekte access token; **401 gelirse bir kez refresh dene, başarılıysa isteği tekrarla**, değilse oturumu kapatıp giriş ekranına dön. Aynı anda birden fazla 401'de tek refresh isteği (kilit/kuyruk).
- "Şifremi unuttum" artık aktif: e-posta girilir → "Eğer bu e-postayla bir hesap varsa sıfırlama bağlantısı gönderdik." mesajı.
- Profil'de **"Hesabımı sil"**: Kıvırık'ın onay sorusu ("Bütün aboneliklerin ve hesabın silinecek. Emin misin?"), ardından `DELETE /api/auth/me`, oturum kapatma ve cihazdaki verilerin temizlenmesi. Premium aboneliğin App Store'dan ayrıca iptal edilmesi gerektiğini belirt ve "Aboneliği yönet" linkini göster.
- Misafir modu ve hesaba aktarım akışı aynen çalışmalı.

## Bitince

- Değişen/yeni dosyalar, yeni bağımlılıklar.
- Sunucuda çalıştırılacak komutlar sırasıyla: `npm run migrate` (eriste_dev), import scripti, sayı karşılaştırması.
- Test listesi: mevcut 3 kullanıcıdan biriyle eski şifreyle giriş, kayıt, refresh (access token süresini test için kısaltma seçeneği), çıkış, şifre sıfırlama (log'daki linkle), hesap silme ve verinin gerçekten silinmesi, başka kullanıcının aboneliğine erişememe, rate limit, misafir → hesap aktarımı.
