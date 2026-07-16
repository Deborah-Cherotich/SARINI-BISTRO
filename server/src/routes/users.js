const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware, requireRole("admin"));

function serialize(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

router.get("/", (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY id").all();
  res.json(users.map(serialize));
});

router.post("/", (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: "name, username, password and role are required" });
  }
  if (!["admin", "cashier"].includes(role)) {
    return res.status(400).json({ error: "role must be admin or cashier" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }
  try {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(name, username, bcrypt.hashSync(password, 10), role);
    res.status(201).json(serialize(db.prepare("SELECT * FROM users WHERE id = ?").get(lastInsertRowid)));
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "User not found" });
  const { name = existing.name, role = existing.role, active = existing.active, password } = req.body || {};
  if (!["admin", "cashier"].includes(role)) {
    return res.status(400).json({ error: "role must be admin or cashier" });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }
  const password_hash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
  db.prepare(
    "UPDATE users SET name = ?, role = ?, active = ?, password_hash = ? WHERE id = ?"
  ).run(name, role, active ? 1 : 0, password_hash, req.params.id);
  res.json(serialize(db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot deactivate your own account" });
  }
  db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
