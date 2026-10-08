# erişte: yeni marka ve tasarım uygulaması

Bu dosya, mobil uygulamayı yeni marka kimliğine (erişte logosu, maskot Kıvırık, yeni renkler) taşımak için hazırlandı. Tasarımlar bir tasarım kanvasında yapıldı; aşağıdaki ölçü, renk ve SVG verileri o tasarımların birebir karşılığıdır.

## Çalışma kuralları

- Önce mevcut kodu incele (tema dosyası, ortak bileşenler, onboarding, Home, Catalog, AddSubscription akışı, SubscriptionDetail, Login/Register). Değişiklik planını kısa bir liste olarak yaz, sonra uygula.
- Backend'e dokunma. Veritabanındaki `price_alert_enabled` alanı kalsın, sadece arayüzden kaldırılacak.
- Mevcut iş mantığını (misafir modu, 5 abonelik limiti, bulk ekleme, paywall) bozma.
- Açık ve koyu temanın ikisi de çalışmalı.
- Commit atma. Bitince değişen dosyaları ve test listesini yaz.

---

## 1. Marka sistemi

### Renkler (`src/theme` içinde tek yerde tanımla)

| Ad | Değer | Kullanım |
| --- | --- | --- |
| ink | `#15131A` | Ana koyu renk, butonlar, koyu zemin |
| safran | `#FFC53D` | Kıvırık, teller, vurgu |
| biber | `#C8312A` | Marka kırmızısı, bildirim noktası, vurgu metni |
| biberYazi | `#B4271F` | Açık zeminde kırmızı yazı (kontrast için) |
| krem | `#F6EEDC` | Sıcak açık zemin |
| mandalina | `#FF8A3D` | Kıvırık'ın yanakları |
| odun | `#E2B07A` | Yemek çubukları |

Açık tema: zemin `#F2F1F4`, kart `#FFFFFF`, metin `#15131A`, ikincil metin `#5F5B66`, ayraç `#E6E4EA`, birincil buton `#15131A` üzerinde `#FFFFFF`.
Koyu tema: zemin `#0F0E13`, kart `#1C1A22`, alan `#26232D`, metin `#F5F3F7`, ikincil `#A9A5B0`, ayraç `#2E2B35`, birincil buton `#FFC53D` üzerinde `#15131A`.
Kategori pastelleri aynı kalıyor.

### Yazı tipi

Başlık, tutar ve butonlarda **Bricolage Grotesque** (600, 700, 800). `@expo-google-fonts/bricolage-grotesque` + `useFonts` ile yükle, fontlar yüklenene kadar splash ekranını tut. Gövde metni sistem fontu.

### Slogan ve isim

`src/config/brand.js`: `APP_NAME = "erişte"`, `SLOGAN = "Bütün aboneliklerin tek kâsede."` Eski slogan ("Aboneliklerin, tek sırada." vb.) her yerden kalksın.

### Eski logoyu temizle

Eski logo (dalgalı tel + üç renkli kare: `#FFC53D`, `#FF8A3D`, `#FF5E57` dönen karolar) kodun her yerinden kaldırılacak. Proje genelinde ara, kullanıldığı yerleri aşağıdaki yeni bileşenlerle değiştir, eski dosyaları sil.

---

## 2. Ortak bileşenler (`src/components/brand/`)

`react-native-svg` kullan (yüklü değilse `npx expo install react-native-svg`).

### 2.1 `NoodleBackground`

Ekranın arkasında dolaşan erişte telleri. Props: `width`, `height`, `color` (varsayılan safran), `opacity`, `tileSize` (varsayılan 380), `strokeScale` (varsayılan 1.4). 512×512'lik tek bir desen, `tileSize` boyutuna ölçeklenip yatay ve dikey döşenir. `pointerEvents="none"`, `position: absolute`. Desendeki teller (`d`, kalınlık):

```js
export const NOODLES = [
  ["M-20 60 C60 30 120 100 200 70 C280 40 340 110 420 80 C470 62 500 90 540 70", 12],
  ["M-20 128 C70 158 130 98 210 138 C290 178 360 108 440 148 C490 170 520 138 540 148", 11],
  ["M-20 432 C80 402 150 472 230 442 C310 412 370 482 450 447 C500 427 520 462 540 452", 12],
  ["M-20 486 C60 506 140 456 220 491 C300 526 380 461 460 496 C500 511 520 486 540 496", 11],
  ["M40 540 C70 460 10 400 50 320 C80 260 20 200 60 120 C80 70 40 30 60 -20", 12],
  ["M470 540 C440 470 500 400 460 330 C430 270 490 210 455 140 C440 90 480 40 460 -20", 12],
  ["M120 540 C142 496 98 468 128 416 C146 386 120 364 132 340", 11],
  ["M392 540 C370 494 412 468 386 418 C372 390 396 368 384 344", 11],
  ["M-20 300 C60 250 100 340 160 300 C200 272 180 222 140 232 C112 240 118 276 146 274", 11],
  ["M540 262 C460 302 430 222 372 262 C334 290 352 340 390 330 C414 322 406 296 384 300", 11],
  ["M204 -20 C182 30 222 62 200 112", 10],
  ["M334 -20 C356 30 312 72 336 118", 10],
  ["M264 -20 C250 20 286 40 270 78", 9],
  ["M-20 372 C40 352 70 392 112 368 C150 346 170 380 200 372", 10],
  ["M540 398 C480 380 450 420 404 396 C368 378 344 404 320 396", 10],
  ["M186 540 C200 498 236 512 246 470 C254 440 284 452 296 430", 10],
  ["M-20 210 C30 190 50 230 90 214", 9],
  ["M540 196 C496 180 476 216 436 204", 9]
];
```
Tüm teller `strokeLinecap="round"`, `strokeLinejoin="round"`, `fill="none"`.

### 2.2 `BrandLogo` (uygulama ikonu ve marka işareti)

512×512 viewBox, props: `size`, `variant` = `gece | biber | kagit`, `radius` (varsayılan `size * 0.2237`, yuvarlak için `size/2`).

| variant | zemin | teller | parlama | yazı | çubuk |
| --- | --- | --- | --- | --- | --- |
| gece | `#15131A` | `#FFC53D` | `#FFE08A` | `#F5F3F7` | `#E2B07A` |
| biber | `#C8312A` | `#FFC53D` | `#FFE08A` | `#FFF6DC` | `#F6EEDC` |
| kagit | `#F6EEDC` | `#EDA82A` | `#FFD873` | `#C8312A` | `#15131A` |

Çizim sırası:
1. Zemin dikdörtgeni.
2. `NOODLES` tellerinin hepsi, teller renginde, verilen kalınlıkta.
3. Aynı teller parlama renginde, kalınlık `max(2.5, round(w*0.28))`, `opacity 0.75`, `translate(-2 -2)`.
4. "erişte" yazısı: `x=256 y=318`, `textAnchor="middle"`, Bricolage Grotesque 800, `fontSize 128`, yazı rengi; arkasında zemin renginde 30 kalınlığında kontur (yazının etrafında boşluk bırakmak için önce kontur, sonra dolgu; `react-native-svg` `paint-order` desteklemiyorsa aynı metni önce `stroke` ile, sonra üstüne dolgu ile iki kez çiz). Genişlik yaklaşık 396 olmalı (`textLength` desteklenmiyorsa font boyutunu buna göre ayarla).
5. Çubuklar: önce zemin renginde 30 kalınlık, sonra çubuk renginde 14 kalınlık, `round` uç: `M96 150 L452 92` ve `M104 178 L462 122`.

### 2.3 `Kivirik` (maskot)

viewBox `0 0 240 230`, props: `size` (genişlik; yükseklik = size × 230/240), `mood` = `selam | mutlu | sasirmis`, `bowl` = `krem | gece`.

```
// her zaman
<Path d="M120 54 C110 36 126 20 140 28 C152 35 145 51 133 47" stroke="#FFC53D" strokeWidth={11} strokeLinecap="round"/>
// mood === "selam": sağ kol el sallıyor
<Path d="M178 104 C192 96 200 82 196 68" stroke="#FFC53D" strokeWidth={12} strokeLinecap="round"/>
// mood === "sasirmis": iki kol havada
<Path d="M62 108 C46 96 42 78 50 64" stroke="#FFC53D" strokeWidth={12} strokeLinecap="round"/>
<Path d="M178 108 C194 96 198 78 190 64" stroke="#FFC53D" strokeWidth={12} strokeLinecap="round"/>
// gövde
<Ellipse cx={120} cy={104} rx={64} ry={56} fill="#FFC53D"/>
<Path d="M74 86 C84 79 94 92 104 85" stroke="#E9A321" strokeWidth={5} strokeLinecap="round"/>
<Path d="M136 76 C146 69 156 82 166 75" stroke="#E9A321" strokeWidth={5} strokeLinecap="round"/>
// gözler — selam
<Circle cx={100} cy={106} r={9.5} fill="#15131A"/><Circle cx={103.5} cy={102.5} r={3.2} fill="#FFFFFF"/>
<Circle cx={140} cy={106} r={9.5} fill="#15131A"/><Circle cx={143.5} cy={102.5} r={3.2} fill="#FFFFFF"/>
// gözler — mutlu (kavis)
<Path d="M90 108 Q100 96 110 108" stroke="#15131A" strokeWidth={5.5} strokeLinecap="round"/>
<Path d="M130 108 Q140 96 150 108" stroke="#15131A" strokeWidth={5.5} strokeLinecap="round"/>
// gözler — sasirmis
<Circle cx={100} cy={104} r={12} fill="#FFFFFF"/><Circle cx={100} cy={105} r={6.5} fill="#15131A"/>
<Circle cx={140} cy={104} r={12} fill="#FFFFFF"/><Circle cx={140} cy={105} r={6.5} fill="#15131A"/>
// yanaklar
<Ellipse cx={85} cy={124} rx={9} ry={5.5} fill="#FF8A3D" opacity={0.6}/>
<Ellipse cx={155} cy={124} rx={9} ry={5.5} fill="#FF8A3D" opacity={0.6}/>
// ağız: selam ve mutlu
<Path d="M108 122 Q120 135 132 122" stroke="#15131A" strokeWidth={5} strokeLinecap="round"/>
// ağız: sasirmis
<Ellipse cx={120} cy={128} rx={7} ry={9} fill="#15131A"/>
// kâse (krem: gövde #F5F3F7, ağız #DCD9E0, şerit #C8312A | gece: gövde #15131A, ağız #2A2733, şerit #FFC53D)
<Path d="M26 144 H214 C214 194 172 222 120 222 C68 222 26 194 26 144 Z" fill={bowlBody}/>
<Ellipse cx={120} cy={144} rx={94} ry={11} fill={bowlRim}/>
<Path d="M62 146 C66 158 56 164 61 176" stroke="#FFC53D" strokeWidth={9} strokeLinecap="round"/>
<Path d="M176 146 C172 156 182 162 178 172" stroke="#FFC53D" strokeWidth={9} strokeLinecap="round"/>
<Path d="M74 186 C88 176 102 196 116 186 C130 176 144 196 158 186 C162 183 166 183 168 185" stroke={band} strokeWidth={6} strokeLinecap="round"/>
```

### 2.4 `KivirikHead` (küçük kafa)

viewBox `0 0 120 120`, props: `size`, `mood` = `normal | dusunceli`.

```
<Path d="M58 22 C52 10 64 0 74 6 C82 11 77 22 68 19" stroke="#FFC53D" strokeWidth={8} strokeLinecap="round"/>
<Ellipse cx={60} cy={66} rx={50} ry={44} fill="#FFC53D"/>
<Path d="M24 52 C32 46 40 56 48 50" stroke="#E9A321" strokeWidth={4} strokeLinecap="round"/>
<Circle cx={44} cy={66} r={7.5} fill="#15131A"/><Circle cx={46.5} cy={63.5} r={2.5} fill="#FFFFFF"/>
<Circle cx={76} cy={66} r={7.5} fill="#15131A"/><Circle cx={78.5} cy={63.5} r={2.5} fill="#FFFFFF"/>
<Ellipse cx={32} cy={80} rx={7} ry={4.5} fill="#FF8A3D" opacity={0.6}/>
<Ellipse cx={88} cy={80} rx={7} ry={4.5} fill="#FF8A3D" opacity={0.6}/>
// normal: gülümseme
<Path d="M52 80 Q60 88 68 80" stroke="#15131A" strokeWidth={4} strokeLinecap="round"/>
// dusunceli: gözlerin parlaması ortada (46.5→44, 78.5→76; cy 61), düz ağız
<Path d="M53 82 H67" stroke="#15131A" strokeWidth={4} strokeLinecap="round"/>
```

### 2.5 `KivirikBubble`

Kıvırık'ın konuşma balonu. Props: `text`, `title` (varsayılan "Kıvırık"), `tail` = `left | right`.
Açık temada zemin `#15131A`, koyu temada `#26232D`; metin `#F5F3F7`, başlık "Kıvırık" 12px 700 `#FFC53D`. Köşeler 20, kuyruk tarafındaki alt köşe 6 (`tail=left`: sol alt 6; `tail=right`: sağ üst 6). İç boşluk 14/16, metin 15px 600, satır yüksekliği 1.4.

---

## 3. Ekranlar

### 3.1 Onboarding

- **Welcome:** Zemin `#15131A`. Arkada `NoodleBackground` (opacity 0.16). En üstte ortada sadece "erişte" yazısı (Bricolage 800, 22px, `#FFC53D`), **logo ikonu yok**. Ortada büyük illüstrasyon: `Kivirik mood="selam" bowl="krem"` (yaklaşık 260px) ve etrafında yüzen pastel servis kartları (mevcut illüstrasyondaki gibi, kalabilir). Başlık "Bütün aboneliklerin tek kâsede." (38px 800), alt metin, safran "Başlayalım" butonu, "Zaten hesabım var" linki.
- **SelectServices / ConfirmPlans:** Konuşma balonundaki küçük maskot `KivirikHead` (ConfirmPlans'te `dusunceli`). Diğer yapı aynı.
- **Summary:** Zemin koyu. Maskot `Kivirik mood="sasirmis" bowl="krem"`. Etrafındaki konfeti **kare olmayacak**: safran, biber ve mandalina renklerinde küçük dalgalı çizgiler (`M x y q 8 -14 16 0 t 16 0` biçiminde, kalınlık 5–6). Toplam tutar safran, 58px.
- **Save:** `Kivirik mood="mutlu" bowl="gece"` (kâse şeridi safran). Üstte onay işaretli açık mavi bulut kalabilir.
- Her yerde Kıvırık kâsesindeki eski üç renkli kare yerine dalgalı şerit kullanılır (bileşen bunu zaten yapıyor).

### 3.2 Giriş / Kayıt (yeniden tasarım)

Tek ekran, iki mod (`login | register`).
- Zemin `#15131A` (iki temada da). Üst 420px'te `NoodleBackground` (opacity 0.18).
- Üstte 64px aşağıda ortalı "erişte" (22px 800, `#FFC53D`).
- `Kivirik` 220px genişlikte, yatayda ortalı, kâsesinin altı formun üst kenarına değecek şekilde (`top ≈ 140`). Giriş modunda `selam`, kayıt modunda `mutlu`.
- Alttan yukarı kayan form kartı: yükseklik ~496, üst köşeler 32, açık temada `#FFFFFF`, koyu temada `#1C1A22`, iç boşluk 28/24/34, öğeler arası 14.
  - Başlık (30px 800): giriş "Tekrar hoş geldin", kayıt "Kâseni kuralım".
  - Alt metin (15px, ikincil): giriş "Kıvırık aboneliklerini bekletiyordu.", kayıt "Listen yedeklensin, telefon değişse de kaybolmasın."
  - Segment kontrol: 48px yükseklik, hap şekli, zemin alan rengi; aktif sekme beyaz (koyuda `#3A3642`), hafif gölge.
  - Alanlar: 56px yükseklik, 18 köşe, alan renginde zemin; etiket alanın içinde üstte (12px 600), giriş 16px.
  - Giriş modunda sağa yaslı "Şifremi unuttum" (şifre sıfırlama akışı henüz yoksa şimdilik pasif bırak veya mevcut akışa bağla).
  - En altta 58px birincil buton ("Giriş yap" / "Hesap oluştur") ve altında "Misafir olarak devam et" metin butonu (misafir moduna geçer).

### 3.3 Ana sayfa

- Başlığın sağındaki eski logo yerine 56px yuvarlak buton: kart renginde zemin, içinde 46px `KivirikHead`. Sağ üstünde 12px biber noktası (çevresinde zemin renginde 2px kenar). Nokta yalnızca gösterilecek bir mesaj varsa görünür.
- Başlığın altında sağa yaslı `KivirikBubble` (`tail="right"`, en fazla 300px genişlik). Mesaj kuralları:
  - 7 gün içinde ödeme varsa: "Bu ay {n} ödemen var. İlki {gün} gün sonra: {servis}." (yarın ise "yarın", bugün ise "bugün")
  - Abonelik var, yakın ödeme yok: "Bu hafta ödeme yok, kâsen sakin."
  - Hiç abonelik yoksa: "Kâsen boş. Katalogdan ilk aboneliğini ekle."
- Bölümler arası boşluk 26.
- "Abonelik ekle" kısayolu ekleme akışını açsın.

### 3.4 Abonelik ekleme: Kıvırık sorar

Plan seçildikten sonra açılan alt sayfa (bottom sheet) adım adım ilerler. Mevcut tek formun yerini alır.
- Sayfa: yükseklik ~640, üst köşeler 28, kart renginde. En üstte tutamaç.
- Özet satırı (zemin renginde, 18 köşe): servis karosu (logo), "{Servis} {Plan}", fiyat, sağda 3 noktalı ilerleme (aktif nokta 18px genişlikte).
- Altında `KivirikHead` (68px) + `KivirikBubble` (`tail="left"`). Balonun içindeki soru 19px 800 Bricolage.
- Sorular:
  1. "{Servis}'i ne için kullanıyorsun?" → mevcut kategoriye göre hazır nedenler, alt alta tam genişlikte seçenek butonları (52px, 18 köşe; seçili: krem `#FFF6DC` zemin + metin renginde 2px çerçeve; koyu temada `#2E2716`). Serbest metin alanı da kalsın.
  2. "Ne sıklıkla kullanıyorsun?" → "Her gün", "Haftada birkaç", "Nadiren, aslında unuttum".
  3. "Ayın kaçında ödüyorsun?" → 4 sütunlu ızgara: 1, 5, 10, 15, 20, 25, 28, Diğer ("Diğer" sayı girişi açar). Altında: "Ödeme günü yaklaşınca ana sayfada hatırlatırım."
- Butonlar: 1. ve 2. adımda "Geç" (çerçeveli) ve "Devam" (birincil). Son adımda "Geç" ve safran "Kaydet". "Geç" o soruyu boş bırakıp ilerler; son adımdaki "Geç" de kaydeder.
- "Zam olursa haber ver" anahtarı **arayüzden kaldırılıyor**. Veritabanı alanı kalabilir, varsayılan değeri değişmesin.
- Misafirde aynı akış çalışır, ama misafir verisi sadece katalog kimliğini tuttuğu için cevaplar kaydedilmez. Misafirde 1. sorunun altına "Cevaplarını saklamak için hesap oluştur" linki ekle; "Kaydet" yine yerel listeye ekler.

### 3.5 Abonelik detayı

- "Zam olursa haber ver" kartı kaldırıldı.
- "Fiyat geçmişi" kartındaki ikon yerine 44px `KivirikHead mood="dusunceli"`. Değişiklik yoksa metin: "Kıvırık bu fiyatı takip ediyor. Henüz değişiklik yok; zam gelirse eski fiyatlar burada tarihleriyle görünür."
- En altta: "Aboneliği iptal et" (biber çerçeveli buton) → altında "{Servis}'in iptal sayfası tarayıcıda açılır" → onun altında altı çizili ikincil metin butonu "Takip listesinden kaldır" (mevcut onay diyaloğu ile).

### 3.6 Katalog

Boş sonuç metni: "Kıvırık bu kâsede bulamadı. Başka bir ad ya da kategori dene."

---

## 4. Uygulama ikonu ve açılış (splash)

- `scripts/generate-brand-assets.mjs` yaz. `BrandLogo` ile aynı SVG'yi string olarak üretsin ve `@resvg/resvg-js` (dev dependency) ile PNG'ye çevirsin. Yazı için `@expo-google-fonts/bricolage-grotesque` paketindeki 800 ağırlığındaki TTF dosyasını `fontFiles` olarak versin (`loadSystemFonts: false`).
- Üretilecekler:
  - `assets/icon.png`: 1024×1024, `gece`, **köşesiz kare** (iOS köşeleri kendisi yuvarlar).
  - `assets/adaptive-icon.png`: 1024×1024, `gece`. Android maskesi kenarları kırptığı için yazı ve çubuklar merkezdeki %66'lık güvenli alanda kalmalı; gerekirse içeriği 0.8 ölçekle ortala, teller tüm alanı kaplamaya devam etsin.
  - `assets/splash-icon.png`: 1024×1024, şeffaf zeminde sadece "erişte" yazısı (`#F5F3F7`) ve çubuklar, tel yok.
- `app.config.js`: `name: "erişte"`, `icon: "./assets/icon.png"`, splash `backgroundColor: "#15131A"`, `image: "./assets/splash-icon.png"`, `resizeMode: "contain"`, Android `adaptiveIcon.backgroundColor: "#15131A"`. Bundle ID değişmeyecek.
- `package.json`'a `"brand:assets": "node scripts/generate-brand-assets.mjs"` ekle ve bir kez çalıştır.

---

## 5. Bitirince

1. Değişen ve eklenen dosyaların listesi.
2. Yeni paket var mı ve development build gerekip gerekmediği (`react-native-svg` yeni eklendiyse, ikon ve splash değiştiği için de yeni build gerekir: `eas build --profile development --platform ios`).
3. Test listesi:
   - Açık ve koyu temada: Welcome, giriş, kayıt, ana sayfa, katalog, ekleme, detay.
   - Ana sayfa balonu: yakın ödeme varken, yokken, hiç abonelik yokken.
   - Ekleme: üç soru, her birinde "Geç", son adımda "Kaydet"; misafirde ve girişli kullanıcıda.
   - Detay: "Takip listesinden kaldır" çalışıyor, zam anahtarı görünmüyor.
   - Eski logonun hiçbir yerde kalmadığını doğrulamak için proje genelinde `#FF5E57` ve eski logo bileşen adını ara.
   - Yeni ikon ana ekranda, splash açılışta doğru görünüyor.
4. Commit atma.

---

## Kod dışında kalanlar (bilgi için, uygulama yok)

App Store ve Google Play ekran görüntüleri, Google Play öne çıkan görseli ve sosyal medya şablonları (Instagram gönderisi ve hikâyesi, TikTok, X gönderisi ve kapağı, LinkedIn gönderisi ve kapağı, profil fotoğrafı) tasarım kanvasından PNG olarak dışa aktarılacak. Bunlar için kod yazma.
