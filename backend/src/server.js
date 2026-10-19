require("dotenv").config();

const app = require("./app");
const { startPriceScanCron } = require("./services/priceScanCron");
const { resumePendingBatches } = require("./services/priceScanner");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API sunucusu http://${HOST}:${PORT} adresinde çalışıyor (localhost:${PORT} üzerinden de erişilebilir)`);
});

startPriceScanCron();

// Tarama sırasında yeniden başlatıldıysa yarım kalan batch'in sonuçlarını
// arka planda işler (PRICE_SCAN_ENABLED=false olsa da: batch ücreti ödendi).
resumePendingBatches().catch((error) => {
  console.error("priceScanner: yarım kalan batch'ler işlenemedi:", error.message);
});
