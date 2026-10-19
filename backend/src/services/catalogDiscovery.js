// Katalog keşfi: Anthropic'in sunucu tarafı web_search / web_fetch araçlarıyla
// (1) kategori kategori Türkiye'de satılan yeni servis ve planları bulup
// taslak olarak ekler, (2) fiyatı olmayan taslakların resmi kaynaktaki
// fiyatını bulur. scripts/discover-catalog.mjs ve admin paneli kullanır.
//
// - Sonuç her zaman strict bir araç çağrısıyla gelir (web aramasında
//   citations hep açık olduğu için output_config.format kullanılamaz).
// - Hiçbir kayıt yayına alınmaz: keşif draft ekler, fiyat bulma
//   price_status = 'unverified' yazar.
// - maxSearches bütçesi istek başına en fazla arama (max_uses) üzerinden
//   ayrılır; yetmeyen iş "kalan" olarak raporlanır ve bir sonraki
//   çalıştırmada devam edilir (işlenen kayıtlar tekrar seçilmez).

const { Anthropic } = require("@anthropic-ai/sdk");

const db = require("../config/db");
const { CATEGORIES } = require("../config/categories");

const DEFAULT_MODEL = "claude-haiku-5-5";
const DEFAULT_MAX_SEARCHES = 200;
const DISCOVERY_SEARCHES_PER_CATEGORY = 8;
const PRICE_SEARCHES_PER_ITEM = 3;
const PRICE_FETCHES_PER_ITEM = 3;
const FETCH_MAX_CONTENT_TOKENS = 8000;
const DISCOVERY_MAX_TOKENS = 16000;
const PRICE_MAX_TOKENS = 4096;
// Sunucu tarafı döngü pause_turn ile durursa en fazla bu kadar devam edilir.
const MAX_PAUSE_CONTINUATIONS = 3;
const BATCH_POLL_INTERVAL_MS = 60_000;
const BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
const BATCH_CANCEL_WAIT_MS = 10 * 60 * 1000;
const MAX_EVIDENCE_LENGTH = 500;

// Web araması 1.000 aramada 10 $. Token fiyatları $/MTok (100K'ya kadar
// prompt); tabloda olmayan modelde yalnızca arama maliyeti hesaplanır.
const SEARCH_COST_USD = 0.01;
const TOKEN_PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
// Dry-run için kaba istek başı token tahmini (arama sonuçları girdiye eklenir).
const TOKEN_ESTIMATES = {
  discover: { input: 120_000, output: 4_000 },
  prices: { input: 40_000, output: 1_500 },
};

const CATEGORY_HINTS = {
  "Video/Dizi-Film": "dizi/film yayın platformları",
  Müzik: "müzik ve podcast yayın servisleri",
  "Kitap/Sesli Kitap": "e-kitap, sesli kitap ve dijital dergi abonelikleri",
  "Yapay Zeka": "yapay zekâ sohbet, görsel ve yazma araçlarının ücretli planları",
  "Bulut Depolama": "bulut depolama ve yedekleme servisleri",
  "Üretkenlik/Tasarım": "ofis, not, tasarım ve proje yönetimi araçları",
  Oyun: "oyun abonelikleri ve oyun platformlarının ücretli üyelikleri",
  "Alışveriş/Üyelik": "kargo, yemek ve market üyelikleri (e-ticaret ve teslimat uygulamalarının ücretli üyelik programları)",
  "VPN/Güvenlik": "VPN, antivirüs ve şifre yöneticileri",
  Spor: "spor yayın platformları ve fitness/antrenman uygulamaları",
  "Eğitim/Dil": "dil öğrenme ve online eğitim platformları",
  "Sağlık/Meditasyon": "meditasyon, uyku, beslenme ve sağlık uygulamaları",
  "Haber/Gazete": "dijital gazete ve haber abonelikleri",
  "Yazılım/Geliştirici": "yazılım geliştirme araçları ve geliştiriciye yönelik servisler",
  "Sosyal/Tanışma": "sosyal medya ve tanışma uygulamalarının premium üyelikleri",
  Diğer: "diğer kategorilere girmeyen dijital abonelikler",
};

const OFFICIAL_STORE_HOSTS = new Set(["apps.apple.com", "play.google.com"]);

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const DISCOVERY_TOOL = {
  name: "kesif_sonucunu_bildir",
  description:
    "Kategori araştırmasının sonucunu bildirir. Araştırma bitince bir kez çağrılır; bulunan " +
    "servisler services'e, elenen servisler sebebiyle skipped'e yazılır.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      services: {
        type: "array",
        items: {
          type: "object",
          properties: {
            app_name: { type: "string" },
            domain: { type: "string", description: "Resmi alan adı, www'suz (ör. netflix.com)" },
            pricing_url: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "Resmi fiyat sayfası, mümkünse Türkiye sayfası",
            },
            available_in_tr: { type: "boolean" },
            availability_reason: { type: "string", description: "Türkiye'de satılıp satılmadığının kısa gerekçesi" },
            popularity: { type: "string", enum: ["high", "medium", "low"] },
            plans: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  plan_name: { type: "string" },
                  billing_cycle: { type: "string", enum: ["monthly", "yearly"] },
                  paid: { type: "boolean", description: "Ücretli plan mı" },
                },
                required: ["plan_name", "billing_cycle", "paid"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "app_name",
            "domain",
            "pricing_url",
            "available_in_tr",
            "availability_reason",
            "popularity",
            "plans",
          ],
          additionalProperties: false,
        },
      },
      skipped: {
        type: "array",
        items: {
          type: "object",
          properties: {
            app_name: { type: "string" },
            reason: { type: "string" },
          },
          required: ["app_name", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["services", "skipped"],
    additionalProperties: false,
  },
};

const PRICE_TOOL = {
  name: "fiyati_bildir",
  description: "Planın bulunan fiyatını bildirir. Araştırma bitince bir kez çağrılır.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      price: { anyOf: [{ type: "number" }, { type: "null" }] },
      currency: { type: "string", enum: ["TRY", "USD", "EUR", "unknown"] },
      billing_cycle: { type: "string", enum: ["monthly", "yearly", "unknown"] },
      source_url: { anyOf: [{ type: "string" }, { type: "null" }] },
      source_type: {
        type: "string",
        enum: ["official_site", "app_store", "google_play", "official_help", "unofficial", "none"],
      },
      evidence: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["price", "currency", "billing_cycle", "source_url", "source_type", "evidence", "confidence"],
    additionalProperties: false,
  },
};

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY tanımlı değil");
  }
  client ??= new Anthropic();
  return client;
}

function getDiscoveryModel() {
  return process.env.CATALOG_DISCOVERY_MODEL?.trim() || DEFAULT_MODEL;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Modelin web aramasını desteklediğini Models API'den doğrular.
async function assertModelSupportsWebSearch(model) {
  const info = await getClient().models.retrieve(model);
  const supported = info.capabilities?.server_tools?.web_search?.supported;
  if (supported !== true) {
    throw new Error(
      `${model} web aramasını desteklemiyor (Models API capabilities.server_tools.web_search.supported = ` +
        `${supported ?? "yok"}). CATALOG_DISCOVERY_MODEL'i web aramasını destekleyen bir modelle değiştir.`
    );
  }
}

// "https://www.Netflix.com/tr/" -> "netflix.com"; geçersizse null.
function normalizeDomain(value) {
  const domain = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
  return DOMAIN_REGEX.test(domain) ? domain : null;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ");
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (error) {
    return null;
  }
}

function webSearchTool(maxUses) {
  return {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: maxUses,
    user_location: { type: "approximate", country: "TR", timezone: "Europe/Istanbul" },
  };
}

function webFetchTool(maxUses) {
  return {
    type: "web_fetch_20250910",
    name: "web_fetch",
    max_uses: maxUses,
    max_content_tokens: FETCH_MAX_CONTENT_TOKENS,
  };
}

// --- Kullanım ve maliyet ------------------------------------------------

function emptyUsage() {
  return {
    requests: 0,
    searches: 0,
    fetches: 0,
    input_tokens: 0,
    output_tokens: 0,
    // Batch'te işlenen tokenlar %50 indirimli.
    batch_input_tokens: 0,
    batch_output_tokens: 0,
  };
}

function addUsage(usage, messageUsage, { batch = false } = {}) {
  usage.requests += 1;
  if (!messageUsage) return;
  const input =
    (messageUsage.input_tokens ?? 0) +
    (messageUsage.cache_creation_input_tokens ?? 0) +
    (messageUsage.cache_read_input_tokens ?? 0);
  const output = messageUsage.output_tokens ?? 0;
  usage.input_tokens += input;
  usage.output_tokens += output;
  if (batch) {
    usage.batch_input_tokens += input;
    usage.batch_output_tokens += output;
  }
  usage.searches += messageUsage.server_tool_use?.web_search_requests ?? 0;
  usage.fetches += messageUsage.server_tool_use?.web_fetch_requests ?? 0;
}

// Tahmini dolar maliyeti; model tabloda yoksa token maliyeti null döner.
function estimateCost(model, { searches, input_tokens, output_tokens, batch_input_tokens = 0, batch_output_tokens = 0 }) {
  const searchCost = searches * SEARCH_COST_USD;
  const prices = TOKEN_PRICES[model];
  if (!prices) {
    return { searchCost, tokenCost: null, total: null };
  }
  const fullInput = input_tokens - batch_input_tokens;
  const fullOutput = output_tokens - batch_output_tokens;
  const tokenCost =
    (fullInput * prices.input + fullOutput * prices.output) / 1e6 +
    (batch_input_tokens * prices.input + batch_output_tokens * prices.output) / 2e6;
  return { searchCost, tokenCost, total: searchCost + tokenCost };
}

function formatUsd(value) {
  return value == null ? "bilinmiyor" : `$${value.toFixed(2)}`;
}

function usageLine(model, usage) {
  const cost = estimateCost(model, usage);
  return (
    `istek ${usage.requests}, web araması ${usage.searches}, sayfa okuma ${usage.fetches}, ` +
    `token: girdi ${usage.input_tokens} + çıktı ${usage.output_tokens}` +
    (usage.batch_input_tokens ? ` (batch: ${usage.batch_input_tokens} + ${usage.batch_output_tokens})` : "") +
    `, tahmini maliyet ${formatUsd(cost.total)} (arama ${formatUsd(cost.searchCost)}, token ${formatUsd(cost.tokenCost)})`
  );
}

// --- İstek çalıştırma ---------------------------------------------------

// Arama bütçesi: bir iş, istek başına en fazla arama sayısı kadar yer varsa
// başlatılır; harcanan, yanıtlardaki gerçek arama sayısıdır.
function createBudget(maxSearches, usage) {
  return {
    max: maxSearches,
    fits(perItem) {
      return usage.searches + perItem <= maxSearches;
    },
    remaining() {
      return Math.max(0, maxSearches - usage.searches);
    },
  };
}

// İsteği tamamlar: sunucu tarafı döngü pause_turn ile durduysa yanıtı
// olduğu gibi geri gönderip devam ettirir. initialMessage verilirse (batch
// sonucu) ilk istek atılmaz.
async function completeRequest(params, { usage, initialMessage = null, canContinue }) {
  let messages = params.messages;
  let message = initialMessage;

  for (let continuation = 0; ; continuation += 1) {
    if (!message) {
      message = await getClient().messages.create({ ...params, messages });
      addUsage(usage, message.usage);
    }

    if (message.stop_reason !== "pause_turn") {
      return message;
    }

    if (continuation >= MAX_PAUSE_CONTINUATIONS || !canContinue()) {
      throw new Error("Model araştırmayı bitiremedi (pause_turn)");
    }

    messages = [...messages, { role: "assistant", content: message.content }];
    message = null;
  }
}

function extractToolInput(message, toolName) {
  if (message.stop_reason === "refusal") {
    throw new Error("Model yanıtlamadı (refusal)");
  }
  const block = message.content.find((item) => item.type === "tool_use" && item.name === toolName);
  if (!block) {
    throw new Error(`Model sonucu bildirmedi (stop_reason: ${message.stop_reason})`);
  }
  return block.input;
}

// İşleri tek tek çalıştırır; bütçe yetmeyen iş "kalan" olur. handle(item,
// input) sonucu işler; hata işi başarısız sayar.
async function runSync(items, { buildParams, toolName, perItemSearches, usage, budget, handle, onProgress }) {
  const remaining = [];
  let done = 0;

  for (const item of items) {
    if (!budget.fits(perItemSearches)) {
      remaining.push(item);
      continue;
    }

    // Model/API hatası işi başarısız sayar; handle'daki (DB) hata çalıştırmayı durdurur.
    let input = null;
    let failure = null;
    try {
      const message = await completeRequest(buildParams(item), {
        usage,
        canContinue: () => budget.fits(perItemSearches),
      });
      input = extractToolInput(message, toolName);
    } catch (error) {
      failure = error;
    }
    await handle(item, input, failure);

    done += 1;
    await onProgress?.({ done, total: items.length, usage });
  }

  return { remaining };
}

async function waitForBatch(batchId, log) {
  const deadline = Date.now() + BATCH_MAX_WAIT_MS;
  let batch = await getClient().messages.batches.retrieve(batchId);

  while (batch.processing_status !== "ended") {
    if (Date.now() >= deadline) {
      log(`batch ${batchId} 24 saatte bitmedi, iptal ediliyor`);
      await getClient().messages.batches.cancel(batchId);
      const cancelDeadline = Date.now() + BATCH_CANCEL_WAIT_MS;
      while (batch.processing_status !== "ended" && Date.now() < cancelDeadline) {
        await sleep(30_000);
        batch = await getClient().messages.batches.retrieve(batchId);
      }
      return batch;
    }

    await sleep(BATCH_POLL_INTERVAL_MS);
    batch = await getClient().messages.batches.retrieve(batchId);
    const counts = batch.request_counts;
    log(
      `batch ${batchId}: ${batch.processing_status} — işleniyor ${counts.processing}, ` +
        `başarılı ${counts.succeeded}, hata ${counts.errored}`
    );
  }

  return batch;
}

// Bütçeye sığan işleri tek bir Message Batch ile çalıştırır (tokenlarda %50
// indirim; arama ücreti aynı). pause_turn ile dönenler anında istekle
// tamamlanır.
async function runBatch(items, { buildParams, toolName, perItemSearches, usage, budget, handle, onProgress, onBatchCreated, log }) {
  const capacity = Math.floor(budget.remaining() / perItemSearches);
  const selected = items.slice(0, capacity);
  const remaining = items.slice(capacity);

  if (selected.length === 0) {
    return { remaining };
  }

  // custom_id ^[a-zA-Z0-9_-]{1,64}$ olmalı; sıra numarası kullanılır.
  const requests = selected.map((item, index) => ({ custom_id: `r${index}`, params: buildParams(item) }));
  const created = await getClient().messages.batches.create({ requests });
  log(`batch ${created.id} oluşturuldu (${requests.length} istek); sonuç 24 saate kadar sürebilir`);
  await onBatchCreated?.(created.id);

  const batch = await waitForBatch(created.id, log);
  const pending = new Set(requests.map((request) => request.custom_id));
  let done = 0;

  if (batch.processing_status === "ended") {
    for await (const result of await getClient().messages.batches.results(created.id)) {
      if (!pending.delete(result.custom_id)) continue;
      const index = Number(result.custom_id.slice(1));
      const item = selected[index];

      let input = null;
      let failure = null;
      try {
        if (result.result.type !== "succeeded") {
          throw new Error(`Batch isteği ${result.result.type}`);
        }
        addUsage(usage, result.result.message.usage, { batch: true });
        const message = await completeRequest(requests[index].params, {
          usage,
          initialMessage: result.result.message,
          canContinue: () => budget.fits(perItemSearches),
        });
        input = extractToolInput(message, toolName);
      } catch (error) {
        failure = error;
      }
      await handle(item, input, failure);

      done += 1;
      await onProgress?.({ done, total: selected.length, usage });
    }
  }

  for (const customId of pending) {
    await handle(selected[Number(customId.slice(1))], null, new Error("Batch sonucu alınamadı"));
  }

  return { remaining };
}

// --- Çalıştırma kaydı (discovery_runs) ----------------------------------

async function startRunRecord({ kind, mode, trigger, maxSearches }) {
  const { rows } = await db.query(
    `insert into discovery_runs (kind, mode, trigger, max_searches)
     values ($1, $2, $3, $4) returning id`,
    [kind, mode, trigger, maxSearches]
  );
  return rows[0].id;
}

async function updateRunRecord(runId, usage, fields = {}) {
  await db.query(
    `update discovery_runs
     set searches_used = $2, fetches_used = $3, input_tokens = $4, output_tokens = $5,
         progress = coalesce($6, progress), batch_id = coalesce($7, batch_id)
     where id = $1`,
    [
      runId,
      usage.searches,
      usage.fetches,
      usage.input_tokens,
      usage.output_tokens,
      fields.progress ? JSON.stringify(fields.progress) : null,
      fields.batchId ?? null,
    ]
  );
}

async function finishRunRecord(runId, usage, { status, summary = null, error = null }) {
  await updateRunRecord(runId, usage);
  await db.query(
    `update discovery_runs set status = $2, summary = $3, error = $4, finished_at = now() where id = $1`,
    [runId, status, summary ? JSON.stringify(summary) : null, error]
  );
}

async function listRecentRuns(limit = 10) {
  const { rows } = await db.query(
    "select * from discovery_runs order by started_at desc limit $1",
    [limit]
  );
  return rows;
}

// Çalıştırmanın ortak iskeleti: kayıt açar, işi yürütür, özet ve kullanımı
// loglar. dryRun'da API'ye istek atılmaz, veritabanına yazılmaz.
async function executeRun({ kind, mode, trigger, maxSearches, log, onProgress }, work) {
  const model = getDiscoveryModel();
  const usage = emptyUsage();
  const budget = createBudget(maxSearches, usage);
  const runId = await startRunRecord({ kind, mode, trigger, maxSearches });
  const label = kind === "discover" ? "keşif" : "fiyat";

  try {
    await assertModelSupportsWebSearch(model);
    const summary = await work({
      model,
      usage,
      budget,
      onProgress: async (progress) => {
        await updateRunRecord(runId, usage, { progress: { done: progress.done, total: progress.total } });
        onProgress?.({ ...progress, usage });
      },
      onBatchCreated: (batchId) => updateRunRecord(runId, usage, { batchId }),
    });
    summary.usage = usage;
    summary.cost = estimateCost(model, usage);
    summary.model = model;
    const status = summary.remainingCount > 0 ? "stopped" : "completed";
    await finishRunRecord(runId, usage, { status, summary });
    log(`${label} bitti — ${usageLine(model, usage)}`);
    return { runId, status, summary };
  } catch (error) {
    await finishRunRecord(runId, usage, { status: "failed", error: error.message });
    log(`${label} başarısız: ${error.message} — ${usageLine(model, usage)}`);
    throw error;
  }
}

function dryRunEstimate(kind, itemCount, perItemSearches, maxSearches, mode) {
  const model = getDiscoveryModel();
  const fitting = Math.min(itemCount, Math.floor(maxSearches / perItemSearches));
  const estimate = TOKEN_ESTIMATES[kind];
  const searches = fitting * perItemSearches;
  const input = fitting * estimate.input;
  const output = fitting * estimate.output;
  const batch = mode === "batch";
  const cost = estimateCost(model, {
    searches,
    input_tokens: input,
    output_tokens: output,
    batch_input_tokens: batch ? input : 0,
    batch_output_tokens: batch ? output : 0,
  });
  return {
    model,
    mode,
    items: itemCount,
    fitting,
    remaining: itemCount - fitting,
    perItemSearches,
    maxSearchesNeeded: itemCount * perItemSearches,
    searchesUpperBound: searches,
    tokens: { input, output },
    cost,
  };
}

function formatDryRun(estimate) {
  return [
    `model ${estimate.model}, mod ${estimate.mode}`,
    `iş: ${estimate.items} (bu çalıştırmada ${estimate.fitting}, bütçe yetmediği için kalan ${estimate.remaining})`,
    `arama: iş başına en fazla ${estimate.perItemSearches}; bu çalıştırmada en fazla ${estimate.searchesUpperBound}, ` +
      `tamamı için en fazla ${estimate.maxSearchesNeeded}`,
    `token (kaba tahmin): girdi ~${estimate.tokens.input}, çıktı ~${estimate.tokens.output}`,
    `tahmini maliyet (üst sınır): ${formatUsd(estimate.cost.total)} ` +
      `(arama ${formatUsd(estimate.cost.searchCost)}, token ${formatUsd(estimate.cost.tokenCost)})`,
  ];
}

// --- Aşama 1: keşif -----------------------------------------------------

function addKeys(keys, { domain, app_name, plan_name }) {
  const plan = normalizeText(plan_name);
  const normalizedDomain = normalizeDomain(domain);
  if (normalizedDomain) keys.add(`d:${normalizedDomain}|${plan}`);
  keys.add(`n:${normalizeText(app_name)}|${plan}`);
}

function hasKey(keys, { domain, app_name, plan_name }) {
  const plan = normalizeText(plan_name);
  return keys.has(`d:${domain}|${plan}`) || keys.has(`n:${normalizeText(app_name)}|${plan}`);
}

function buildDiscoveryParams(model, category, existingInCategory) {
  const existing = existingInCategory.length
    ? existingInCategory.map((service) => `- ${service}`).join("\n")
    : "(yok)";
  const otherCategories = CATEGORIES.filter((name) => name !== category).join(", ");

  const system =
    "Türkiye'deki dijital abonelikleri takip eden bir uygulamanın kataloğu için araştırma yapıyorsun. " +
    "web_search ile verilen kategoride Türkiye'den satın alınabilen ücretli dijital abonelikleri bul ve " +
    `sonucu en sonda ${DISCOVERY_TOOL.name} aracını bir kez çağırarak bildir.\n\n` +
    "Kurallar:\n" +
    "- Yalnızca Türkiye'de satılan (Türkiye'den abone olunabilen) ve hâlâ faaliyette olan servisleri services'e koy. " +
    "Türkiye'de satılmayan ya da kapanmış bir servis bulursan onu sebebiyle skipped'e yaz.\n" +
    "- Bir servisin her ücretli planı ayrı plan olsun (Bireysel, Aile, Öğrenci, Reklamlı vb.). Yıllık ödeme seçeneği " +
    'varsa onu da ayrı plan olarak ekle: billing_cycle "yearly", plan adı "<Plan> (Yıllık)".\n' +
    "- Ücretsiz planları ekleme.\n" +
    "- Fiyat araştırma; yalnızca servisleri ve planlarını bul.\n" +
    "- domain: servisin resmi alan adı, www'suz (ör. netflix.com). pricing_url: resmi fiyat sayfası, mümkünse " +
    "Türkiye sayfası; bilmiyorsan null.\n" +
    "- popularity: servisin Türkiye'deki yaygınlığı.\n" +
    "- Emin olmadığın servisi ya da planı uydurma.\n" +
    "- Katalogda zaten olan servisleri tekrar ekleme; yalnızca eksik planları varsa onları ekle.\n" +
    `- En fazla ${DISCOVERY_SEARCHES_PER_CATEGORY} arama yap.`;

  const user =
    `Kategori: ${category} (kapsam: ${CATEGORY_HINTS[category] ?? category}).\n` +
    `Diğer kategoriler (bunlara giren servisleri ekleme): ${otherCategories}.\n\n` +
    `Katalogda bu kategoride zaten olanlar:\n${existing}`;

  return {
    model,
    max_tokens: DISCOVERY_MAX_TOKENS,
    system,
    tools: [webSearchTool(DISCOVERY_SEARCHES_PER_CATEGORY), DISCOVERY_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }],
  };
}

async function loadCatalogForDiscovery() {
  const { rows } = await db.query(
    "select app_name, plan_name, domain, category from subscriptions_catalog"
  );
  const keys = new Set();
  const byCategory = new Map();

  for (const row of rows) {
    addKeys(keys, row);
    if (!row.category) continue;
    const label = row.domain ? `${row.app_name} (${row.domain})` : row.app_name;
    const services = byCategory.get(row.category) ?? new Map();
    const plans = services.get(label) ?? [];
    if (row.plan_name) plans.push(row.plan_name);
    services.set(label, plans);
    byCategory.set(row.category, services);
  }

  const existingFor = (category) =>
    Array.from(byCategory.get(category)?.entries() ?? []).map(
      ([label, plans]) => `${label}${plans.length ? `: ${plans.join(", ")}` : ""}`
    );

  return { keys, existingFor };
}

async function insertDraft(category, service, plan, domain) {
  await db.query(
    `insert into subscriptions_catalog
       (app_name, plan_name, category, domain, billing_cycle, currency, source_url, pricing_url,
        popularity, status, price_status, source_tags, source_note)
     values ($1, $2, $3, $4, $5, 'TRY', $6, $6, $7, 'draft', 'unverified', array['ai-discovery'], $8)`,
    [
      service.app_name.trim(),
      plan.plan_name.trim(),
      category,
      domain,
      plan.billing_cycle,
      service.pricing_url || null,
      service.popularity,
      service.availability_reason.slice(0, 1000),
    ]
  );
}

// Modelin bildirdiği servisleri eleyip kalan planları taslak olarak ekler.
async function applyDiscoveryReport(category, report, keys, stats) {
  const skip = (app_name, plan_name, reason) => {
    stats.skipped += 1;
    stats.skippedItems.push({ app_name, plan_name, reason });
  };

  for (const item of report.skipped) {
    skip(item.app_name, null, `model eledi: ${item.reason}`);
  }

  for (const service of report.services) {
    if (!service.available_in_tr) {
      skip(service.app_name, null, `Türkiye'de yok: ${service.availability_reason}`);
      continue;
    }

    const domain = normalizeDomain(service.domain);
    if (!domain) {
      skip(service.app_name, null, `geçersiz alan adı (${service.domain})`);
      continue;
    }

    for (const plan of service.plans) {
      const record = { domain, app_name: service.app_name, plan_name: plan.plan_name };
      if (!plan.paid) {
        skip(service.app_name, plan.plan_name, "ücretsiz plan");
      } else if (!plan.plan_name.trim()) {
        skip(service.app_name, plan.plan_name, "plan adı boş");
      } else if (hasKey(keys, record)) {
        skip(service.app_name, plan.plan_name, "katalogda var");
      } else {
        await insertDraft(category, service, plan, domain);
        addKeys(keys, record);
        stats.added += 1;
        stats.addedItems.push({ app_name: service.app_name, plan_name: plan.plan_name, domain });
      }
    }
  }
}

// Aşama 1. categories verilmezse bütün kategoriler; dryRun'da yalnızca plan
// ve tahmin döner.
async function runDiscovery({
  mode = "batch",
  maxSearches = DEFAULT_MAX_SEARCHES,
  categories = CATEGORIES,
  dryRun = false,
  trigger = "cli",
  log = console.log,
  onProgress,
} = {}) {
  const unknown = categories.filter((category) => !CATEGORIES.includes(category));
  if (unknown.length) {
    throw new Error(`Bilinmeyen kategori: ${unknown.join(", ")}`);
  }

  if (dryRun) {
    const { existingFor } = await loadCatalogForDiscovery();
    const estimate = dryRunEstimate("discover", categories.length, DISCOVERY_SEARCHES_PER_CATEGORY, maxSearches, mode);
    return {
      dryRun: true,
      estimate,
      lines: [
        ...categories.map((category) => `${category}: katalogda ${existingFor(category).length} servis`),
        ...formatDryRun(estimate),
      ],
    };
  }

  return executeRun({ kind: "discover", mode, trigger, maxSearches, log, onProgress }, async (ctx) => {
    const { keys, existingFor } = await loadCatalogForDiscovery();
    const perCategory = new Map(
      categories.map((category) => [
        category,
        { category, added: 0, skipped: 0, failed: null, addedItems: [], skippedItems: [] },
      ])
    );

    const runner = mode === "sync" ? runSync : runBatch;
    const { remaining } = await runner(categories, {
      buildParams: (category) => buildDiscoveryParams(ctx.model, category, existingFor(category)),
      toolName: DISCOVERY_TOOL.name,
      perItemSearches: DISCOVERY_SEARCHES_PER_CATEGORY,
      usage: ctx.usage,
      budget: ctx.budget,
      handle: async (category, report, error) => {
        const stats = perCategory.get(category);
        if (error) {
          stats.failed = error.message;
          log(`keşif: ${category} başarısız: ${error.message}`);
          return;
        }
        await applyDiscoveryReport(category, report, keys, stats);
        log(`keşif: ${category} — eklenen ${stats.added}, atlanan ${stats.skipped}`);
      },
      onProgress: ctx.onProgress,
      onBatchCreated: ctx.onBatchCreated,
      log,
    });

    const results = Array.from(perCategory.values()).filter((stats) => !remaining.includes(stats.category));
    return {
      kind: "discover",
      categories: results,
      added: results.reduce((sum, stats) => sum + stats.added, 0),
      skipped: results.reduce((sum, stats) => sum + stats.skipped, 0),
      failed: results.filter((stats) => stats.failed).length,
      remaining,
      remainingCount: remaining.length,
    };
  });
}

// --- Aşama 2: fiyat bulma -----------------------------------------------

function buildPriceParams(model, row) {
  const period = row.billing_cycle === "yearly" ? "yıllık" : "aylık";
  const domain = row.domain || "bilinmiyor";

  const system =
    "Bir dijital abonelik planının Türkiye'deki güncel liste fiyatını buluyorsun. Sonucu en sonda " +
    `${PRICE_TOOL.name} aracını bir kez çağırarak bildir.\n\n` +
    "Yöntem:\n" +
    "1. Fiyat sayfası verildiyse önce onu web_fetch ile oku.\n" +
    `2. Fiyat orada yoksa web_search ile servisin resmi Türkiye fiyatını ara (en fazla ${PRICE_SEARCHES_PER_ITEM} arama).\n\n` +
    "Kaynak kuralları:\n" +
    `- Yalnızca resmi kaynaklar kabul edilir: servisin kendi sitesi (${domain} ya da alt alan adları), App Store ` +
    "(apps.apple.com) ya da Google Play'deki (play.google.com) resmi uygulama sayfası, servisin resmi yardım sayfası.\n" +
    "- Haber siteleri, forumlar, bloglar ve karşılaştırma siteleri kaynak değildir. Fiyatı yalnızca böyle bir yerde " +
    'gördüysen price: null ver, source_type: "unofficial" yaz ve evidence\'a nerede gördüğünü not et.\n\n' +
    "Alanlar:\n" +
    "- price: kampanya ya da ilk ay indirimi değil, normal liste fiyatı; yalnızca sayı (ör. 229.99). Bulamazsan null.\n" +
    "- currency: Türkiye'de TL fiyat varsa TRY; servis Türkiye'de yalnızca dolarla satılıyorsa USD.\n" +
    "- billing_cycle: bulduğun fiyatın dönemi.\n" +
    "- source_url: fiyatı gördüğün sayfanın adresi.\n" +
    '- source_type: fiyatı nerede gördüğün; uygulama içi satın alma fiyatıysa "app_store" ya da "google_play".\n' +
    "- evidence: sayfadaki fiyat cümlesinden kısa alıntı (en fazla 200 karakter); bulamadıysan sebebi.\n" +
    "- confidence: fiyatın bu plana ve döneme ait olduğundan ne kadar eminsin.";

  const user =
    `Servis: ${row.app_name}\nPlan: ${row.plan_name || "(tek plan)"} (${period} ödeme)\n` +
    `Resmi alan adı: ${domain}\nKategori: ${row.category || "bilinmiyor"}\n` +
    `Fiyat sayfası: ${row.pricing_url || row.source_url || "bilinmiyor"}`;

  return {
    model,
    max_tokens: PRICE_MAX_TOKENS,
    output_config: { effort: "low" },
    system,
    tools: [webFetchTool(PRICE_FETCHES_PER_ITEM), webSearchTool(PRICE_SEARCHES_PER_ITEM), PRICE_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }],
  };
}

// Kaynağın resmi olup olmadığı kodda da denetlenir: kaydın alan adı (ya da
// alt alan adı) veya resmi uygulama mağazaları.
function classifySource(row, sourceUrl) {
  const host = hostOf(sourceUrl);
  if (!host) return { host: null, official: false, store: false };
  const store = OFFICIAL_STORE_HOSTS.has(host);
  const domain = normalizeDomain(row.domain);
  const ownSite = Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
  return { host, official: store || ownSite, store };
}

// Modelin sonucunu kurallardan geçirir: { price, currency, evidence, store }.
function evaluatePriceReport(row, report) {
  const evidence = report.evidence.trim();
  const reject = (reason) => ({ price: null, reason, evidence: `${reason}. ${evidence}` });

  if (report.price == null) {
    return { price: null, reason: "bulunamadı", evidence };
  }
  if (report.price < 0) {
    return reject("Geçersiz fiyat");
  }

  const source = classifySource(row, report.source_url);
  if (report.source_type === "unofficial" || report.source_type === "none" || !source.official) {
    return reject(`Resmi olmayan kaynak (${source.host ?? "adres yok"})`);
  }
  if (report.billing_cycle !== "unknown" && report.billing_cycle !== row.billing_cycle) {
    return reject(`Dönem uyuşmuyor (${report.billing_cycle} ${report.price})`);
  }
  if (report.currency === "unknown") {
    return reject("Para birimi belirsiz");
  }

  return {
    price: report.price,
    currency: report.currency,
    sourceUrl: report.source_url,
    store: source.store || report.source_type === "app_store" || report.source_type === "google_play",
    evidence,
  };
}

async function applyPriceReport(row, report) {
  const result = evaluatePriceReport(row, report);
  const evidence = result.evidence.slice(0, MAX_EVIDENCE_LENGTH);

  if (result.price == null) {
    await db.query(
      `update subscriptions_catalog
       set price_evidence = $2, price_confidence = $3, last_checked_at = now()
       where id = $1`,
      [row.id, evidence, report.confidence]
    );
    return { status: result.reason === "bulunamadı" ? "not_found" : "rejected", reason: result.reason };
  }

  // Yayındaki kayıtta (--include-active) fiyat değişirse haftalık
  // tarayıcıdaki gibi eski fiyat price_history'e yazılır.
  if (row.status === "active") {
    const oldPrice = Number(row.current_price);
    if (Math.abs(oldPrice - result.price) > 0.001) {
      await db.query(
        `insert into price_history (catalog_id, price, new_price, source, changed_at)
         values ($1, $2, $3, 'scanner', now())`,
        [row.id, oldPrice, result.price]
      );
    }
  }

  await db.query(
    `update subscriptions_catalog
     set current_price = $2, currency = $3, source_url = $4, price_evidence = $5,
         price_confidence = $6, last_checked_at = now(),
         price_status = case when current_price is distinct from $2::numeric
                             then 'unverified' else price_status end,
         source_tags = case when $7::boolean and not ('app-store-price' = any(source_tags))
                            then source_tags || array['app-store-price'] else source_tags end
     where id = $1 and status in ('draft', 'active') and managed_by is null`,
    [row.id, result.price, result.currency, result.sourceUrl, evidence, report.confidence, result.store]
  );
  return { status: "found", price: result.price, currency: result.currency };
}

// Taranacaklar: fiyatı olmayan ve bu aşamadan hiç geçmemiş taslaklar
// (retry ile daha önce bulunamayanlar da); includeActive ile yayındakiler.
// Yaygın servisler önce.
async function loadPriceTargets({ includeActive, retry, limit }) {
  const { rows } = await db.query(
    `select * from subscriptions_catalog
     where managed_by is null
       and ((status = 'draft' and current_price is null and ($2 or price_confidence is null))
            or ($1 and status = 'active'))
     order by case status when 'draft' then 0 else 1 end,
              case popularity when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end,
              app_name, plan_name
     limit $3`,
    [includeActive, retry, limit ?? null]
  );
  return rows;
}

// Aşama 2. Sonuç her zaman price_status = 'unverified'; kayıt yayına alınmaz.
async function runPriceSearch({
  mode = "batch",
  maxSearches = DEFAULT_MAX_SEARCHES,
  includeActive = false,
  retry = false,
  limit = null,
  dryRun = false,
  trigger = "cli",
  log = console.log,
  onProgress,
} = {}) {
  const targets = await loadPriceTargets({ includeActive, retry, limit });
  const perItemSearches = PRICE_SEARCHES_PER_ITEM;

  if (dryRun) {
    const drafts = targets.filter((row) => row.status === "draft").length;
    const estimate = dryRunEstimate("prices", targets.length, perItemSearches, maxSearches, mode);
    return {
      dryRun: true,
      estimate,
      lines: [`taranacak: ${targets.length} kayıt (taslak ${drafts}, yayında ${targets.length - drafts})`, ...formatDryRun(estimate)],
    };
  }

  return executeRun({ kind: "prices", mode, trigger, maxSearches, log, onProgress }, async (ctx) => {
    const details = [];
    const runner = mode === "sync" ? runSync : runBatch;
    const { remaining } = await runner(targets, {
      buildParams: (row) => buildPriceParams(ctx.model, row),
      toolName: PRICE_TOOL.name,
      perItemSearches,
      usage: ctx.usage,
      budget: ctx.budget,
      handle: async (row, report, error) => {
        const base = { id: row.id, app_name: row.app_name, plan_name: row.plan_name };
        if (error) {
          details.push({ ...base, status: "failed", reason: error.message });
          log(`fiyat: ${row.app_name} ${row.plan_name ?? ""} başarısız: ${error.message}`);
          return;
        }
        details.push({ ...base, ...(await applyPriceReport(row, report)), confidence: report.confidence });
      },
      onProgress: ctx.onProgress,
      onBatchCreated: ctx.onBatchCreated,
      log,
    });

    const count = (status) => details.filter((detail) => detail.status === status).length;
    return {
      kind: "prices",
      total: details.length,
      found: count("found"),
      notFound: count("not_found"),
      rejected: count("rejected"),
      failed: count("failed"),
      details,
      remaining: remaining.map((row) => ({ id: row.id, app_name: row.app_name, plan_name: row.plan_name })),
      remainingCount: remaining.length,
    };
  });
}

module.exports = {
  CATEGORIES,
  DEFAULT_MAX_SEARCHES,
  classifySource,
  evaluatePriceReport,
  getDiscoveryModel,
  listRecentRuns,
  normalizeDomain,
  runDiscovery,
  runPriceSearch,
  usageLine,
};
