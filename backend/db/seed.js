#!/usr/bin/env node
//
// subscriptions_catalog için ilk veri seti. Fiyatlar TRY cinsindendir,
// aksi belirtilmediği sürece. Her blok başındaki not, verinin güven
// seviyesini gösterir:
//   YÜKSEK      -> servisin kendi resmi fiyatlandırma sayfasından doğrulandı
//   ORTA        -> resmi sayfaya erişilemedi, güvenilir ikincil kaynak kullanıldı
//   DÜŞÜK       -> tek/çelişkili kaynak, kullanmadan önce elle doğrulayın
//   PLACEHOLDER -> gerçek fiyat bulunamadı; current_price = -1 ile işaretlendi,
//                  bu satırlar canlıya alınmadan MUTLAKA güncellenmeli
//
// current_price sütunu "not null" olduğu için gerçek bir fiyat
// bulunamayan kayıtlarda -1 sentinel değeri kullanıldı (0 ile
// karıştırılmasın diye; 0 "ücretsiz" anlamına gelebilir).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../src/config/db");

const CATALOG = [
  // --- Netflix (ORTA güven: resmi sayfa login gerektiriyor, aggregator kullanıldı) ---
  { app_name: "Netflix", plan_name: "Temel", current_price: 189.99, currency: "TRY", source_url: "https://www.netflix.com/tr/" },
  { app_name: "Netflix", plan_name: "Standart", current_price: 289.99, currency: "TRY", source_url: "https://www.netflix.com/tr/" },
  { app_name: "Netflix", plan_name: "Premium", current_price: 379.99, currency: "TRY", source_url: "https://www.netflix.com/tr/" },

  // --- Spotify (YÜKSEK güven: spotify.com/tr-tr/premium'dan doğrulandı) ---
  { app_name: "Spotify", plan_name: "Bireysel", current_price: 99.0, currency: "TRY", source_url: "https://www.spotify.com/tr-tr/premium/" },
  { app_name: "Spotify", plan_name: "Öğrenci", current_price: 55.0, currency: "TRY", source_url: "https://www.spotify.com/tr-tr/premium/" },
  { app_name: "Spotify", plan_name: "Duo", current_price: 135.0, currency: "TRY", source_url: "https://www.spotify.com/tr-tr/premium/" },
  { app_name: "Spotify", plan_name: "Aile", current_price: 165.0, currency: "TRY", source_url: "https://www.spotify.com/tr-tr/premium/" },

  // --- YouTube Premium (ORTA güven: birden fazla aggregator aynı rakamda uyuştu) ---
  { app_name: "YouTube Premium", plan_name: "Bireysel", current_price: 119.99, currency: "TRY", source_url: "https://www.youtube.com/premium" },
  { app_name: "YouTube Premium", plan_name: "Aile", current_price: 239.99, currency: "TRY", source_url: "https://www.youtube.com/premium" },
  { app_name: "YouTube Premium", plan_name: "Öğrenci", current_price: 79.99, currency: "TRY", source_url: "https://www.youtube.com/premium" },

  // --- Storytel (DÜŞÜK güven: çelişkili aggregator verisi, doğrulayın) ---
  { app_name: "Storytel", plan_name: "Standart", current_price: 329.99, currency: "TRY", source_url: "https://www.storytel.com/tr/tr/" },
  { app_name: "Storytel", plan_name: "Aile (3 Hesap)", current_price: 626.99, currency: "TRY", source_url: "https://www.storytel.com/tr/tr/" },

  // --- Exxen (DÜŞÜK güven: resmi site JS-render, veri çekilemedi) ---
  { app_name: "Exxen", plan_name: "Reklamlı", current_price: 219.0, currency: "TRY", source_url: "https://www.exxen.com/" },
  { app_name: "Exxen", plan_name: "Reklamsız", current_price: 309.0, currency: "TRY", source_url: "https://www.exxen.com/" },

  // --- HBO Max (eski BluTV) — PLACEHOLDER ---
  // ÖNEMLİ: BluTV artık TABii DEĞİL. BluTV, HBO Max'e (Warner Bros.
  // Discovery) dönüştü; TABii ise TRT'ye ait tamamen ayrı bir platform.
  // Güncel TL fiyatı doğrulanamadı.
  { app_name: "HBO Max", plan_name: "Standart", current_price: -1, currency: "TRY", source_url: null },

  // --- TABii Spor (DÜŞÜK güven) ---
  // Yalnızca "TABii Spor" (UEFA içerikleri) fiyatı bulundu; TABii'nin
  // genel/ücretsiz katmanları farklı olabilir, kontrol edin.
  { app_name: "TABii Spor", plan_name: "Aylık", current_price: 99.0, currency: "TRY", source_url: "https://www.tabii.com/" },

  // --- Disney+ (ORTA güven: aggregator kaynaklı) ---
  { app_name: "Disney+", plan_name: "Standart (Reklamlı)", current_price: 249.9, currency: "TRY", source_url: "https://www.disneyplus.com/tr-tr" },
  { app_name: "Disney+", plan_name: "Premium (Reklamsız)", current_price: 449.9, currency: "TRY", source_url: "https://www.disneyplus.com/tr-tr" },

  // --- ChatGPT Plus — TRY karşılığı doğrulanamadı, global USD liste fiyatı kullanıldı ---
  { app_name: "ChatGPT Plus", plan_name: "Plus", current_price: 20.0, currency: "USD", source_url: "https://openai.com/chatgpt/pricing" },

  // --- Claude Pro — TRY karşılığı doğrulanamadı, global USD liste fiyatı kullanıldı ---
  { app_name: "Claude Pro", plan_name: "Pro", current_price: 20.0, currency: "USD", source_url: "https://www.anthropic.com/pricing" },

  // --- Adobe Creative Cloud (ORTA güven: resmi sayfadan; "All Apps" adı ---
  // "Creative Cloud Pro" olarak değişmiş görünüyor, kontrol edin) ---
  { app_name: "Adobe Creative Cloud", plan_name: "Creative Cloud Pro (Aylık, Taahhütsüz)", current_price: 1627.2, currency: "TRY", source_url: "https://www.adobe.com/tr/creativecloud/plans.html" },
  { app_name: "Adobe Creative Cloud", plan_name: "Creative Cloud Pro (Yıllık Taahhüt, Aylık Ödeme)", current_price: 837.6, currency: "TRY", source_url: "https://www.adobe.com/tr/creativecloud/plans.html" },

  // --- Canva Pro — PLACEHOLDER: kaynaklar birbiriyle çelişiyor ---
  { app_name: "Canva Pro", plan_name: "Pro", current_price: -1, currency: "TRY", source_url: null },

  // --- iCloud+ (ORTA güven: aggregator kaynaklı) ---
  { app_name: "iCloud+", plan_name: "50GB", current_price: 39.99, currency: "TRY", source_url: "https://www.apple.com/tr/icloud/" },
  { app_name: "iCloud+", plan_name: "200GB", current_price: 129.99, currency: "TRY", source_url: "https://www.apple.com/tr/icloud/" },
  { app_name: "iCloud+", plan_name: "2TB", current_price: 399.99, currency: "TRY", source_url: "https://www.apple.com/tr/icloud/" },

  // --- Google One (YÜKSEK güven: one.google.com/about/plans'dan doğrulandı; ---
  // plan adları değişmiş: eski 100GB/200GB/2TB yerine Basic/AI Plus/AI Pro) ---
  { app_name: "Google One", plan_name: "Basic (100GB)", current_price: 84.99, currency: "TRY", source_url: "https://one.google.com/about/plans" },
  { app_name: "Google One", plan_name: "Google AI Plus (2TB)", current_price: 359.99, currency: "TRY", source_url: "https://one.google.com/about/plans" },
  { app_name: "Google One", plan_name: "Google AI Pro (5TB)", current_price: 869.99, currency: "TRY", source_url: "https://one.google.com/about/plans" },

  // --- Microsoft 365 — PLACEHOLDER: resmi sayfaya erişilemedi ---
  { app_name: "Microsoft 365", plan_name: "Personal", current_price: -1, currency: "TRY", source_url: null },
  { app_name: "Microsoft 365", plan_name: "Family", current_price: -1, currency: "TRY", source_url: null },
];

async function seed() {
  const client = await db.connect();

  try {
    await client.query("begin");

    for (const item of CATALOG) {
      await client.query(
        "delete from subscriptions_catalog where app_name = $1 and plan_name = $2",
        [item.app_name, item.plan_name]
      );

      await client.query(
        `insert into subscriptions_catalog
           (app_name, plan_name, current_price, currency, source_url, last_checked_at)
         values ($1, $2, $3, $4, $5, now())`,
        [item.app_name, item.plan_name, item.current_price, item.currency, item.source_url]
      );
    }

    await client.query("commit");
    console.log(`${CATALOG.length} abonelik kaydı eklendi/güncellendi.`);

    const placeholders = CATALOG.filter((item) => item.current_price === -1);
    if (placeholders.length > 0) {
      console.log("\nUYARI: Aşağıdaki kayıtlar PLACEHOLDER fiyatla (-1) eklendi, gerçek fiyatla güncellenmeden kullanılmamalı:");
      placeholders.forEach((item) => console.log(`  - ${item.app_name} / ${item.plan_name}`));
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

seed().catch((error) => {
  console.error("Seed işlemi başarısız:", error.message);
  process.exit(1);
});
