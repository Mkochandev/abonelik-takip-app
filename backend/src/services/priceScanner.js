// Katalogdaki source_url'leri tarayıp Anthropic API'sine sayfa içeriğini
// vererek güncel TL fiyatını çıkarmaya çalışan servis.
//
// İki yol var:
// - scanAllPrices: kayıtları tek tek, anında tarar (admin paneli "Fiyat tara").
// - scanAllPricesBatch: bütün istekleri tek bir Message Batch olarak gönderir
//   (%50 ucuz, sonuç 24 saate kadar sürebilir; haftalık cron). Batch id'si
//   price_scan_batches'e yazılır; backend yeniden başlarsa
//   resumePendingBatches yarım kalanların sonuçlarını işler.

const { Anthropic, NotFoundError } = require("@anthropic-ai/sdk");

const db = require("../config/db");

// Tarayıcı ve scripts/seed-catalog.mjs aynı modeli kullanır. Model yapılandırılmış
// çıktıyı (output_config.format) ve effort'u desteklemeli.
const DEFAULT_SCAN_MODEL = "claude-haiku-5-5";
// Model yanıttan önce düşünebildiği için çıktı sınırı JSON'dan geniş tutulur.
const MAX_OUTPUT_TOKENS = 2048;
const DELAY_BETWEEN_SCANS_MS = 2000;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_CONCURRENCY = 4;
const MAX_PAGE_TEXT_LENGTH = 6000;
// Uzun sayfalarda fiyat geçen yerlerin çevresinden bu kadar karakter alınır.
const PRICE_CONTEXT_CHARS = 400;
const BATCH_POLL_INTERVAL_MS = 5 * 60 * 1000;
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
const BATCH_CANCEL_WAIT_MS = 10 * 60 * 1000;

const PRICE_SCHEMA = {
  type: "object",
  properties: {
    price: { anyOf: [{ type: "number" }, { type: "null" }] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["price", "confidence"],
  additionalProperties: false,
};

let client = null;

function getScanModel() {
  return process.env.PRICE_SCAN_MODEL?.trim() || DEFAULT_SCAN_MODEL;
}

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil");
  }
  client ??= new Anthropic();
  return client;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HTML_ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#8378;": "₺",
};

// Fiyat sayfadaki metnin küçük bir kısmında geçer; uzun sayfalarda ₺/TL/TRY
// ya da ondalıklı sayı geçen yerlerin çevresi alınır, kalanı atılır.
const PRICE_PATTERN = /₺|\bTL\b|\bTRY\b|\d+[.,]\d{2}\b/g;

function shortenAroundPrices(text) {
  if (text.length <= MAX_PAGE_TEXT_LENGTH) {
    return text;
  }

  const ranges = [];
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const start = Math.max(0, match.index - PRICE_CONTEXT_CHARS);
    const end = Math.min(text.length, match.index + PRICE_CONTEXT_CHARS);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1]) {
      last[1] = end;
    } else {
      ranges.push([start, end]);
    }
  }

  if (ranges.length === 0) {
    return text.slice(0, MAX_PAGE_TEXT_LENGTH);
  }

  return ranges
    .map(([start, end]) => text.slice(start, end))
    .join(" … ")
    .slice(0, MAX_PAGE_TEXT_LENGTH);
}

// HTML'i düz metne indirger (token tasarrufu için — cheerio'ya gerek yok, bu
// kadar kaba bir temizlik fiyat metnini yakalamak için yeterli): head,
// script/style, menü ve alt bilgi gibi fiyat içermeyen bölümler atılır.
function htmlToPlainText(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(head|script|style|noscript|svg|iframe|template|nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|#8378);/g, (entity) => HTML_ENTITIES[entity])
    .replace(/\s+/g, " ")
    .trim();

  return shortenAroundPrices(text);
}

async function fetchPageText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; eristeFiyatTarayici/1.0)",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.5",
      },
    });
    if (!response.ok) {
      throw new Error(`Sayfa ${response.status} döndü`);
    }
    return htmlToPlainText(await response.text());
  } catch (error) {
    throw error.name === "AbortError" ? new Error("Sayfa zaman aşımı") : error;
  } finally {
    clearTimeout(timer);
  }
}

// Taranacak kayıtlar: yayındaki (active) ve source_url'i olanlar. Gizli
// (hidden) ve taslak kayıtlar status filtresiyle, erişte Premium'un kendi
// kayıtları (managed_by = 'revenuecat', fiyatı RevenueCat'ten gelir) ise
// managed_by filtresiyle dışarıda kalır. Taslaklar scripts/seed-catalog.mjs
// ile taranır.
async function fetchScanTargets() {
  const { rows } = await db.query(
    `select * from subscriptions_catalog
     where source_url is not null and managed_by is null and status = 'active'
     order by app_name, plan_name`
  );
  return rows;
}

function buildMessageParams(catalogItem, pageText) {
  const label = catalogItem.plan_name
    ? `${catalogItem.app_name} - ${catalogItem.plan_name}`
    : catalogItem.app_name;
  const prompt =
    `Bu sayfa içeriğinden ${label} aboneliğinin güncel TL fiyatını çıkar. ` +
    `Fiyatı sayfada bulamazsan price: null dön.\n\nSayfa içeriği:\n${pageText}`;

  return {
    model: getScanModel(),
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: "low", format: { type: "json_schema", schema: PRICE_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  };
}

function parseExtraction(message) {
  if (message.stop_reason === "refusal") {
    throw new Error("Model yanıtlamadı (refusal)");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("Yanıt çıktı sınırında kesildi");
  }

  const text = message.content.find((block) => block.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic yanıtında metin bulunamadı");
  }

  const parsed = JSON.parse(text);

  if (parsed.price !== null && typeof parsed.price !== "number") {
    throw new Error("Yanıttaki price alanı geçersiz");
  }

  if (!["high", "medium", "low"].includes(parsed.confidence)) {
    throw new Error("Yanıttaki confidence alanı geçersiz");
  }

  return parsed;
}

// Çıkarılan fiyatı kayda uygular: gerekiyorsa current_price'ı günceller ve
// eski fiyatı price_history'e yazar. Her durumda last_checked_at'i günceller.
async function applyExtraction(catalogItem, { price, confidence }) {
  const base = { id: catalogItem.id, app_name: catalogItem.app_name };

  if (price === null || confidence === "low") {
    await db.query("update subscriptions_catalog set last_checked_at = now() where id = $1", [
      catalogItem.id,
    ]);

    return { ...base, status: "unchanged", price, confidence };
  }

  const oldPrice = Number(catalogItem.current_price);
  const priceChanged = Math.abs(price - oldPrice) > 0.001;

  if (priceChanged) {
    await db.query(
      `insert into price_history (catalog_id, price, new_price, source, changed_at)
       values ($1, $2, $3, 'scanner', now())`,
      [catalogItem.id, oldPrice, price]
    );

    await db.query(
      "update subscriptions_catalog set current_price = $1, last_checked_at = now() where id = $2",
      [price, catalogItem.id]
    );

    return { ...base, status: "updated", oldPrice, newPrice: price, confidence };
  }

  await db.query("update subscriptions_catalog set last_checked_at = now() where id = $1", [
    catalogItem.id,
  ]);

  return { ...base, status: "unchanged", price, confidence };
}

function failedResult(catalogItem, error) {
  console.error(`priceScanner: ${catalogItem.app_name} taranırken hata:`, error.message);
  return { id: catalogItem.id, app_name: catalogItem.app_name, status: "failed", error: error.message };
}

function emptyUsage() {
  return { input_tokens: 0, output_tokens: 0 };
}

function addUsage(total, usage) {
  if (!usage) return;
  total.input_tokens += usage.input_tokens ?? 0;
  total.output_tokens += usage.output_tokens ?? 0;
}

function buildSummary(details, stats) {
  return {
    total: details.length,
    updated: details.filter((d) => d.status === "updated").length,
    unchanged: details.filter((d) => d.status === "unchanged").length,
    failed: details.filter((d) => d.status === "failed").length,
    requests: stats.requests,
    usage: stats.usage,
    details,
  };
}

// Toplam istek: modele giden istek sayısı (sayfası alınamayan kayıtlar
// modele gitmez ama başarısız sayılır).
function logScanSummary(label, summary) {
  const succeeded = summary.total - summary.failed;
  const { input_tokens, output_tokens } = summary.usage;
  console.log(
    `priceScanner[${label}]: tarama bitti — kayıt ${summary.total}, model isteği ${summary.requests}, ` +
      `başarılı ${succeeded} (güncellenen ${summary.updated}, değişmeyen ${summary.unchanged}), ` +
      `başarısız ${summary.failed}, token: girdi ${input_tokens} + çıktı ${output_tokens} = ` +
      `${input_tokens + output_tokens}`
  );
}

// Tek bir katalog kaydını anında tarar: sayfayı çeker, Claude'a fiyatı sorar
// ve sonucu kayda uygular. stats verilirse istek ve token sayıları eklenir.
async function scanSinglePrice(catalogItem, stats = { requests: 0, usage: emptyUsage() }) {
  try {
    const pageText = await fetchPageText(catalogItem.source_url);

    stats.requests += 1;
    const message = await getClient().messages.create(buildMessageParams(catalogItem, pageText));
    addUsage(stats.usage, message.usage);

    return await applyExtraction(catalogItem, parseExtraction(message));
  } catch (error) {
    return failedResult(catalogItem, error);
  }
}

// Kayıtları sırayla tarar, aralarına rate limit'e takılmamak için 2 saniye
// bekleme koyar. onProgress verilirse her kayıttan sonra (tamamlanan, toplam)
// ile çağrılır.
async function scanAllPrices({ onProgress } = {}) {
  const rows = await fetchScanTargets();
  const stats = { requests: 0, usage: emptyUsage() };
  const details = [];

  for (let i = 0; i < rows.length; i += 1) {
    const result = await scanSinglePrice(rows[i], stats);
    details.push(result);
    onProgress?.(details.length, rows.length);

    if (i < rows.length - 1) {
      await sleep(DELAY_BETWEEN_SCANS_MS);
    }
  }

  const summary = buildSummary(details, stats);
  logScanSummary("anında", summary);
  return summary;
}

// Aynı adresi bir kez çeker; FETCH_CONCURRENCY kadar paralel. Değer metin ya
// da Error olur.
async function fetchAllPages(urls) {
  const pages = new Map();
  const queue = [...urls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      pages.set(url, await fetchPageText(url).catch((error) => error));
    }
  }
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  return pages;
}


// Bu süreçte işlenmekte olan batch'ler; açılıştaki devam ile cron aynı batch'i
// iki kez işlemesin.
const activeBatchIds = new Set();

// Batch bitene kadar periyodik olarak bekler. deadline geçerse batch iptal
// edilir; o ana kadar biten istekler yine işlenir, kalanlar "canceled" döner.
async function waitForBatch(batchId, { pollIntervalMs, deadline }) {
  let batch = await getClient().messages.batches.retrieve(batchId);

  while (batch.processing_status !== "ended") {
    if (Date.now() >= deadline) {
      console.warn(`priceScanner[batch]: ${batchId} süre sınırını aştı, iptal ediliyor`);
      await getClient().messages.batches.cancel(batchId);
      const cancelDeadline = Date.now() + BATCH_CANCEL_WAIT_MS;
      while (batch.processing_status !== "ended" && Date.now() < cancelDeadline) {
        await sleep(30_000);
        batch = await getClient().messages.batches.retrieve(batchId);
      }
      return batch;
    }

    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    batch = await getClient().messages.batches.retrieve(batchId);
    const counts = batch.request_counts;
    console.log(
      `priceScanner[batch]: ${batchId} ${batch.processing_status} — işleniyor ${counts.processing}, ` +
        `başarılı ${counts.succeeded}, hata ${counts.errored}`
    );
  }

  return batch;
}

async function finishBatchRecord(batchId, status, error = null) {
  await db.query(
    "update price_scan_batches set status = $2, error = $3, finished_at = now() where id = $1",
    [batchId, status, error]
  );
}

// Batch'in bitmesini bekler ve sonuçlarını kayıtlara uygular. Kayıtlar batch
// bittikten sonra okunur (beklerken admin fiyatı değiştirmiş olabilir).
// NotFound ya da süre aşımında kayıt 'failed' olur; diğer hatalarda (ağ, DB)
// 'pending' kalır ve sonraki açılışta/cron'da yeniden denenir.
async function collectBatchResults(batchId, catalogIds, { pollIntervalMs, deadline, details, stats }) {
  activeBatchIds.add(batchId);
  try {
    let batch;
    try {
      batch = await waitForBatch(batchId, { pollIntervalMs, deadline });
    } catch (error) {
      if (error instanceof NotFoundError) {
        await finishBatchRecord(batchId, "failed", "Batch bulunamadı");
      }
      throw error;
    }

    const { rows } = await db.query(
      "select * from subscriptions_catalog where id = any($1::uuid[]) and managed_by is null",
      [catalogIds]
    );
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const pending = new Set(catalogIds);

    if (batch.processing_status === "ended") {
      // Sonuçlar herhangi bir sırada gelir; custom_id katalog id'sidir.
      for await (const result of await getClient().messages.batches.results(batchId)) {
        if (!pending.delete(result.custom_id)) continue;
        const row = rowsById.get(result.custom_id);
        if (!row) {
          details.push(failedResult({ id: result.custom_id, app_name: result.custom_id }, new Error("Katalog kaydı yok")));
          continue;
        }

        if (result.result.type !== "succeeded") {
          details.push(failedResult(row, new Error(`Batch isteği ${result.result.type}`)));
          continue;
        }

        addUsage(stats.usage, result.result.message.usage);
        try {
          details.push(await applyExtraction(row, parseExtraction(result.result.message)));
        } catch (error) {
          details.push(failedResult(row, error));
        }
      }
    }

    for (const id of pending) {
      details.push(failedResult(rowsById.get(id) ?? { id, app_name: id }, new Error("Batch sonucu alınamadı")));
    }

    if (batch.processing_status === "ended") {
      await finishBatchRecord(batchId, "processed");
    } else {
      await finishBatchRecord(batchId, "failed", "Süre sınırı aşıldı, batch bitmedi");
    }
  } finally {
    activeBatchIds.delete(batchId);
  }
}

// Bütün kayıtları tek bir Message Batch ile tarar (%50 ucuz). Sayfalar önce
// çekilir; sayfası alınamayan kayıtlar modele gönderilmeden başarısız sayılır.
async function scanAllPricesBatch({
  pollIntervalMs = BATCH_POLL_INTERVAL_MS,
  maxWaitMs = BATCH_MAX_WAIT_MS,
} = {}) {
  const rows = await fetchScanTargets();
  const stats = { requests: 0, usage: emptyUsage() };
  const details = [];

  const pages = await fetchAllPages(new Set(rows.map((row) => row.source_url)));

  const requests = [];
  for (const row of rows) {
    const page = pages.get(row.source_url);
    if (page instanceof Error) {
      details.push(failedResult(row, page));
      continue;
    }
    // custom_id katalog id'si (uuid); sonuçlar herhangi bir sırada gelir.
    requests.push({ custom_id: row.id, params: buildMessageParams(row, page) });
  }

  stats.requests = requests.length;

  if (requests.length > 0) {
    const catalogIds = requests.map((request) => request.custom_id);
    const created = await getClient().messages.batches.create({ requests });
    console.log(`priceScanner[batch]: ${created.id} oluşturuldu (${requests.length} istek)`);

    // Kayıt yazılamasa da bu süreçte sonuçlar yine işlenir; yalnızca yeniden
    // başlatmada devam edilemez.
    try {
      await db.query("insert into price_scan_batches (id, catalog_ids) values ($1, $2::uuid[])", [
        created.id,
        catalogIds,
      ]);
    } catch (error) {
      console.error(`priceScanner[batch]: ${created.id} veritabanına yazılamadı:`, error.message);
    }

    await collectBatchResults(created.id, catalogIds, {
      pollIntervalMs,
      deadline: Date.now() + maxWaitMs,
      details,
      stats,
    });
  }

  const summary = buildSummary(details, stats);
  logScanSummary("batch", summary);
  return summary;
}

// Yarım kalmış (status = 'pending') batch'lerin sonuçlarını işler; backend
// açılışında ve haftalık taramadan önce çağrılır. Bu süreçte zaten işlenen
// batch'ler atlanır. Süre sınırı batch'in oluşturulma zamanından sayılır.
async function resumePendingBatches({ pollIntervalMs = BATCH_POLL_INTERVAL_MS } = {}) {
  const { rows } = await db.query(
    "select id, catalog_ids, created_at from price_scan_batches where status = 'pending' order by created_at"
  );

  for (const record of rows) {
    if (activeBatchIds.has(record.id)) continue;

    console.log(`priceScanner[batch]: yarım kalan ${record.id} kaldığı yerden işleniyor`);
    const stats = { requests: record.catalog_ids.length, usage: emptyUsage() };
    const details = [];

    try {
      await collectBatchResults(record.id, record.catalog_ids, {
        pollIntervalMs,
        deadline: new Date(record.created_at).getTime() + BATCH_MAX_WAIT_MS,
        details,
        stats,
      });
      logScanSummary("batch-devam", buildSummary(details, stats));
    } catch (error) {
      console.error(`priceScanner[batch]: ${record.id} işlenemedi:`, error.message);
    }
  }
}

async function hasPendingBatches() {
  const { rows } = await db.query("select 1 from price_scan_batches where status = 'pending' limit 1");
  return rows.length > 0;
}

module.exports = {
  getScanModel,
  htmlToPlainText,
  scanSinglePrice,
  scanAllPrices,
  scanAllPricesBatch,
  resumePendingBatches,
  hasPendingBatches,
};
