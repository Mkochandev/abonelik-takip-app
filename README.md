# Abonelik Takip Uygulaması

Kullanıcıların sahip olduğu dijital abonelikleri (Netflix, Spotify vb.) takip edebildiği, fiyatların AI destekli bir sistemle otomatik güncellendiği ve aylık gelir-gider takibinin yapılabildiği bir mobil uygulama.

## Özellikler (planlanan)

- Kullanıcının sahip olduğu abonelikleri seçip yönetmesi
- Abonelik fiyatlarının AI destekli sistemle otomatik güncellenmesi
- Aylık gelir-gider (bütçe) takibi

## Proje Yapısı

```
.
├── mobile/    # Expo (React Native) mobil uygulaması
└── backend/   # Node.js API
```

### mobile/

Expo ile oluşturulmuş React Native projesi.

```bash
cd mobile
npm install
npm start
```

### backend/

Express tabanlı API iskeleti. Henüz bir veritabanına bağlı değildir.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Durum

Proje henüz başlangıç aşamasında; bu iskelet üzerine özellikler adım adım eklenecektir.
