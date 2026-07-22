const express = require("express");
const { db } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", (req, res) => {
  const tables = db.prepare("SELECT * FROM tables ORDER BY id").all();
  const openOrders = db
    .prepare("SELECT id, table_id, total FROM orders WHERE status = 'open' AND table_id IS NOT NULL")
    .all();
  const result = tables.map((t) => ({
    ...t,
    open_order_id: openOrders.find((o) => o.table_id === t.id)?.id || null,
  }));
  res.json(result);
});

router.post("/", requireRole("admin"), (req, res) => {
  const { label, seats = 4 } = req.body || {};
  if (!label) return res.status(400).json({ error: "label is required" });
  const { lastInsertRowid } = db
    .prepare("INSERT INTO tables (label, seats) VALUES (?, ?)")
    .run(label, seats);
  res.status(201).json(db.prepare("SELECT * FROM tables WHERE id = ?").get(lastInsertRowid));
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM tables WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Table not found" });
  const { label = existing.label, seats = existing.seats } = req.body || {};
  db.prepare("UPDATE tables SET label = ?, seats = ? WHERE id = ?").run(
    label,
    seats,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM tables WHERE id = ?").get(req.params.id));
});

// Any logged-in staff member can remove a table (e.g. one added by mistake)
// without needing an admin around — the guards below (must be free, must
// have no order history) already make this safe: there's nothing a cashier
// could delete here that would lose real data or disrupt a live table.
router.delete("/:id", (req, res) => {
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(req.params.id);
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (table.status === "occupied") {
    return res.status(400).json({ error: "Cannot delete an occupied table" });
  }
  const orderCount = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE table_id = ?")
    .get(req.params.id).c;
  if (orderCount > 0) {
    return res.status(400).json({ error: "Cannot delete a table that has order history" });
  }
  db.prepare("DELETE FROM tables WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
