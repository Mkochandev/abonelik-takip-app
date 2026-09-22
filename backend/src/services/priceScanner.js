// Katalogdaki source_url'leri tarayıp Anthropic API'sine sayfa içeriğini
// vererek güncel TL fiyatını çıkarmaya çalışan servis.

const db = require("../config/db");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DELAY_BETWEEN_SCANS_MS = 2000;
const MAX_PAGE_TEXT_LENGTH = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// HTML'i script/style etiketlerinden ve fazla boşluktan arındırıp düz
// metne indirger (token tasarrufu için — cheerio'ya gerek yok, bu kadar
// kaba bir temizlik fiyat metnini yakalamak için yeterli).
function htmlToPlainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT_LENGTH);
}

async function extractPriceWithClaude(pageText, appName, planName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil");
  }

  const label = planName ? `${appName} - ${planName}` : appName;
  const prompt =
    `Bu sayfa içeriğinden ${label} aboneliğinin güncel TL fiyatını çıkar. ` +
    `Sadece JSON formatında dön: {"price": number veya null, "confidence": "high"|"medium"|"low"}. ` +
    `Fiyatı sayfada bulamazsan price: null dön.\n\nSayfa içeriği:\n${pageText}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API ${response.status} döndü: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;

  if (!text) {
    throw new Error("Anthropic yanıtında metin bulunamadı");
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Yanıt JSON içermiyor: " + text.slice(0, 200));
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.price !== null && typeof parsed.price !== "number") {
    throw new Error("Yanıttaki price alanı geçersiz");
  }

  if (!["high", "medium", "low"].includes(parsed.confidence)) {
    throw new Error("Yanıttaki confidence alanı geçersiz");
  }

  return parsed;
}

// Tek bir katalog kaydını tarar: sayfayı çeker, Claude'a fiyatı sorar,
// gerekiyorsa current_price'ı günceller ve eski fiyatı price_history'e
// yazar. Her durumda last_checked_at'i günceller.
async function scanSinglePrice(catalogItem) {
  try {
    const response = await fetch(catalogItem.source_url);
    if (!response.ok) {
      throw new Error(`Sayfa ${response.status} döndü`);
    }

    const html = await response.text();
    const pageText = htmlToPlainText(html);

    const { price, confidence } = await extractPriceWithClaude(
      pageText,
      catalogItem.app_name,
      catalogItem.plan_name
    );

    if (price === null || confidence === "low") {
      await db.query("update subscriptions_catalog set last_checked_at = now() where id = $1", [
        catalogItem.id,
      ]);

      return { id: catalogItem.id, app_name: catalogItem.app_name, status: "unchanged", price, confidence };
    }

    const oldPrice = Number(catalogItem.current_price);
    const priceChanged = Math.abs(price - oldPrice) > 0.001;

    if (priceChanged) {
      await db.query(
        "insert into price_history (catalog_id, price, changed_at) values ($1, $2, now())",
        [catalogItem.id, oldPrice]
      );

      await db.query(
        "update subscriptions_catalog set current_price = $1, last_checked_at = now() where id = $2",
        [price, catalogItem.id]
      );

      return {
        id: catalogItem.id,
        app_name: catalogItem.app_name,
        status: "updated",
        oldPrice,
        newPrice: price,
        confidence,
      };
    }

    await db.query("update subscriptions_catalog set last_checked_at = now() where id = $1", [
      catalogItem.id,
    ]);

    return { id: catalogItem.id, app_name: catalogItem.app_name, status: "unchanged", price, confidence };
  } catch (error) {
    console.error(`priceScanner: ${catalogItem.app_name} taranırken hata:`, error.message);
    return { id: catalogItem.id, app_name: catalogItem.app_name, status: "failed", error: error.message };
  }
}

// Katalogdaki source_url'i olan tüm kayıtları sırayla tarar, aralarına
// rate limit'e takılmamak için 2 saniye bekleme koyar.
async function scanAllPrices() {
  const { rows } = await db.query(
    "select * from subscriptions_catalog where source_url is not null order by app_name, plan_name"
  );

  const details = [];

  for (let i = 0; i < rows.length; i += 1) {
    const result = await scanSinglePrice(rows[i]);
    details.push(result);

    if (i < rows.length - 1) {
      await sleep(DELAY_BETWEEN_SCANS_MS);
    }
  }

  const summary = {
    total: details.length,
    updated: details.filter((d) => d.status === "updated").length,
    unchanged: details.filter((d) => d.status === "unchanged").length,
    failed: details.filter((d) => d.status === "failed").length,
    details,
  };

  return summary;
}

module.exports = { scanSinglePrice, scanAllPrices };
