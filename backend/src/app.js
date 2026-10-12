const path = require("path");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const db = require("./config/db");
const routes = require("./routes");

const PRIVACY_URL = "https://eriste.app/gizlilik";
const TERMS_URL = "https://eriste.app/kosullar";

const app = express();

// Rate limit'in gerçek istemci IP'sini görmesi için. Varsayılan: aynı
// makinedeki ters vekil (nginx/caddy). Vekil yoksa TRUST_PROXY=false.
const trustProxy = process.env.TRUST_PROXY ?? "loopback";
app.set("trust proxy", trustProxy === "false" ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// CSP kapalı: admin paneli inline script ve Logo.dev görselleri kullanıyor.
// Marka görselleri (/brand) uygulamadan da yüklendiği için cross-origin.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors());
app.use(express.json({ limit: "64kb" }));

// Gizlilik ve kullanım koşulları metinleri yalnızca eriste.app'te.
app.get(["/privacy", "/privacy.html"], (req, res) => {
  res.redirect(301, PRIVACY_URL);
});
app.get(["/terms", "/terms.html"], (req, res) => {
  res.redirect(301, TERMS_URL);
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", async (req, res) => {
  try {
    await db.query("select 1");
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    console.error("[health]", error.message);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api", routes);

// Gövde ayrıştırma hataları (bozuk JSON, boyut sınırı) ve yakalanmamış
// hatalar: ayrıntı istemciye gitmez.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "İstek gövdesi çok büyük" });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Geçersiz JSON" });
  }
  console.error("[app]", error);
  res.status(500).json({ error: "Bir hata oluştu, tekrar dene" });
});

module.exports = app;
