const express = require("express");
const cors = require("cors");

const db = require("./config/db");
const routes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await db.query("select 1");
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", message: error.message });
  }
});

app.use("/api", routes);

module.exports = app;
