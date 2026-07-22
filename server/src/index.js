require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { initDb, dataDir } = require("./db");

async function main() {
  await initDb();
  const { seedAll } = require("./seed-functions");
  seedAll();

  const authRoutes = require("./routes/auth");
  const menuRoutes = require("./routes/menu");
  const tableRoutes = require("./routes/tables");
  const orderRoutes = require("./routes/orders");
  const reportRoutes = require("./routes/reports");
  const userRoutes = require("./routes/users");

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  // The real access boundary here is the JWT Bearer token (checked per
  // request in authMiddleware), not the request's Origin — this API doesn't
  // use cookies, so a page on some other site can't silently ride a logged-in
  // user's session the way it could with cookie auth; it would need the
  // token itself, which it has no way to read. An origin allowlist mostly
  // just adds a maintenance burden (had to include every LAN range, every
  // Tailscale/ngrok address the till might be reached through) without a
  // matching security benefit, and got in the way of the app being reachable
  // from wherever staff/admin actually are — restaurant WiFi, a VPN, or a
  // public tunnel like ngrok for off-site access.
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/menu", menuRoutes);
  app.use("/api/tables", tableRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/users", userRoutes);

  app.use("/uploads", express.static(path.join(dataDir, "uploads")));

  // In production (packaged desktop app) the built client is served from the
  // same Express server so Electron only needs to load one URL. In local dev
  // this folder won't exist yet (Vite's own dev server + proxy is used
  // instead), so express.static + the catch-all below are silently inert.
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (req, res, next) => {
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  const PORT = process.env.PORT || 4000;
  // 0.0.0.0 (all network interfaces), not 127.0.0.1, so phones/tablets on
  // the same WiFi can reach this PC's LAN IP — not just the PC itself.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sarini Bistro API listening on http://localhost:${PORT} (and on this PC's LAN IP, for phones on the same WiFi)`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
