require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { initDb, dataDir } = require("./db");

// This server only ever needs to be reachable from the till itself (Vite dev
// server, the built client, or the Electron shell), all on localhost. Origin
// is restricted rather than left wide open so a page loaded from anywhere
// else on the internet can't make credentialed requests against it.
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

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
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || LOCAL_ORIGIN_PATTERN.test(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
    })
  );
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
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Sarini Bistro API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
