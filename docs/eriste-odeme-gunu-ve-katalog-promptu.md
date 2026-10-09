# erişte: ödeme günü, ödeme hatırlatmaları, erişte Premium'un listeye eklenmesi ve katalog genişletme

Dört iş var. Sırayla yap; her bölümün sonunda dur, değişen dosyaları ve nasıl test edeceğimi yaz, onayımı bekle.

## Çalışma kuralları

- Önce ilgili kodu incele: onboarding akışı, AddSubscriptionSheet (Kıvırık soruları), user_subscriptions şeması ve endpoint'leri, misafir modu (AsyncStorage) ve hesaba toplu aktarım, PaywallScreen ve RevenueCat kullanımı, katalog tablosu, admin paneli, fiyat tarayıcı. Plan yaz, sonra uygula.
- Mevcut iş mantığını bozma: misafir modu ve 5 abonelik limiti, bulk endpoint, paywall, Logo.dev logoları.
- Veritabanı değişiklikleri yeni migration dosyası olarak (sıradaki numara). Mevcut verileri bozma.
- Arayüz yeni marka sistemine uygun olsun (Kıvırık balonu, Bricolage, ink/safran/biber, açık ve koyu tema).
- Türkçe metinlerde uygulama adına ek getirme ("Spotify'ı" değil, "Spotify — ..." ya da "Spotify için ..." gibi eksiz kalıplar).
- Commit atma.

---

## 1. Ödeme günü (onboarding ve misafir modu dahil)

**Sorun:** Onboarding'de seçilen aboneliklerin ödeme günü yok, bu yüzden "yaklaşan ödemeler" ve hatırlatmalar çalışmıyor.

1. Şemayı kontrol et. Aylık plan için ayın günü (1–31), yıllık plan için gün + ay gerekiyor. Mevcut alan bunu karşılamıyorsa bir sonraki ödeme tarihini hesaplayabilecek şekilde düzenle (ör. `billing_day` + yıllıkta `billing_month`, ya da `next_billing_date`). Ayın 29–31'i olmayan aylarda ayın son günü kabul edilsin.
2. **Onboarding:** Servis seçiminden sonra Kıvırık'ın sorduğu yeni bir adım ekle: "Bunların ödemesi ayın kaçında çıkıyor?" Seçilen her abonelik için bir satır: logo + ad + gün seçici (1–31 hızlı seçim; yıllıkta gün + ay). Her satırda "Bilmiyorum" seçeneği olsun; adım tamamen atlanabilsin ("Sonra eklerim"). İlerleme çubuğu güncellensin.
3. **AddSubscriptionSheet:** Ödeme günü sorusu zaten yoksa Kıvırık'ın sorularına ekle; varsa yukarıdaki gün seçiciyi ortak bileşen olarak kullan.
4. **Misafir modu:** Ödeme günü cihazdaki kayıtta da tutulsun ve hesaba aktarımda bulk endpoint'e gitsin.
5. **Eksik ödeme günü hatırlatması:** Ana sayfada ödeme günü girilmemiş abonelik varsa Kıvırık balonu: "3 aboneliğinin ödeme günü eksik. Ekle de sana haber vereyim." Dokununca sırayla eksik olanların gününü sorduğu kısa bir akış açılsın. Detay ekranında da gün düzenlenebilsin.
6. "Yaklaşan ödemeler" bölümü bir sonraki ödeme tarihini doğru hesaplasın (aylık/yıllık, ay sonu durumu).

## 2. Yerel ödeme hatırlatma bildirimleri

Sunucuya bağımlı olmadan, cihazda planlanan bildirimler (`expo-notifications`, yerel/scheduled). Push sunucusu bu aşamada yok.

1. `npx expo install expo-notifications` ve config plugin. **Bu, yeni dev build gerektirir**; bitince bana hatırlat.
2. Bildirim izni ilk açılışta istenmesin. Kullanıcı ilk kez ödeme günü girdiğinde Kıvırık sorsun: "Ödemeden 1 gün önce haber vereyim mi?" Evet derse sistem izni istensin.
3. Ödeme günü olan her abonelik için bir sonraki ödemeden **1 gün önce saat 10:00**'da bildirim: "Yarın Netflix ödemen var: 229,99 TL". Metindeki fiyat güncel katalog fiyatı (USD ise TL karşılığı da).
4. Abonelik eklenince, silinince, ödeme günü ya da fiyat değişince ilgili bildirim yeniden planlansın. Uygulama her açıldığında tüm bildirimleri baştan planlayan idempotent bir `rescheduleAll()` olsun (iOS'ta en fazla 64 bekleyen bildirim sınırına dikkat: yalnızca en yakın ödemeleri planla).
5. Ayarlar/Profil ekranına "Ödeme hatırlatmaları" aç/kapa ve "kaç gün önce" (aynı gün / 1 / 3 gün) seçeneği.
6. Misafir modunda da çalışsın.

## 3. erişte Premium'un kullanıcının aboneliklerine eklenmesi

Kullanıcı erişte Premium satın aldığında, erişte'nin kendisi de takip listesinde görünsün.

1. Katalogda **erişte** girdisi oluştur (migration ile seed): uygulama adı `erişte`, planlar `Premium Aylık` ve `Premium Yıllık`, kategori `Üretkenlik/Tasarım` (ya da uygun olan), domain `eriste.app`, logo = kendi uygulama ikonumuz (`gece` varyantı; Logo.dev'e değil yerel/R2 asset'e bağla), `cancel_url` = `https://apps.apple.com/account/subscriptions`. Bu girdi fiyat tarayıcının dışında tutulsun (tarayıcı atlasın); fiyatı RevenueCat'ten gelir.
2. Satın alma başarılı olunca (PaywallScreen) ve uygulama her açıldığında RevenueCat `customerInfo` kontrol edilsin: `premium` entitlement aktifse ve kullanıcının listesinde erişte yoksa eklensin:
   - plan: aktif ürün `premium_aylik` → Premium Aylık, `premium_yillik` → Premium Yıllık,
   - fiyat ve para birimi: ilgili paketin `product.price` / `currencyCode` değeri (App Store'da kullanıcının gördüğü fiyat),
   - ödeme günü: `latestExpirationDate`'ten (yenileme tarihi) türet.
3. Plan değişirse (aylık ↔ yıllık) kayıt güncellensin; yenilemede ödeme günü kayarsa düzeltilsin.
4. Kullanıcı erişte'yi listesinden kendisi silerse **tekrar eklenmesin** (kullanıcı tercihi olarak sakla: backend'de bir alan ya da kullanıcı ayarı).
5. Abonelik bitince (entitlement aktif değil) kayıt silinmesin; detayda "Premium aktif değil" etiketi gösterilsin ve hatırlatma bildirimi planlanmasın.
6. erişte kaydı ücretsiz plan limitine sayılmasın (zaten Premium sınırsız; ama süre biterse kullanıcı 5 limitine takılıp erişte yüzünden abonelik ekleyemez hâle gelmesin).
7. Detay ekranında erişte için "İptal et" butonu App Store abonelik yönetimine gitsin.

## 4. Katalog genişletme (admin onaylı)

Hedef: Türkiye'de yaygın kullanılan servislerin büyük kısmını kapsayan bir katalog. Fiyatlar uydurulmayacak; fiyat tarayıcı dolduracak, ben admin panelinden onaylayacağım.

1. **Şema:** Katalog girdilerine durum alanı ekle: `status` = `draft | active | hidden` (mevcutların hepsi `active`). Mobil uygulama ve public endpoint'ler yalnızca `active` olanları döndürsün. Gerekirse `price_status` (`unverified | verified`) ve `source_note` ekle.
2. **Yeni kategori:** `Oyun` (ve gerekirse `Alışveriş/Üyelik`, `VPN/Güvenlik`). Admin paneli, mobil kategori çipleri ve kategori renkleri buna göre güncellensin.
3. **Toplu ekleme scripti:** `backend/scripts/seed-catalog.mjs`, `backend/data/catalog-seed.json` dosyasını okuyup katalogda olmayanları `draft` olarak eklesin (`app_name` + `plan_name` ile tekrar eklemeyi önle). JSON'daki her satır: `app_name`, `plan_name`, `category`, `domain`, `source_url` (resmi Türkiye fiyat sayfası), `cancel_url`, `currency`. **Fiyat alanını boş bırak.**
4. **Seed listesi:** Aşağıdaki listeyi başlangıç olarak kullan. Her servis için Türkiye'de gerçekten satılan planları ve resmi TR fiyat sayfasını bul. Türkiye'de satılmayan ya da artık var olmayan servisleri listeye alma ve bana bildir. Emin olmadığın satırı JSON'a koyma, ayrı bir "doğrulanamadı" listesinde ver.
   - **Video/Dizi-Film:** Netflix, Disney+, Amazon Prime Video, HBO Max, Exxen, Gain, TOD, TV+, Tivibu, Mubi, YouTube Premium, Apple TV+, Tabii, S Sport Plus
   - **Müzik:** Spotify, Apple Music, YouTube Music, Deezer, Fizy, Tidal, Amazon Music
   - **Kitap/Sesli Kitap:** Storytel, Dergilik, Everand
   - **Yapay Zeka:** ChatGPT, Claude, Google Gemini (Google AI planları), Perplexity, Midjourney, GitHub Copilot, Cursor
   - **Bulut Depolama:** iCloud+, Google One, Dropbox, Microsoft OneDrive
   - **Üretkenlik/Tasarım:** Microsoft 365, Canva, Adobe Creative Cloud, Notion, Figma, Duolingo, LinkedIn Premium, Apple One
   - **Oyun:** Xbox Game Pass, PlayStation Plus, Nintendo Switch Online, EA Play, Ubisoft+, Apple Arcade
   - **Alışveriş/Üyelik:** Amazon Prime, Hepsiburada Premium, Trendyol, Yemeksepeti, Getir (yalnızca ücretli üyelik programı varsa)
   - **VPN/Güvenlik:** NordVPN, Surfshark, ExpressVPN, Proton
   - **Spor:** Strava, MacFit ve benzeri dijital üyelikler (yalnızca online/uygulama üyeliği olanlar)
5. **Fiyat tarama:** Script `draft` girdileri fiyat tarayıcıdan geçirsin (Batch API ile toplu, ucuz model). Bulunan fiyat `price_status = unverified` olarak yazılsın.
6. **Admin paneli:** "Taslaklar" sekmesi: logo, ad, plan, bulunan fiyat, kaynak linki (tıklayınca açılsın), kategori. Her satırda **Onayla** (`active` + `verified`), **Düzenle** ve **Gizle** butonları; çoklu seçip toplu onaylama.
7. Logo.dev domain'leri JSON'daki `domain` alanından gelsin; logo gelmeyenleri admin panelinde işaretle.

---

## Bitince

- Değişen ve yeni dosyaların listesi, migration'lar ve sırası.
- Yeni native paket (expo-notifications) olduğu için gereken build komutu.
- Seed listesinde eklenen, elenen ve doğrulanamayan servisler.
- Test listesi: onboarding'de gün seçme ve atlama, misafir → hesap aktarımında günün korunması, eksik gün balonu, bildirimin gelmesi (test için 1 dakika sonrasına planlayan gizli bir dev butonu), sandbox satın almada erişte'nin listeye eklenmesi, silinince tekrar eklenmemesi, taslakların admin'de onaylanıp mobilde görünmesi.
