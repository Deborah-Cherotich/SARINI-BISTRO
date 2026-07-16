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

module.exports = router;
