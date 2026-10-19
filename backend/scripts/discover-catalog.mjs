#!/usr/bin/env node
//
// Katalog keşfi (web_search / web_fetch ile). Ayrıntı: src/services/catalogDiscovery.js
//
// Kullanım (backend klasöründen):
//   node scripts/discover-catalog.mjs --dry-run              # keşif planı + tahmini maliyet, yazmaz
//   node scripts/discover-catalog.mjs                        # Aşama 1: yeni servis/plan → draft
//   node scripts/discover-catalog.mjs --category "Müzik"     # yalnızca bu kategori(ler) (tekrarlanabilir)
//   node scripts/discover-catalog.mjs --prices --dry-run     # fiyat bulma planı + tahmini maliyet
//   node scripts/discover-catalog.mjs --prices               # Aşama 2: fiyatı olmayan taslaklar
//   node scripts/discover-catalog.mjs --prices --retry       # daha önce bulunamayanları da dene
//   node scripts/discover-catalog.mjs --prices --include-active   # yayındakileri de tara
//   node scripts/discover-catalog.mjs --prices --limit 20
//
// Ortak: --sync (tek tek, anında; varsayılan Message Batches, %50 ucuz token),
//        --max-searches N (varsayılan 200; sınıra gelince durur, kalanı raporlar).
//
// Gerekenler: DATABASE_URL, ANTHROPIC_API_KEY; isteğe bağlı CATALOG_DISCOVERY_MODEL.

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "..", ".env") });

// db.js bağlantıyı yüklenirken kurduğu için .env'den sonra yüklenir.
const require = createRequire(import.meta.url);
const db = require("../src/config/db");
const { DEFAULT_MAX_SEARCHES, runDiscovery, runPriceSearch } = require("../src/services/catalogDiscovery");

function parseArgs(argv) {
  const flags = {
    dryRun: false,
    prices: false,
    includeActive: false,
    retry: false,
    sync: false,
    maxSearches: DEFAULT_MAX_SEARCHES,
    categories: [],
    limit: null,
  };

  const positiveInt = (name, value) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`${name} pozitif bir tam sayı olmalı`);
    }
    return number;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--prices") flags.prices = true;
    else if (arg === "--include-active") flags.includeActive = true;
    else if (arg === "--retry") flags.retry = true;
    else if (arg === "--sync") flags.sync = true;
    else if (arg === "--max-searches") flags.maxSearches = positiveInt(arg, argv[++i]);
    else if (arg === "--limit") flags.limit = positiveInt(arg, argv[++i]);
    else if (arg === "--category") flags.categories.push(argv[++i]);
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }

  if (!flags.prices && (flags.includeActive || flags.retry || flags.limit)) {
    throw new Error("--include-active, --retry ve --limit yalnızca --prices ile kullanılır");
  }
  if (flags.prices && flags.categories.length) {
    throw new Error("--category yalnızca keşifte kullanılır");
  }

  return flags;
}

function printDiscoverySummary(summary) {
  console.log("\nKategori başına sonuç:");
  for (const stats of summary.categories) {
    const failed = stats.failed ? ` · HATA: ${stats.failed}` : "";
    console.log(`  ${stats.category}: eklenen ${stats.added}, atlanan ${stats.skipped}${failed}`);
    for (const item of stats.addedItems) {
      console.log(`    + ${item.app_name} — ${item.plan_name} (${item.domain})`);
    }
    for (const item of stats.skippedItems) {
      console.log(`    - ${item.app_name}${item.plan_name ? ` — ${item.plan_name}` : ""}: ${item.reason}`);
    }
  }
  console.log(`\nToplam: eklenen ${summary.added}, atlanan ${summary.skipped}, başarısız kategori ${summary.failed}`);
  if (summary.remainingCount) {
    console.log(`Arama sınırı nedeniyle kalan kategoriler: ${summary.remaining.join(", ")}`);
    console.log("Devam etmek için aynı komutu --category ile bu kategorilere çalıştır.");
  }
}

function printPriceSummary(summary) {
  console.log("\nSonuçlar:");
  for (const detail of summary.details) {
    const label = `${detail.app_name}${detail.plan_name ? ` — ${detail.plan_name}` : ""}`;
    const value =
      detail.status === "found"
        ? `${detail.price} ${detail.currency} (${detail.confidence})`
        : `${detail.status}${detail.reason ? `: ${detail.reason}` : ""}`;
    console.log(`  ${label}: ${value}`);
  }
  console.log(
    `\nToplam ${summary.total}: bulunan ${summary.found}, bulunamayan ${summary.notFound}, ` +
      `resmi olmayan/uyuşmayan ${summary.rejected}, hata ${summary.failed}`
  );
  if (summary.remainingCount) {
    console.log(
      `Arama sınırı nedeniyle kalan ${summary.remainingCount} kayıt; aynı komutu yeniden çalıştırınca ` +
        "kaldığı yerden devam eder."
    );
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const mode = flags.sync ? "sync" : "batch";
  const log = (message) => console.log(message);

  const result = flags.prices
    ? await runPriceSearch({
        mode,
        maxSearches: flags.maxSearches,
        includeActive: flags.includeActive,
        retry: flags.retry,
        limit: flags.limit,
        dryRun: flags.dryRun,
        log,
      })
    : await runDiscovery({
        mode,
        maxSearches: flags.maxSearches,
        categories: flags.categories.length ? flags.categories : undefined,
        dryRun: flags.dryRun,
        log,
      });

  if (result.dryRun) {
    console.log(`DRY-RUN (${flags.prices ? "fiyat bulma" : "keşif"}) — veritabanına yazılmadı, API çağrılmadı`);
    for (const line of result.lines) console.log(`  ${line}`);
    return;
  }

  if (flags.prices) printPriceSummary(result.summary);
  else printDiscoverySummary(result.summary);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
