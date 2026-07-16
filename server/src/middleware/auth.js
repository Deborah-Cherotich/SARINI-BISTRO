const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { db, dataDir } = require("../db");

// Every install needs its own signing secret — a secret baked into source
// control would let anyone forge admin tokens for any deployed instance. If
// JWT_SECRET isn't set via env, generate one on first run and persist it
// alongside the database so it survives restarts.
function loadOrCreateSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const secretFile = path.join(dataDir, "jwt-secret.key");
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, "utf8").trim();
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

const JWT_SECRET = loadOrCreateSecret();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Re-check the account is still active on every request so deactivating
    // a user mid-shift revokes access immediately instead of waiting out
    // the token's up-to-12h expiry.
    const user = db.prepare("SELECT active FROM users WHERE id = ?").get(payload.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: "Account is no longer active" });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, JWT_SECRET };
