// Kataloğun fiyatlarını haftada bir (varsayılan: Pazartesi 03:30, İstanbul
// saati) Message Batches API ile otomatik tarar.
//
// PRICE_SCAN_CRON: node-cron ifadesi (varsayılan "30 3 * * 1").
// PRICE_SCAN_ENABLED=false: cron hiç kurulmaz.

const cron = require("node-cron");

const { hasPendingBatches, resumePendingBatches, scanAllPricesBatch } = require("./priceScanner");

const DEFAULT_SCHEDULE = "30 3 * * 1";
const TIMEZONE = "Europe/Istanbul";

function startPriceScanCron() {
  if (process.env.PRICE_SCAN_ENABLED?.trim().toLowerCase() === "false") {
    console.log("priceScanCron: PRICE_SCAN_ENABLED=false, otomatik tarama kapalı");
    return;
  }

  const schedule = process.env.PRICE_SCAN_CRON?.trim() || DEFAULT_SCHEDULE;
  if (!cron.validate(schedule)) {
    console.error(`priceScanCron: PRICE_SCAN_CRON geçersiz ("${schedule}"), otomatik tarama kurulmadı`);
    return;
  }

  cron.schedule(
    schedule,
    async () => {
      console.log("priceScanCron: haftalık fiyat taraması (batch) başladı");

      try {
        // Önce yarım kalmış batch'ler; hâlâ biri bekliyorsa yenisi açılmaz.
        await resumePendingBatches();
        if (await hasPendingBatches()) {
          console.warn("priceScanCron: bekleyen bir batch var, bu haftaki tarama atlandı");
          return;
        }
        // Özet satırını priceScanner kendisi loglar.
        await scanAllPricesBatch();
      } catch (error) {
        console.error("priceScanCron: tarama sırasında hata:", error.message);
      }
    },
    // Batch 24 saate kadar sürebilir; önceki tarama bitmeden yenisi başlamasın.
    { timezone: TIMEZONE, noOverlap: true, name: "price-scan" }
  );

  console.log(`priceScanCron: otomatik tarama kuruldu ("${schedule}", ${TIMEZONE})`);
}

module.exports = { startPriceScanCron };
