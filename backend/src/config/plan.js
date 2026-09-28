// Ücretsiz plandaki kullanıcıların ekleyebileceği azami abonelik sayısı.
// Tek yerden değişsin diye burada tutuluyor; mobil taraf bu değeri
// /api/auth/me üzerinden alır, kendi başına ikinci bir kaynak tutmaz.
module.exports = {
  FREE_LIMIT: 5,
};
