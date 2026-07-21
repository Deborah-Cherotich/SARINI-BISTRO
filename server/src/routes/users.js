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

function isValidRole(role) {
  return typeof role === "string" && role.trim().length > 0 && role.trim().length <= 30;
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
  if (!isValidRole(role)) {
    return res.status(400).json({ error: "role is required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }
  // Deactivating a user doesn't free up their username (it's still a UNIQUE
  // column), which reads as a confusing "already exists" for an account that
  // looks gone from the list. Check first so the message can say why and
  // point at the fix, instead of a generic constraint-violation message.
  const clash = db.prepare("SELECT active FROM users WHERE username = ?").get(username);
  if (clash) {
    return res.status(400).json({
      error: clash.active
        ? `Username "${username}" is already in use.`
        : `Username "${username}" belongs to a deactivated account. Reactivate it from the list below instead of creating a new one, or delete it permanently first.`,
    });
  }
  try {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(name, username, bcrypt.hashSync(password, 10), role.trim());
    res.status(201).json(serialize(db.prepare("SELECT * FROM users WHERE id = ?").get(lastInsertRowid)));
  } catch (err) {
    res.status(400).json({ error: `Username "${username}" is already in use.` });
  }
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "User not found" });
  const {
    name = existing.name,
    username = existing.username,
    role = existing.role,
    active = existing.active,
    password,
  } = req.body || {};
  if (!username.trim()) {
    return res.status(400).json({ error: "username is required" });
  }
  if (!isValidRole(role)) {
    return res.status(400).json({ error: "role is required" });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }
  const password_hash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
  try {
    db.prepare(
      "UPDATE users SET name = ?, username = ?, role = ?, active = ?, password_hash = ? WHERE id = ?"
    ).run(name, username.trim(), role.trim(), active ? 1 : 0, password_hash, req.params.id);
  } catch (err) {
    return res.status(400).json({ error: `Username "${username.trim()}" is already in use.` });
  }
  res.json(serialize(db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "User not found" });

  const tx = db.transaction(() => {
    // Null out the links rather than blocking the delete, so past orders and
    // report totals stay intact even after the staff member is gone for good.
    db.prepare("UPDATE orders SET created_by = NULL WHERE created_by = ?").run(req.params.id);
    db.prepare("UPDATE orders SET received_by = NULL WHERE received_by = ?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  });
  tx();

  res.status(204).end();
});

module.exports = router;
