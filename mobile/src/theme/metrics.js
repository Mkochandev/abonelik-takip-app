// Ekranlar arası tutarlılık için ortak boşluk ve köşe yuvarlama ölçüleri.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  card: 24,
  sheet: 28, // alttan açılan sayfaların yalnızca üst köşeleri için
  input: 16,
  tile: 12, // uygulama karosu (AppTile)
};

// Hap şeklindeki buton/çip için: radius = yükseklik / 2.
export function pillRadius(height) {
  return height / 2;
}
