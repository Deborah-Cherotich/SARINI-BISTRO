const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { db } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  // Only wrong-password/wrong-username attempts count against the limit —
  // a shared till where staff sign in and out all day, plus the odd typo,
  // would otherwise trip this from normal use rather than an actual attack.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait a few minutes and try again." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  // Check the password before checking `active` so a correct password on a
  // deactivated account can get a specific, helpful message, without
  // leaking to a wrong-password guess whether that username exists at all.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.active) {
    return res
      .status(401)
      .json({ error: "This account has been deactivated. Ask an admin to reactivate it." });
  }
  // This is a single offline till, not a public web app — there's no benefit
  // to forcing a re-login every shift. A long-lived token plus the client
  // persisting it in localStorage means signing in once is enough until
  // someone taps "Log out". Deactivating an account (Admin > Users) still
  // revokes access immediately regardless of how much of this is left,
  // since authMiddleware re-checks `active` on every request.
  const token = jwt.sign(
    { id: user.id, name: user.name, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "90d" }
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
});

module.exports = router;
