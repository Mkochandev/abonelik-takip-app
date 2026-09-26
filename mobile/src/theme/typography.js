// Başlıklar, büyük tutarlar ve buton yazıları Bricolage Grotesque kullanır;
// gövde metni sistem fontunda kalır.

export const fontFamily = {
  extraBold: "BricolageGrotesque_800ExtraBold",
  bold: "BricolageGrotesque_700Bold",
};

export const typography = {
  screenTitle: { fontFamily: fontFamily.extraBold, fontSize: 33 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontSize: 24 },
  amountLarge: {
    fontFamily: fontFamily.extraBold,
    fontSize: 43,
    fontVariant: ["tabular-nums"],
  },
  price: { fontFamily: fontFamily.bold, fontSize: 16 },
  button: { fontFamily: fontFamily.bold, fontSize: 16.5 },
  body: { fontSize: 15.5 },
  secondary: { fontSize: 13.5 },
};
