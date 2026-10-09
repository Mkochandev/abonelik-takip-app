#!/usr/bin/env node
//
// Katalog genişletme: backend/data/catalog-seed.json'daki kayıtlardan
// katalogda olmayanları taslak (status = 'draft') olarak ekler, ardından
// fiyatı olmayan taslakları fiyat tarayıcıdan geçirir (Message Batches API,
// ucuz model, %50 indirimli). Bulunan fiyat price_status = 'unverified'
// olarak yazılır; yayına alma admin panelindeki "Taslaklar" sekmesinden.
//
// Kullanım (backend klasöründen):
//   node scripts/seed-catalog.mjs              # ekle + tara
//   node scripts/seed-catalog.mjs --no-scan    # yalnızca ekle
//   node scripts/seed-catalog.mjs --scan-only  # yalnızca fiyatsız taslakları tara
//   node scripts/seed-catalog.mjs --rescan     # fiyatı bulunmuş taslakları da yeniden tara
//   node scripts/seed-catalog.mjs --dry-run    # neyin ekleneceğini göster, yazma
//   node scripts/seed-catalog.mjs --file başka.json
//
// Gerekenler: DATABASE_URL, tarama için ANTHROPIC_API_KEY (backend/.env).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(here, "..");
dotenv.config({ path: path.join(BACKEND_DIR, ".env") });

// db.js bağlantıyı yüklenirken kurduğu için .env'den sonra yüklenir.
const require = createRequire(import.meta.url);
const db = require("../src/config/db");
const { htmlToPlainText } = require("../src/services/priceScanner");

// Kullanıcı "ucuz model" istedi: güncel Haiku.
const MODEL = "claude-haiku-5-5";
const POLL_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_CONCURRENCY = 4;

const CATEGORIES = [
  "Video/Dizi-Film",
  "Müzik",
  "Kitap/Sesli Kitap",
  "Yapay Zeka",
  "Bulut Depolama",
  "Üretkenlik/Tasarım",
  "Oyun",
  "Alışveriş/Üyelik",
  "VPN/Güvenlik",
  "Spor",
];
const CURRENCIES = ["TRY", "USD", "EUR"];
const BILLING_CYCLES = ["monthly", "yearly"];

const args = process.argv.slice(2);
const flags = {
  noScan: args.includes("--no-scan"),
  scanOnly: args.includes("--scan-only"),
  rescan: args.includes("--rescan"),
  dryRun: args.includes("--dry-run"),
  file: args.includes("--file")
    ? path.resolve(args[args.indexOf("--file") + 1])
    : path.join(BACKEND_DIR, "data", "catalog-seed.json"),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/\S+$/.test(value);
}

// JSON satırını doğrular; hata listesi döner (boşsa geçerli).
function validateEntry(entry) {
  const errors = [];
  if (!entry.app_name || typeof entry.app_name !== "string") errors.push("app_name");
  if (!entry.plan_name || typeof entry.plan_name !== "string") errors.push("plan_name");
  if (!CATEGORIES.includes(entry.category)) errors.push(`category (${entry.category})`);
  if (!entry.domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(entry.domain)) errors.push("domain");
  if (!isHttpsUrl(entry.source_url)) errors.push("source_url");
  if (entry.cancel_url != null && !isHttpsUrl(entry.cancel_url)) errors.push("cancel_url");
  if (!CURRENCIES.includes(entry.currency)) errors.push(`currency (${entry.currency})`);
  if (entry.billing_cycle != null && !BILLING_CYCLES.includes(entry.billing_cycle)) {
    errors.push("billing_cycle");
  }
  // Fiyatlar uydurulmaz; fiyatı yalnızca tarayıcı yazar.
  if ("current_price" in entry || "price" in entry) errors.push("fiyat alanı olmamalı");
  return errors;
}

async function seed() {
  const entries = JSON.parse(fs.readFileSync(flags.file, "utf8"));
  if (!Array.isArray(entries)) {
    throw new Error(`${flags.file} bir dizi olmalı`);
  }

  const invalid = entries
    .map((entry, index) => ({ index, entry, errors: validateEntry(entry) }))
    .filter((item) => item.errors.length > 0);

  if (invalid.length > 0) {
    for (const item of invalid) {
      console.error(`Geçersiz satır #${item.index} (${item.entry.app_name} ${item.entry.plan_name}):`, item.errors.join(", "));
    }
    throw new Error(`${invalid.length} geçersiz satır; hiçbir şey eklenmedi`);
  }

  // Tekrarı önleme: app_name + plan_name (büyük/küçük harf duyarsız).
  const { rows } = await db.query(
    "select lower(app_name) as app_name, lower(coalesce(plan_name, '')) as plan_name from subscriptions_catalog"
  );
  const existing = new Set(rows.map((row) => `${row.app_name}\u0000${row.plan_name}`));
  const key = (entry) =>
    `${entry.app_name.toLocaleLowerCase("tr-TR")}\u0000${entry.plan_name.toLocaleLowerCase("tr-TR")}`;
  const keyEn = (entry) => `${entry.app_name.toLowerCase()}\u0000${entry.plan_name.toLowerCase()}`;

  const toInsert = [];
  const skipped = [];
  for (const entry of entries) {
    if (existing.has(key(entry)) || existing.has(keyEn(entry))) {
      skipped.push(entry);
    } else {
      toInsert.push(entry);
      existing.add(key(entry));
      existing.add(keyEn(entry));
    }
  }

  console.log(`JSON: ${entries.length} satır · eklenecek ${toInsert.length} · zaten var ${skipped.length}`);
  for (const entry of skipped) {
    console.log(`  atlandı (var): ${entry.app_name} — ${entry.plan_name}`);
  }

  if (flags.dryRun) {
    for (const entry of toInsert) {
      console.log(`  eklenecek: ${entry.app_name} — ${entry.plan_name} (${entry.category})`);
    }
    return;
  }

  for (const entry of toInsert) {
    await db.query(
      `insert into subscriptions_catalog
         (app_name, plan_name, current_price, currency, billing_cycle, category, domain,
          source_url, cancel_url, source_note, status, price_status)
       values ($1, $2, null, $3, $4, $5, $6, $7, $8, $9, 'draft', 'unverified')`,
      [
        entry.app_name,
        entry.plan_name,
        entry.currency,
        entry.billing_cycle ?? "monthly",
        entry.category,
        entry.domain,
        entry.source_url,
        entry.cancel_url ?? null,
        entry.source_note ?? null,
      ]
    );
  }

  console.log(`${toInsert.length} taslak eklendi.`);
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
      return { error: `Sayfa ${response.status} döndü` };
    }
    const text = htmlToPlainText(await response.text());
    return text.length < 50 ? { error: "Sayfa metni boş (JS ile yükleniyor olabilir)" } : { text };
  } catch (err) {
    return { error: err.name === "AbortError" ? "Sayfa zaman aşımı" : `Sayfa alınamadı: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// Aynı adresi bir kez çeker; FETCH_CONCURRENCY kadar paralel.
async function fetchAll(urls) {
  const results = new Map();
  const queue = [...urls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      results.set(url, await fetchPageText(url));
    }
  }
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  return results;
}

const PRICE_SCHEMA = {
  type: "object",
  properties: {
    price: { anyOf: [{ type: "number" }, { type: "null" }] },
    currency: { type: "string", enum: ["TRY", "USD", "EUR", "unknown"] },
    billing_cycle: { type: "string", enum: ["monthly", "yearly", "unknown"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    note: { type: "string" },
  },
  required: ["price", "currency", "billing_cycle", "confidence", "note"],
  additionalProperties: false,
};

function buildPrompt(row, pageText) {
  const period = row.billing_cycle === "yearly" ? "yıllık" : "aylık";
  return (
    `Aşağıdaki sayfa ${row.app_name} servisinin resmi Türkiye fiyat sayfası.\n` +
    `Aradığım plan: "${row.plan_name}" (${period} ödeme, beklenen para birimi ${row.currency}).\n\n` +
    "Sayfada bu planın Türkiye'de güncel olarak satılan fiyatını bul.\n" +
    "- Fiyat sayfada açıkça yazmıyorsa price: null dön; tahmin etme, başka planın ya da başka ülkenin fiyatını yazma.\n" +
    "- İndirimli/ilk ay kampanya fiyatı yerine normal liste fiyatını yaz; kampanya varsa note'ta belirt.\n" +
    "- price yalnızca sayı olsun (ör. 229.99). currency: TRY, USD ya da EUR (bilinmiyorsa unknown).\n" +
    "- billing_cycle: bulduğun fiyatın dönemi (monthly/yearly; bilinmiyorsa unknown).\n" +
    "- note: kısa Türkçe açıklama (fiyatı nerede gördüğün ya da neden bulamadığın).\n\n" +
    `Sayfa içeriği:\n${pageText}`
  );
}

async function scanDrafts() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil (backend/.env)");
  }

  const { rows: drafts } = await db.query(
    `select * from subscriptions_catalog
     where status = 'draft' and source_url is not null and managed_by is null
       ${flags.rescan ? "" : "and current_price is null"}
     order by app_name, plan_name`
  );

  if (drafts.length === 0) {
    console.log("Taranacak taslak yok.");
    return;
  }

  console.log(`${drafts.length} taslak taranacak; sayfalar çekiliyor...`);
  const pages = await fetchAll(Array.from(new Set(drafts.map((row) => row.source_url))));

  const requests = [];
  let pageFailures = 0;
  for (const row of drafts) {
    const page = pages.get(row.source_url);
    if (page.error) {
      pageFailures += 1;
      await db.query(
        "update subscriptions_catalog set source_note = $2, last_checked_at = now() where id = $1",
        [row.id, `Tarayıcı: ${page.error}`]
      );
      continue;
    }
    requests.push({
      custom_id: row.id,
      params: {
        model: MODEL,
        max_tokens: 2048,
        output_config: { effort: "low", format: { type: "json_schema", schema: PRICE_SCHEMA } },
        messages: [{ role: "user", content: buildPrompt(row, page.text) }],
      },
    });
  }

  console.log(`Sayfası alınamayan: ${pageFailures} · Batch'e giden: ${requests.length}`);
  if (requests.length === 0) {
    return;
  }

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests });
  console.log(`Batch oluşturuldu: ${batch.id}`);

  let current = batch;
  while (current.processing_status !== "ended") {
    await sleep(POLL_INTERVAL_MS);
    current = await client.messages.batches.retrieve(batch.id);
    const counts = current.request_counts;
    console.log(
      `  durum: ${current.processing_status} · işleniyor ${counts.processing} · başarılı ${counts.succeeded} · hata ${counts.errored}`
    );
  }

  const rowsById = new Map(drafts.map((row) => [row.id, row]));
  const summary = { found: 0, notFound: 0, failed: 0 };

  // Sonuçlar herhangi bir sırada gelir; custom_id (katalog id) ile eşlenir.
  for await (const result of await client.messages.batches.results(batch.id)) {
    const row = rowsById.get(result.custom_id);
    if (!row) continue;

    let note;
    let price = null;

    if (result.result.type !== "succeeded") {
      summary.failed += 1;
      note = `Tarayıcı: istek ${result.result.type}`;
    } else if (result.result.message.stop_reason === "refusal") {
      summary.failed += 1;
      note = "Tarayıcı: model yanıtlamadı (refusal)";
    } else {
      const textBlock = result.result.message.content.find((block) => block.type === "text");
      let parsed = null;
      try {
        parsed = JSON.parse(textBlock?.text ?? "");
      } catch (err) {
        parsed = null;
      }

      if (!parsed) {
        summary.failed += 1;
        note = "Tarayıcı: yanıt okunamadı";
      } else if (parsed.price == null || parsed.confidence === "low") {
        summary.notFound += 1;
        note = `Tarayıcı (${parsed.confidence}): fiyat bulunamadı. ${parsed.note}`;
      } else if (parsed.currency !== "unknown" && parsed.currency !== row.currency) {
        summary.notFound += 1;
        note = `Tarayıcı: para birimi uyuşmuyor (${parsed.currency} ${parsed.price}, beklenen ${row.currency}). ${parsed.note}`;
      } else if (parsed.billing_cycle !== "unknown" && parsed.billing_cycle !== row.billing_cycle) {
        summary.notFound += 1;
        note = `Tarayıcı: dönem uyuşmuyor (${parsed.billing_cycle} ${parsed.price}). ${parsed.note}`;
      } else {
        summary.found += 1;
        price = parsed.price;
        note = `Tarayıcı (${parsed.confidence}): ${parsed.note}`;
      }
    }

    await db.query(
      `update subscriptions_catalog
       set current_price = coalesce($2, current_price),
           price_status = 'unverified',
           source_note = $3,
           last_checked_at = now()
       where id = $1 and status = 'draft'`,
      [row.id, price, note.slice(0, 1000)]
    );
  }

  console.log(
    `Tarama bitti: fiyat bulundu ${summary.found} · bulunamadı ${summary.notFound} · hata ${summary.failed} · sayfa alınamadı ${pageFailures}`
  );
}

async function main() {
  try {
    if (!flags.scanOnly) {
      await seed();
    }
    if (!flags.noScan && !flags.dryRun) {
      await scanDrafts();
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
