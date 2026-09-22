// USD -> TRY kurunu ücretsiz exchangerate-api.com servisinden çeker ve
// 6 saat boyunca bellekte (in-memory) cache'ler, böylece her istek dış
// servise gitmez.

const RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Servise hiç ulaşılamazsa (ilk istekte bile) kullanılacak kaba tahmini kur.
const FALLBACK_RATE = 34;

let cachedRate = null;
let cachedAt = 0;

async function fetchUsdToTryRate() {
  const response = await fetch(RATE_API_URL);

  if (!response.ok) {
    throw new Error(`Kur servisi ${response.status} döndü`);
  }

  const data = await response.json();
  const rate = data?.rates?.TRY;

  if (typeof rate !== "number") {
    throw new Error("Kur servisi yanıtında TRY bulunamadı");
  }

  return rate;
}

async function getUsdToTryRate() {
  const isFresh = cachedRate !== null && Date.now() - cachedAt < CACHE_TTL_MS;

  if (isFresh) {
    return cachedRate;
  }

  try {
    cachedRate = await fetchUsdToTryRate();
    cachedAt = Date.now();
  } catch (error) {
    // Servise ulaşılamazsa, varsa eski (bayat) kuru, yoksa sabit tahmini
    // kuru kullan — abonelik toplamlarının tamamen çökmesindense yaklaşık
    // bir değer göstermek tercih edilir.
    if (cachedRate === null) {
      return FALLBACK_RATE;
    }
  }

  return cachedRate;
}

module.exports = { getUsdToTryRate };
