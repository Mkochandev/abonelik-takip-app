// Her gece 03:00'te tüm kataloğun fiyatlarını otomatik tarar.

const cron = require("node-cron");

const { scanAllPrices } = require("./priceScanner");

function startPriceScanCron() {
  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("priceScanCron: gecelik fiyat taraması başladı");

      try {
        const summary = await scanAllPrices();
        console.log(
          `priceScanCron: tarama bitti — toplam ${summary.total}, güncellenen ${summary.updated}, ` +
            `değişmeyen ${summary.unchanged}, başarısız ${summary.failed}`
        );
      } catch (error) {
        console.error("priceScanCron: tarama sırasında hata:", error.message);
      }
    },
    { timezone: "Europe/Istanbul" }
  );
}

module.exports = { startPriceScanCron };
