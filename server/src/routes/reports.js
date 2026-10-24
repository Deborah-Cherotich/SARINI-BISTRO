const express = require("express");
const { db } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware, requireRole("admin"));

// Reports group orders by the till's local calendar day, not UTC — otherwise
// orders closed in the evening (e.g. Kenya is UTC+3) roll onto "tomorrow".
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

router.get("/daily", (req, res) => {
  const date = req.query.date || todayLocal();
  const orders = db
    .prepare(
      "SELECT * FROM orders WHERE status = 'paid' AND date(closed_at, 'localtime') = date(?)"
    )
    .all(date);
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  const byMethod = {};
  orders.forEach((o) => {
    byMethod[o.payment_method] = (byMethod[o.payment_method] || 0) + o.total;
  });
  res.json({ date, orderCount: orders.length, total, byMethod });
});

router.get("/range", (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to are required" });
  const rows = db
    .prepare(
      `SELECT date(closed_at, 'localtime') AS day, COUNT(*) AS orderCount, SUM(total) AS total
       FROM orders
       WHERE status = 'paid' AND date(closed_at, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY date(closed_at, 'localtime')
       ORDER BY day`
    )
    .all(from, to);
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  res.json({ from, to, days: rows, grandTotal });
});

router.get("/top-items", (req, res) => {
  const { from, to, limit = 10 } = req.query;
  let sql = `
    SELECT oi.name_snapshot AS name, SUM(oi.qty) AS quantity, SUM(oi.qty * oi.price_snapshot) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid'
  `;
  const params = [];
  if (from) {
    sql += " AND date(o.closed_at, 'localtime') >= date(?)";
    params.push(from);
  }
  if (to) {
    sql += " AND date(o.closed_at, 'localtime') <= date(?)";
    params.push(to);
  }
  sql += " GROUP BY oi.name_snapshot ORDER BY quantity DESC LIMIT ?";
  const limitNum = Number(limit);
  const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.floor(limitNum) : 10;
  params.push(safeLimit);
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Everything the end-of-day report needs in one call: what sold (and who
// sold it), voided orders, and cancelled items. "Sold by" is whoever opened
// the order (created_by) — the same person the kitchen ticket calls
// "Started by". Days are the till's local calendar day, like the other
// reports.
router.get("/day-summary", (req, res) => {
  const date = req.query.date || todayLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  const sold = db
    .prepare(
      `SELECT oi.name_snapshot AS name, SUM(oi.qty) AS quantity, SUM(oi.qty * oi.price_snapshot) AS amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'paid' AND date(o.closed_at, 'localtime') = date(?)
       GROUP BY oi.name_snapshot
       ORDER BY quantity DESC, name`
    )
    .all(date);

  const waiters = db
    .prepare(
      `SELECT COALESCE(u.name, 'Unknown') AS name, COUNT(*) AS orders, SUM(o.total) AS amount
       FROM orders o
       LEFT JOIN users u ON u.id = o.created_by
       WHERE o.status = 'paid' AND date(o.closed_at, 'localtime') = date(?)
       GROUP BY o.created_by
       ORDER BY amount DESC`
    )
    .all(date);

  const itemsByWaiter = db
    .prepare(
      `SELECT COALESCE(u.name, 'Unknown') AS waiter, oi.name_snapshot AS name,
              SUM(oi.qty) AS quantity, SUM(oi.qty * oi.price_snapshot) AS amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN users u ON u.id = o.created_by
       WHERE o.status = 'paid' AND date(o.closed_at, 'localtime') = date(?)
       GROUP BY o.created_by, oi.name_snapshot
       ORDER BY waiter, quantity DESC, name`
    )
    .all(date);

  const voided = db
    .prepare(
      `SELECT o.id, o.total, o.created_at, o.closed_at,
              COALESCE(u.name, 'Unknown') AS opened_by,
              COALESCE(t.label, 'Takeaway') AS table_label
       FROM orders o
       LEFT JOIN users u ON u.id = o.created_by
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.status = 'void' AND date(o.closed_at, 'localtime') = date(?)
       ORDER BY o.closed_at`
    )
    .all(date)
    .map((o) => ({
      ...o,
      items: db
        .prepare("SELECT name_snapshot AS name, qty FROM order_items WHERE order_id = ? ORDER BY id")
        .all(o.id),
    }));

  const cancelled = db
    .prepare(
      `SELECT c.id, c.order_id, c.name_snapshot AS name, c.qty,
              c.price_snapshot * c.qty AS amount, c.was_sent, c.created_at,
              COALESCE(u.name, 'Unknown') AS cancelled_by
       FROM order_item_cancellations c
       LEFT JOIN users u ON u.id = c.cancelled_by
       WHERE date(c.created_at, 'localtime') = date(?)
       ORDER BY c.created_at`
    )
    .all(date);

  const sum = (rows, key) => rows.reduce((total, r) => total + (r[key] || 0), 0);
  res.json({
    date,
    totals: {
      orders: sum(waiters, "orders"),
      sales: sum(waiters, "amount"),
      voidedCount: voided.length,
      voidedAmount: sum(voided, "total"),
      cancelledCount: cancelled.length,
      cancelledAmount: sum(cancelled, "amount"),
    },
    sold,
    waiters,
    itemsByWaiter,
    voided,
    cancelled,
  });
});

// Item search: "how many chips were sold?" Searches paid sales by item name
// over a date range (inclusive, till-local days). Menu items that match the
// search but had no sales are returned with 0, so the screen can say
// "not sold" instead of showing nothing.
router.get("/item-search", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 60);
  if (!q) return res.status(400).json({ error: "Type an item name to search" });

  let from = req.query.from || todayLocal();
  let to = req.query.to || from;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOk.test(String(from)) || !dateOk.test(String(to))) {
    return res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
  }
  if (from > to) [from, to] = [to, from];

  // Escape LIKE wildcards so searching for "%" or "_" matches literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

  const items = db
    .prepare(
      `SELECT oi.name_snapshot AS name, SUM(oi.qty) AS quantity,
              SUM(oi.qty * oi.price_snapshot) AS amount, COUNT(DISTINCT o.id) AS orders
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'paid'
         AND date(o.closed_at, 'localtime') BETWEEN date(?) AND date(?)
         AND oi.name_snapshot LIKE ? ESCAPE '\\'
       GROUP BY oi.name_snapshot
       ORDER BY quantity DESC, name
       LIMIT 50`
    )
    .all(from, to, pattern);

  const soldNames = new Set(items.map((i) => i.name.toLowerCase()));
  const unsold = db
    .prepare("SELECT name FROM menu_items WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 50")
    .all(pattern)
    .filter((m) => !soldNames.has(m.name.toLowerCase()))
    .map((m) => ({ name: m.name, quantity: 0, amount: 0, orders: 0 }));

  const all = [...items, ...unsold];
  res.json({
    q,
    from,
    to,
    items: all,
    totalQuantity: items.reduce((n, i) => n + i.quantity, 0),
    totalAmount: items.reduce((n, i) => n + i.amount, 0),
  });
});

// Wipes all order/sales history so a business can go live with a clean
// slate after testing — deliberately leaves the menu, tables, and staff
// accounts untouched, since those are real setup work, not test data.
// Stock quantities/history get the same treatment as orders: the stock
// items and their dish recipes (also real setup work) are kept, but test
// quantities and the movement log are wiped back to zero, since those are
// just as much "test data" as the orders that produced them.
router.post("/reset-sales-data", (req, res) => {
  if (req.body?.confirm !== "RESET") {
    return res.status(400).json({ error: 'Send { "confirm": "RESET" } to proceed.' });
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM order_items").run();
    db.prepare("DELETE FROM orders").run();
    db.prepare("UPDATE tables SET status = 'free'").run();
    db.prepare("DELETE FROM order_item_cancellations").run();
    db.prepare("DELETE FROM stock_movements").run();
    db.prepare("UPDATE stock_items SET quantity = 0").run();
  });
  tx();
  res.json({ ok: true });
});

module.exports = router;
