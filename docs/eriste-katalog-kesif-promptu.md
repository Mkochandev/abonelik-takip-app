# Görev: Katalog keşfi — yapay zekâ ile yeni servis ve plan bulma

Katalog şu an ~86 kayıt. Hedef: Türkiye'de satılan dijital aboneliklerin büyük kısmını kapsayan **250+ kayıt** (servis × plan). Fiyatı olmayan kayıt yayına girmeyecek; her şey önce `draft` olarak girer, ben admin panelinden onaylarım.

Mevcut sorun: sayfa çekip modele vermek, fiyatı JavaScript ile yükleyen ya da botları engelleyen sitelerde çalışmıyor (son taramada 53 taslağın 39'unda fiyat bulunamadı). Bu yüzden yeni akış Anthropic'in sunucu tarafı **web_search** ve **web_fetch** araçlarını kullanacak.

## Çalışma şekli
- Önce mevcut kodu incele (`seed-catalog.mjs`, `priceScanner.js`, `priceScanCron.js`, katalog şeması, admin paneli taslak sekmesi). Plan yaz, onayımı bekle.
- Commit atma. Gizli bilgi koda girmez.
- Her aşama **önce `--dry-run`** ile çalışabilsin: veritabanına yazmadan ne yapacağını ve tahmini maliyeti göstersin.

## Araçlar ve model
- Web arama: `{"type":"web_search_20250305","name":"web_search","max_uses":N,"user_location":{"type":"approximate","country":"TR","timezone":"Europe/Istanbul"}}`
- Sayfa okuma: `{"type":"web_fetch_20250910","name":"web_fetch","max_uses":N,"max_content_tokens":8000}`
- Model: `CATALOG_DISCOVERY_MODEL` env (varsayılan `claude-haiku-5-5`). Başlarken Models API'den `capabilities.server_tools.web_search.supported` ile modelin web aramayı desteklediğini kontrol et; desteklemiyorsa açık bir hata ver.
- Çıktılar yapılandırılmış JSON (mevcut tarayıcıdaki gibi şema zorunlu).
- Maliyet: web arama 1.000 aramada 10 $ + token. Her çalıştırmada toplam arama sayısını ve tokenları logla; `--max-searches` ile üst sınır koy (varsayılan 200), sınıra gelince dur ve kaldığı yeri raporla.

## Aşama 1: Keşif (`node scripts/discover-catalog.mjs`)
Kategori kategori çalışır. Her kategori için model web aramasıyla **Türkiye'de satın alınabilen** abonelikleri listeler.

Kategoriler (mevcutlar + yeniler):
Video/Dizi-Film · Müzik · Kitap/Sesli Kitap/Dergi · Yapay Zeka · Bulut Depolama · Üretkenlik/Tasarım · Oyun · Spor (yayın ve fitness uygulamaları) · Alışveriş/Üyelik (kargo, yemek, market üyelikleri) · VPN/Güvenlik/Şifre yöneticisi · Eğitim/Dil öğrenme · Sağlık/Meditasyon · Haber/Gazete · Yazılım/Geliştirici araçları · Sosyal/Tanışma (premium üyelikler) · Diğer.

Her servis için çıktı: `app_name`, `domain` (resmi alan adı), `category`, `plans[]` (`plan_name`, `billing_cycle` monthly|yearly), `pricing_url` (resmi, mümkünse Türkiye fiyat sayfası), `available_in_tr` (true/false + kısa gerekçe), `popularity` (yüksek/orta/düşük, Türkiye için).

Kurallar:
- Türkiye'de satılmayanları ve kapanmış servisleri alma.
- Aynı servisin Bireysel / Aile / Öğrenci / Reklamlı gibi her ücretli planı ayrı kayıt; yıllık seçenek varsa ayrı kayıt (`billing_cycle=yearly`).
- Ücretsiz planları ekleme.
- Mevcut katalogla **domain + plan_name** üzerinden tekrar kontrolü; var olanı ekleme.
- Hepsi `status='draft'`, `price_status='unverified'`, `source_note='ai-discovery'` olarak girer; fiyat alanı boş.
- Sonunda kategori başına eklenen/atlanan sayılarını ve atlananların sebebini yaz.

## Aşama 2: Fiyat bulma (`node scripts/discover-catalog.mjs --prices`)
Fiyatı boş olan `draft` kayıtlar için (ve istenirse `--include-active` ile aktifler için):
- Model önce `pricing_url`'i `web_fetch` ile okur; fiyat yoksa `web_search` ile resmi Türkiye fiyatını arar (en fazla 3 arama).
- Çıktı: `price`, `currency` (TRY varsa TRY; servis Türkiye'de sadece USD satıyorsa USD), `billing_cycle`, `source_url` (fiyatın görüldüğü sayfa), `evidence` (sayfadaki fiyat cümlesinden kısa alıntı), `confidence` (yüksek/orta/düşük).
- Sadece **resmi kaynaklar** (servisin kendi sitesi, App Store/Google Play'deki resmi uygulama sayfası, servisin resmi yardım sayfası) kabul edilir; haber siteleri, forumlar, karşılaştırma siteleri kaynak olarak kullanılmaz. Fiyat sadece resmi olmayan bir yerde bulunduysa `price` boş kalsın, `evidence`'a not düşsün.
- App Store'daki uygulama içi satın alma fiyatı kullanıldıysa `source_note`'a `app-store-price` ekle (web fiyatından farklı olabilir).
- Toplu çalıştırmada Message Batches API kullanılabilir (web araçları batch'te çalışıyor); `--sync` ile tek tek de çalışabilsin.
- Sonuç `price_status='unverified'` olarak yazılır; asla doğrudan `active` yapılmaz.

## Aşama 3: Admin paneli
- Taslaklar sekmesinde yeni kolonlar: `confidence`, `evidence` (üzerine gelince tam metin), `source_url` (tıklanabilir), `source_note` etiketi (ai-discovery / app-store-price).
- Filtreler: kategori, güven düzeyi, fiyatı olan/olmayan.
- "Yüksek güvenli olanları seç" kısayolu; toplu onaylama zaten var.
- Fiyatı bulunamayanlar için satır içinde hızlı fiyat girişi.
- Panelde "Keşfi başlat" ve "Fiyatları bul" düğmeleri (arka planda çalışsın, durum sekmesi göstersin, `--max-searches` sınırı panelde de geçerli).

## Aşama 4: Logo
- Yeni kayıtların logosu mevcut Logo.dev akışıyla `domain` üzerinden gelsin; logo gelmeyenler panelde işaretlensin.

## Bitince
- Değişen/yeni dosyalar, yeni env değişkenleri.
- Sunucuda çalıştırma sırası: migration (gerekirse) → `--dry-run` → keşif → fiyat bulma.
- Dry-run'dan çıkan tahmini arama sayısı ve maliyet.
- Test listesi: tekrar eklememe, Türkiye'de olmayanı eleme, resmi olmayan kaynağı reddetme, max-searches sınırında durma, panelde filtre ve toplu onay.
