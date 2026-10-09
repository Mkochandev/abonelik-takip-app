# Görev: Kıvırık soru sistemi

Kullanıcı sağ üstteki maskot Kıvırık'a dokununca Kıvırık "Dur, sana soracaklarım var!" desin ve aboneliklerdeki eksik bilgileri kart kart sorsun. Sorular tek seferlik, ayda/3 ayda bir ya da bir olay olunca (zam, deneme bitişi, iptal sonrası) sorulur. DB yükü düşük kalmalı: **cron yok**, sorular sadece Kıvırık'a dokunulunca ve rozet için uygulama açılınca hesaplanır.

Tasarım: tasarım panosunda "Kıvırık soruları" bölümü (K1 Rozet ve davet, K2 Sorular, K3 Zam anı, K4 Deneme bitiyor). Ölçü ve renkleri oradan birebir al; mevcut marka sistemi (Kıvırık balonu, Bricolage, ink/safran/biber, açık ve koyu tema) geçerli.

## Çalışma şekli

1. **Önce mevcut kodu incele.** Aşağıdaki maddelerden hangilerinin zaten var olduğunu, hangilerinin eksik olduğunu liste halinde raporla. **Ben onaylamadan kod yazma.**
2. Onaydan sonra eksikleri aşağıdaki **faz sırasıyla** uygula. Her fazın sonunda dur, değişen dosyaları ve test listesini yaz, onayımı bekle.
3. Mevcut iş mantığını bozma (misafir modu, 5 abonelik limiti, bulk endpoint, paywall, 1–3. bölümlerdeki ödeme günü, bildirimler, erişte Premium kaydı, katalog taslakları).
4. Veritabanı değişiklikleri yeni migration dosyaları olarak (sıradaki numaralar).
5. Commit atma.

## Varsayımlar

- **Misafir modunda Kıvırık soru sormaz.** Dokununca "Giriş yaparsan sana daha çok yardımcı olabilirim." der ve giriş ekranına yönlendirir. (Rozet de çıkmaz.)
- Bir seferde **en fazla 3 soru**. Her kartta **Geç** (7 gün sonra tekrar sorar) ve **Bunu bir daha sorma**.
- Soru metinleri, seçenekler, koşullar, öncelikler ve periyot tipleri **kodda bir config dosyasında** durur, DB'de değil.
- Tüm tarih hesapları **Europe/Istanbul** saat dilimine göre.
- **Türkçe ek sorunu:** "{servis}'ın" gibi şablonlar marka adlarında yanlış ek üretir. Servis adına asla ek getirme; adı kartın üstündeki şeritte göster, soru metnini eksiz yaz. Bu dosyadaki metinler buna göre yazıldı, aynen kullan.

---

## Faz 1: Çekirdek sistem + tek seferlik sorular

### 1.1 Config

Her soru için: `key`, metin, seçenekler, koşul fonksiyonu, öncelik (1 = ilk), kapsam (`subscription | user`), periyot tipi (`once | monthly | quarterly | event`). Metinler mobilde; backend yalnızca hangi sorunun sorulacağını ve metne girecek değerleri (`params`) hesaplar.

### 1.2 Veritabanı

- `kivirik_answers(id bigserial PK, user_id uuid NOT NULL, user_subscription_id FK NULL ON DELETE CASCADE, question_key text, period text, answer text, created_at timestamptz DEFAULT now())`
  `UNIQUE NULLS NOT DISTINCT (user_id, user_subscription_id, question_key, period)`. Bu kısıt Postgres 15+ ister; daha eski sürümde unique index'i `COALESCE(user_subscription_id, 0)` ile kur. (Supabase'den kendi sunucumuza geçeceğiz; orada da 15+ kullanacağız.)
- `kivirik_dismissals(user_id, question_key, user_subscription_id NULL, until timestamptz NULL)`. `until` NULL ise soru bir daha hiç sorulmaz. Aynı benzersizlik kuralı; tekrar "Geç" denince güncellensin (upsert).
- `user_subscriptions` yeni kolonlar: `payment_channel text` (`app_store | google_play | web_card | operator | someone_else`, CHECK ile), `user_price numeric(10,2) NULL`, `share_count smallint NULL` (1 = paylaşmıyor), `is_trial boolean NULL`, `trial_ends_at date NULL`, `planned_end_at date NULL`, `cancelled_at timestamptz NULL`.
- `user_settings` (tablo yoksa oluştur, kullanıcı başına bir satır): `reminder_days_before smallint NULL`, `is_student boolean NULL`, `monthly_budget numeric(10,2) NULL`. **2. bölümdeki "kaç gün önce hatırlat" ayarı nerede tutuluyorsa buraya taşı**; ayarlar ekranı ve bildirim planlaması bu alanı kullansın (varsayılan 1 gün).
- `price_reports(id, catalog_id, user_id, reported_price, created_at)`: kullanıcı "fiyat yanlış" dediğinde.
- Katalog: `cancel_url` alanı var mı ve admin panelinden düzenlenebiliyor mu, kontrol et; yoksa ekle.
- Supabase'te tüm yeni tablolara RLS: kullanıcı sadece kendi satırlarını görür.
- `plan_type` kolonu **ekleme**: kullanıcı abonelik eklerken plan seçmek zorunda, plan zaten katalog satırından geliyor.

### 1.3 Endpoint'ler (giriş gerekli)

- `GET /api/kivirik/questions` → bekleyen soruları anlık hesaplar; öncelik sırasıyla (aynı öncelikte pahalı abonelik önce) ilk 3'ü ve toplam bekleyen sayısını döner. Her soru: `key`, `user_subscription_id`, `period`, `params` (servis adı, plan, logo/domain, kategori, fiyat, eski/yeni fiyat, fark, yıllık tutar, deneme bitiş tarihi, eski ödeme günü vb.).
- `POST /api/kivirik/answers` → `{ key, user_subscription_id, period, answer, value }`. Tek transaction'da ilgili kolonu/ayarı günceller ve `kivirik_answers`'a yazar. Tek seferlik sorularda `period = 'once'`.
- `POST /api/kivirik/dismiss` → `{ key, user_subscription_id, mode: "later" | "never" }`. `later` = 7 gün sonra.

### 1.4 Tek seferlik sorular

| key | Kapsam | Metin | Seçenekler | Ne zaman | Öncelik |
| --- | --- | --- | --- | --- | --- |
| `billing_day` | abonelik | "Para ayın kaçında çekiliyor?" | Gün seçici (mevcut BillingDayPicker) / Bilmiyorum | Ödeme günü boş | 3 |
| `payment_channel` | abonelik | "Nereden ödüyorsun?" Not: "İptal etmek istersen doğru yere götürürüm." | App Store / Google Play / Sitesinden, kartla / Operatör faturası / Başkası ödüyor | Alan boş | 3 |
| `usage_frequency` | abonelik | "Ne sıklıkla açıyorsun?" | Her gün / Haftada birkaç kez / Ayda birkaç kez / Neredeyse hiç | Alan boş | 3 |
| `reminder_days_before` | kullanıcı | "Ödemeden ne kadar önce haber vereyim?" | Aynı gün / 1 gün / 3 gün / 1 hafta | Ayar boş | 3 |
| `price_confirm` | abonelik | "Senin için {fiyat} görünüyor. Doğru mu?" | Evet, doğru / Hayır, farklı ödüyorum (tutar girişi) | Henüz sorulmadı | 4 |
| `share_count` | abonelik | "Bunu biriyle paylaşıyor musun?" | Hayır / 2 kişi / 3-4 kişi / 5+ | Alan boş | 4 |
| `is_trial` | abonelik | "Bu şu an ücretsiz deneme mi?" | Hayır / Evet (bitiş tarihi seçilir) | Alan boş **ve** abonelik son 30 gün içinde eklendi | 4 |
| `planned_end` | abonelik | "Bunu belli bir süre için mi aldın?" | Hayır, sürekli / Evet (tarih seçilir) | Alan boş | 4 |
| `reason` | abonelik | Mevcut kategoriye özel "neden" sorusu | Mevcut seçenekler + serbest metin | Sadece eklerken atlandıysa | 4 |
| `is_student` | kullanıcı | "Öğrenci misin?" | Evet / Hayır | Ayar boş | 4 |
| `monthly_budget` | kullanıcı | "Aboneliklere aylık bir sınırın var mı?" | Yok / Tutar gir | Ayar boş | 4 |
| `store_check` | kullanıcı | "Telefonundaki aboneliklere bir bakalım mı? Eklemediğin kalmış olabilir." | Aboneliklerimi aç / Sonra | Bir kez; en az 1 aboneliği varken | 4 |

Kartın üstündeki şeritte servisin logosu, adı + planı ve fiyatı görünür; soru metni bu yüzden servis adını tekrar etmez.

### 1.5 Cevapların uygulamaya etkileri

- **user_price:** aylık toplam, kategori dağılımı, yaklaşan ödemeler, bildirimler ve USD→TRY hesabı `COALESCE(user_price, katalog fiyatı)` kullanır (backend ve mobilde aynı). "Hayır, farklı ödüyorum" cevabı `price_reports`'a da yazılır; admin panelinde "Şüpheli fiyatlar" listesi (katalog satırı, bildirilen tutarlar, adet, kaynak linki).
- **payment_channel = someone_else:** abonelik toplamlara katılmaz, listede "Başkası ödüyor" etiketiyle ayrı görünür, ödeme hatırlatması planlanmaz.
- **share_count > 1:** detay ekranında "Kişi başı {tutar}".
- **reminder_days_before:** bildirim planlaması bu ayarı kullanır (varsayılan 1 gün).
- **monthly_budget:** toplam bu sınırı aşınca ana ekranda Kıvırık uyarısı: "Bu ay aboneliklere {toplam} gidiyor, sınırın {sınır}. Gözden geçirelim mi?"
- **is_trial + trial_ends_at:** deneme bitişinden 2 gün önce yerel bildirim (2. bölümdeki altyapı): "{servis} denemen 2 gün sonra bitiyor." (servis adı ek almadığı için sorunsuz)
- **planned_end_at:** o gün yerel bildirim: "Bugün {servis} aboneliğini bırakmayı planlamıştın. İptal ettin mi?" Dokununca detay ekranı açılır.
- **store_check:** `Platform.OS`'a göre `Linking.openURL`: iOS `https://apps.apple.com/account/subscriptions`, Android `https://play.google.com/store/account/subscriptions`.

**Ortak iptal rehberi:** `payment_channel`'a göre yönlendirir: App Store / Google Play → mağaza abonelik sayfası; Sitesinden → katalogdaki `cancel_url`; Operatör → "Operatörünün uygulamasından veya müşteri hizmetlerinden iptal edebilirsin." bilgisi; kanal boşsa önce kanalı sorar. Kıvırık'ın "iptal" cevapları ve detay ekranındaki iptal butonu bunu kullanır.

### 1.6 Mobil

**K1 · Rozet ve davet (ana sayfa):**
- Bekleyen soru varsa Kıvırık butonunun sağ üstünde sayılı rozet: `#C8312A` zemin, beyaz 12px 800 yazı, 22px yükseklik, zemin renginde 2px kenar; 9'dan büyükse "9+".
- Sayı uygulama açılınca, uygulama ön plana dönünce ve her cevaptan sonra çekilir.
- Bekleyen soru varsa ana sayfa balonu: "Dur, sana soracaklarım var! {n} kısa soru." + safran "Cevapla". Tetiklemeli soru (zam, deneme, iptal kontrolü) varsa balon doğrudan onu söyler.

**K2 · Soru paneli (alttan açılan panel):**
- Giriş: büyük Kıvırık (iki kol havada, kâse), "Dur, sana soracaklarım var!", "3 kısa soru, tek dokunuşla. Cevapların hatırlatmaları ve önerilerimi daha isabetli yapar.", "Başlayalım" ve "Şimdi değil". Tetiklemeli soru varsa giriş atlanır.
- Kart: üstte servis şeridi (logo, ad + plan, fiyat; sağda ilerleme noktaları), Kıvırık kafası + koyu balon (başlık "Kıvırık", soru 19px 800, varsa alt not 13px), 52px yüksekliğinde tam genişlik seçenek butonları (alt yazılı olabilir), en altta "Geç" çerçeveli buton ve "Bunu bir daha sorma" altı çizili metin. Kullanıcı başına sorularda şerit yerine sadece ilerleme noktaları.
- Tarih ya da tutar isteyen cevaplarda seçeneklerin yerine küçük bir giriş alanı + "Kaydet" (tutar: decimal klavye ve ₺; tarih: tarih seçici).
- Bitiş: mutlu Kıvırık, "Şimdilik bu kadar!", "Bu ay aboneliklere {toplam} ödeyeceksin." kartı, "Tamam".

**Detay ekranı:** yeni alanlar düzenlenebilir satırlar: Ödeme kanalı, Senin ödediğin (boşsa katalog fiyatı + "Değiştir"), Paylaşım (kişi başı tutarla), Ücretsiz deneme (bitiş tarihi), Planlı bırakma tarihi.

---

## Faz 2: İptal akışı ve `cancel_verify`

- Abonelik detayında **"Sil"** ve **"İptal ettim"** ayrı olsun (mevcut "Takip listesinden kaldır" bunlara ayrılır).
  - **Sil:** yanlış eklendi, satır silinir (onay sorulur).
  - **İptal ettim:** `cancelled_at` yazılır. Abonelik toplamlardan, yaklaşan ödemelerden, bildirimlerden ve ücretsiz plandaki 5 abonelik sınırından düşer; ana sayfada/aboneliklerimde "İptal edilenler" bölümünde görünür. Oradan "Geri al" yapılabilir.
- `cancel_verify` (öncelik 1, event): `cancelled_at`'ten sonraki ilk eski ödeme günü geçince sorulur; `period = 'YYYY-MM'` (o ay).
  - Metin: "Bu aboneliği iptal etmiştin. Bu ay kartından çekim oldu mu?"
  - Seçenekler: Hayır / Evet → sabit **"İade adımları"** ekranı: 1) önce platformun kendisinden iade/itiraz (kanala göre link), 2) olmazsa bankana harcama itirazı, 3) o da olmazsa Tüketici Hakem Heyeti başvurusu (e-Devlet). Metin bilgilendirme niteliğinde olsun, hukuki tavsiye gibi yazılmasın.

## Faz 3: Periyodik ve tetiklemeli sorular

| key | Periyot | Metin | Seçenekler | Ne zaman | Öncelik |
| --- | --- | --- | --- | --- | --- |
| `trial_ending` | `trial:<trial_ends_at>` | "Denemen {n} gün sonra bitiyor." Not: "İptal etmezsen {tarih} günü {fiyat} çekilecek." | Devam edeceğim / İptal edeceğim / Yarın tekrar hatırlat | `trial_ends_at` ile bugün arasında 3 günden az | 1 |
| `price_increase` | `price:<price_history id>` | "Zamlandı. Ne yapıyoruz?" Not: "Ayda {fark}, yılda {yıllıkFark} fazla." | Devam, kalsın / Daha ucuz plana bakayım / Bırakacağım | Kullanıcı aboneliği ekledikten sonra `price_history`'de artış var | 2 |
| `monthly_usage_check` | `YYYY-MM` veya `YYYY-Qn` | "Bu ay açtın mı?" | Çok / Birkaç kez / Hiç | usage_frequency "Ayda birkaç" veya "Neredeyse hiç" ise aylık (`YYYY-MM`), diğerlerinde 3 ayda bir (`YYYY-Qn`) | 5 |
| `value_check` | `YYYY-Qn` | "Parasını hak ediyor mu?" | Kesinlikle / İdare eder / Hayır | 3 ayda bir | 6 |

- **Admin panelinden elle fiyat değiştirince `price_history`'ye kayıt düşüyor mu, kontrol et** (AI fiyat taraması şu an kapalı). Düşmüyorsa ekle; zam kartı buna bağlı.
- Zam kartı (K3): üstte kırmızı tonlu "Zam" etiketi (ok ikonu) ve "Bu sabah fark ettim" gibi zaman bilgisi; şeritte eski fiyat üstü çizili, yeni fiyat kırmızı; Kıvırık şaşkın yüzle.
- Deneme kartı (K4): safran tonlu "Deneme bitiyor" etiketi (saat ikonu), sağda "{n} gün kaldı".

**Cevap sonrası aksiyonlar:**
- `usage_frequency` "Neredeyse hiç", `monthly_usage_check` "Hiç" veya `value_check` "Hayır" → aynı kartta takip cümlesi: "Yılda {yıllıkTutar} ediyor. İptal adımlarına bakalım mı?" Not: "Kullanmadığın bir abonelik için bu biraz fazla." Seçenekler: "İptal adımlarını göster" (alt yazı: "İptal sayfasını senin için açarım") → ortak iptal rehberi / "Kalsın, kullanacağım".
- `trial_ending` "Devam edeceğim" → ödeme günü deneme bitiş günü yapılır, deneme bitince `is_trial = false`. "İptal edeceğim" → iptal rehberi. "Yarın tekrar hatırlat" → 1 günlük erteleme.
- `price_increase` "Daha ucuz plana bakayım" → servisin katalog detay sayfası (planlar fiyata göre sıralı). "Bırakacağım" → iptal rehberi.

---

## Öncelik sırası (3 soru limiti içinde)

1. `trial_ending`, `cancel_verify`
2. `price_increase`
3. `billing_day`, `payment_channel`, `usage_frequency`, `reminder_days_before`
4. Diğer tek seferlik sorular
5. `monthly_usage_check`
6. `value_check`

Aynı öncelikte daha pahalı abonelik önce.

## Her fazın sonunda

- Değişen ve yeni dosyalar, migration'lar ve sırası.
- Native paket eklendiyse build komutu (eklenmemesi beklenir).
- Test listesi. En az: misafirde Kıvırık'ın girişe yönlendirmesi; rozet sayısı; giriş → 3 soru → bitiş; "Geç" sonrası 7 gün görünmeme ve "Bunu bir daha sorma"; fiyat düzeltince toplamın değişmesi ve admin'de şüpheli fiyat görünmesi; "Başkası ödüyor"un toplamdan düşmesi; paylaşımda kişi başı tutar; bütçe aşımı uyarısı; deneme ve planlı bırakma bildirimleri; "İptal ettim" sonrası toplamdan ve 5 sınırından düşme, eski ödeme günü geçince `cancel_verify`; admin'de fiyat artırınca zam kartı; aylık kullanım ve değer soruları için dönemi elle değiştirerek test; açık ve koyu tema.
