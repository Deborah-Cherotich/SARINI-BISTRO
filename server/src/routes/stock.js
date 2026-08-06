const express = require("express");
const { db } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Shared by the manual-movement endpoint here and by orders.js's checkout
// deduction, so "insert a movement row + update the running quantity" only
// exists in one place.
function applyStockMovement(stockItemId, change, reason, { orderId = null, note = null, userId } = {}) {
  db.prepare(
    "INSERT INTO stock_movements (stock_item_id, change, reason, order_id, note, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(stockItemId, change, reason, orderId, note, userId ?? null);
  db.prepare("UPDATE stock_items SET quantity = quantity + ? WHERE id = ?").run(change, stockItemId);
}

function withLowFlag(item) {
  return { ...item, low: item.quantity <= item.low_stock_threshold };
}

router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM stock_items WHERE active = 1 ORDER BY name")
    .all();
  res.json(items.map(withLowFlag));
});

router.get("/low", requireRole("admin"), (req, res) => {
  const items = db
    .prepare("SELECT * FROM stock_items WHERE active = 1 AND quantity <= low_stock_threshold ORDER BY name")
    .all();
  res.json(items.map(withLowFlag));
});

function isValidQuantity(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

router.post("/", requireRole("admin"), (req, res) => {
  const { name, unit = "pcs", low_stock_threshold = 0, quantity = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!isValidQuantity(low_stock_threshold) || !isValidQuantity(quantity)) {
    return res.status(400).json({ error: "quantity and low_stock_threshold must be numbers >= 0" });
  }

  const tx = db.transaction(() => {
    // Insert with quantity 0, then let applyStockMovement set the opening
    // amount — avoids double-counting it (once from this INSERT, again from
    // the movement's own quantity update).
    const { lastInsertRowid } = db
      .prepare("INSERT INTO stock_items (name, unit, quantity, low_stock_threshold) VALUES (?, ?, 0, ?)")
      .run(name, unit, low_stock_threshold);
    if (quantity > 0) {
      applyStockMovement(lastInsertRowid, quantity, "restock", {
        note: "Opening stock",
        userId: req.user.id,
      });
    }
    return lastInsertRowid;
  });

  const id = tx();
  res.status(201).json(withLowFlag(db.prepare("SELECT * FROM stock_items WHERE id = ?").get(id)));
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM stock_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Stock item not found" });

  const {
    name = existing.name,
    unit = existing.unit,
    low_stock_threshold = existing.low_stock_threshold,
  } = req.body || {};
  if (!isValidQuantity(low_stock_threshold)) {
    return res.status(400).json({ error: "low_stock_threshold must be a number >= 0" });
  }

  db.prepare("UPDATE stock_items SET name = ?, unit = ?, low_stock_threshold = ? WHERE id = ?").run(
    name,
    unit,
    low_stock_threshold,
    req.params.id
  );
  res.json(withLowFlag(db.prepare("SELECT * FROM stock_items WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM stock_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Stock item not found" });

  const usedBy = db
    .prepare(
      `SELECT m.name FROM menu_item_ingredients mi
       JOIN menu_items m ON m.id = mi.menu_item_id
       WHERE mi.stock_item_id = ?
       ORDER BY m.name`
    )
    .all(req.params.id);

  // Default behaviour still blocks the delete, so an accidental click can't
  // silently break a dish's stock tracking. Passing ?force=true (used after
  // the admin confirms in the UI) unlinks it from every dish first, then
  // proceeds with the delete in the same transaction.
  if (usedBy.length > 0 && req.query.force !== "true") {
    return res.status(400).json({
      error: `Still used by: ${usedBy.map((u) => u.name).join(", ")}`,
      usedBy: usedBy.map((u) => u.name),
    });
  }

  const tx = db.transaction(() => {
    if (usedBy.length > 0) {
      db.prepare("DELETE FROM menu_item_ingredients WHERE stock_item_id = ?").run(req.params.id);
    }
    db.prepare("UPDATE stock_items SET active = 0 WHERE id = ?").run(req.params.id);
  });
  tx();

  res.status(204).end();
});

router.post("/:id/movements", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM stock_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Stock item not found" });

  const { change, reason, note = null } = req.body || {};
  if (typeof change !== "number" || !Number.isFinite(change) || change === 0) {
    return res.status(400).json({ error: "change must be a non-zero number" });
  }
  if (reason !== "restock" && reason !== "adjustment") {
    return res.status(400).json({ error: 'reason must be "restock" or "adjustment"' });
  }

  const tx = db.transaction(() => {
    applyStockMovement(existing.id, change, reason, { note, userId: req.user.id });
  });
  tx();

  res.json(withLowFlag(db.prepare("SELECT * FROM stock_items WHERE id = ?").get(existing.id)));
});

router.get("/:id/movements", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM stock_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Stock item not found" });

  const movements = db
    .prepare(
      `SELECT m.*, u.name AS created_by_name
       FROM stock_movements m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.stock_item_id = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 200`
    )
    .all(req.params.id);
  res.json(movements);
});

router.get("/menu-items/:menuItemId/ingredients", (req, res) => {
  const ingredients = db
    .prepare(
      `SELECT mi.id, mi.stock_item_id, mi.qty_per_unit, s.name AS stock_item_name, s.unit AS stock_item_unit
       FROM menu_item_ingredients mi
       JOIN stock_items s ON s.id = mi.stock_item_id
       WHERE mi.menu_item_id = ?
       ORDER BY s.name`
    )
    .all(req.params.menuItemId);
  res.json(ingredients);
});

router.put("/menu-items/:menuItemId/ingredients", requireRole("admin"), (req, res) => {
  const menuItem = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.menuItemId);
  if (!menuItem) return res.status(404).json({ error: "Menu item not found" });

  const { ingredients } = req.body || {};
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: "ingredients must be an array" });
  }
  for (const ing of ingredients) {
    if (!ing || typeof ing.stock_item_id !== "number") {
      return res.status(400).json({ error: "each ingredient needs a numeric stock_item_id" });
    }
    if (typeof ing.qty_per_unit !== "number" || !Number.isFinite(ing.qty_per_unit) || ing.qty_per_unit <= 0) {
      return res.status(400).json({ error: "each ingredient needs a qty_per_unit number > 0" });
    }
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?").run(menuItem.id);
    for (const ing of ingredients) {
      db.prepare(
        "INSERT INTO menu_item_ingredients (menu_item_id, stock_item_id, qty_per_unit) VALUES (?, ?, ?)"
      ).run(menuItem.id, ing.stock_item_id, ing.qty_per_unit);
    }
  });
  tx();

  const result = db
    .prepare(
      `SELECT mi.id, mi.stock_item_id, mi.qty_per_unit, s.name AS stock_item_name, s.unit AS stock_item_unit
       FROM menu_item_ingredients mi
       JOIN stock_items s ON s.id = mi.stock_item_id
       WHERE mi.menu_item_id = ?
       ORDER BY s.name`
    )
    .all(menuItem.id);
  res.json(result);
});

module.exports = { router, applyStockMovement };
