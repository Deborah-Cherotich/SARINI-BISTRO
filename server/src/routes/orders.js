const express = require("express");
const { db } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

function getOrderWithItems(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return null;
  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(orderId);
  const table = order.table_id
    ? db.prepare("SELECT * FROM tables WHERE id = ?").get(order.table_id)
    : null;
  // "Served by" on the receipt is whoever completed the checkout, not
  // necessarily whoever opened the table originally (a different staff
  // member may have taken over service by the time the bill is settled).
  const servedBy = order.received_by
    ? db.prepare("SELECT name FROM users WHERE id = ?").get(order.received_by)
    : null;
  const createdBy = order.created_by
    ? db.prepare("SELECT name FROM users WHERE id = ?").get(order.created_by)
    : null;
  return {
    ...order,
    items,
    table,
    served_by_name: servedBy ? servedBy.name : null,
    created_by_name: createdBy ? createdBy.name : null,
  };
}

function isValidQty(qty) {
  return Number.isInteger(qty) && qty > 0;
}

function recalcTotals(orderId) {
  const { subtotal } = db
    .prepare(
      "SELECT COALESCE(SUM(price_snapshot * qty), 0) AS subtotal FROM order_items WHERE order_id = ?"
    )
    .get(orderId);
  db.prepare("UPDATE orders SET subtotal = ?, total = ? WHERE id = ?").run(
    subtotal,
    subtotal,
    orderId
  );
}

router.get("/open", (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE status = 'open' ORDER BY created_at DESC")
    .all();
  res.json(orders.map((o) => getOrderWithItems(o.id)));
});

router.get("/history", requireRole("admin"), (req, res) => {
  const { from, to, status, q } = req.query;
  let sql = "SELECT * FROM orders WHERE 1=1";
  const params = [];
  if (from) {
    sql += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND created_at <= ?";
    params.push(to + " 23:59:59");
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (q) {
    sql += " AND CAST(id AS TEXT) LIKE ?";
    params.push(`%${q}%`);
  }
  sql += " ORDER BY created_at DESC LIMIT 500";
  const orders = db.prepare(sql).all(...params);
  res.json(orders.map((o) => getOrderWithItems(o.id)));
});

router.get("/:id", (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

router.post("/", (req, res) => {
  const { table_id = null, order_type = "dine_in" } = req.body || {};

  if (table_id) {
    const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(table_id);
    if (!table) return res.status(404).json({ error: "Table not found" });
    const existingOpen = db
      .prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'open'")
      .get(table_id);
    if (existingOpen) {
      return res.json(getOrderWithItems(existingOpen.id));
    }
  }

  const tx = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO orders (table_id, order_type, created_by) VALUES (?, ?, ?)"
      )
      .run(table_id, order_type, req.user.id);
    if (table_id) {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
    }
    return lastInsertRowid;
  });

  const orderId = tx();
  res.status(201).json(getOrderWithItems(orderId));
});

router.post("/:id/items", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "open") return res.status(400).json({ error: "Order is not open" });

  const { menu_item_id, qty = 1, notes = null } = req.body || {};
  if (!isValidQty(qty)) {
    return res.status(400).json({ error: "qty must be a positive integer" });
  }
  const menuItem = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(menu_item_id);
  if (!menuItem) return res.status(404).json({ error: "Menu item not found" });

  db.prepare(
    "INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(order.id, menuItem.id, menuItem.name, menuItem.price, qty, notes);

  recalcTotals(order.id);
  res.status(201).json(getOrderWithItems(order.id));
});

router.patch("/:id/items/:itemId", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "open") return res.status(400).json({ error: "Order is not open" });

  const item = db
    .prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?")
    .get(req.params.itemId, order.id);
  if (!item) return res.status(404).json({ error: "Order item not found" });

  const { qty, notes, remove } = req.body || {};

  if (qty !== undefined && !isValidQty(qty)) {
    return res.status(400).json({ error: "qty must be a positive integer" });
  }

  const changingQtyOrRemoving = remove || (qty !== undefined && qty !== item.qty);
  if (item.kitchen_status === "sent" && changingQtyOrRemoving && req.user.role !== "admin") {
    return res.status(403).json({
      error: "This item was already sent to the kitchen. Ask an admin to change or void it.",
    });
  }

  if (remove) {
    db.prepare("DELETE FROM order_items WHERE id = ?").run(item.id);
  } else {
    db.prepare("UPDATE order_items SET qty = ?, notes = ? WHERE id = ?").run(
      qty ?? item.qty,
      notes ?? item.notes,
      item.id
    );
  }

  recalcTotals(order.id);
  res.json(getOrderWithItems(order.id));
});

router.post("/:id/send-to-kitchen", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  db.prepare(
    "UPDATE order_items SET kitchen_status = 'sent' WHERE order_id = ? AND kitchen_status = 'pending'"
  ).run(order.id);
  res.json(getOrderWithItems(order.id));
});

router.post("/:id/checkout", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "open") return res.status(400).json({ error: "Order is not open" });

  const itemCount = db
    .prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?")
    .get(order.id).c;
  if (itemCount === 0) {
    return res.status(400).json({ error: "Cannot checkout an empty order" });
  }

  const { payment_method = "cash" } = req.body || {};

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE orders SET status = 'paid', closed_at = datetime('now'), payment_method = ?, received_by = ? WHERE id = ?"
    ).run(payment_method, req.user.id, order.id);
    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
    }
  });
  tx();

  res.json(getOrderWithItems(order.id));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(order.id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(order.id);
    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
    }
  });
  tx();

  res.status(204).end();
});

router.post("/:id/void", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "open") return res.status(400).json({ error: "Order is not open" });

  // Any staff member should be able to back out of a table they opened by
  // mistake or a walk-in that changed their mind — that's routine, not an
  // admin-level decision. Once something has actually been sent to the
  // kitchen there's real food prep underway, so cancelling that needs an
  // admin, same as changing a sent item's quantity does.
  const sentCount = db
    .prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND kitchen_status = 'sent'")
    .get(order.id).c;
  if (sentCount > 0 && req.user.role !== "admin") {
    return res.status(403).json({
      error: "This order has items already sent to the kitchen. Ask an admin to void it.",
    });
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE orders SET status = 'void', closed_at = datetime('now') WHERE id = ?"
    ).run(order.id);
    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
    }
  });
  tx();

  res.json(getOrderWithItems(order.id));
});

module.exports = router;
