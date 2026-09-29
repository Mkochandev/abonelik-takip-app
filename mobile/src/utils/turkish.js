// Sayılara belirtme hâli (-i) ekini okunuşa göre ekler: 1'i, 2'si, 3'ü,
// 6'sı, 10'u, 20'si, 30'u, 100'ü ... Ek, sayının okunuşundaki son kelimeye
// göre belirlenir: son basamak 0 değilse o basamak, değilse onlar, yüzler
// ya da binler basamağı.
const LAST_DIGIT_SUFFIX = {
  1: "i", // bir
  2: "si", // iki
  3: "ü", // üç
  4: "ü", // dört
  5: "i", // beş
  6: "sı", // altı
  7: "si", // yedi
  8: "i", // sekiz
  9: "u", // dokuz
};

const TENS_SUFFIX = {
  1: "u", // on
  2: "si", // yirmi
  3: "u", // otuz
  4: "ı", // kırk
  5: "si", // elli
  6: "ı", // altmış
  7: "i", // yetmiş
  8: "i", // seksen
  9: "ı", // doksan
};

function accusativeSuffix(number) {
  const n = Math.abs(Math.trunc(number));

  if (n === 0) return "ı"; // sıfır
  if (n % 10 !== 0) return LAST_DIGIT_SUFFIX[n % 10];
  if (n % 100 !== 0) return TENS_SUFFIX[(n % 100) / 10];
  if (n % 1000 !== 0) return "ü"; // yüz
  if (n % 1000000 !== 0) return "i"; // bin
  return "u"; // milyon, milyar
}

export function withAccusativeSuffix(number) {
  return `${number}'${accusativeSuffix(number)}`;
}
