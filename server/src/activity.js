// Built by willykisg
const { db } = require("./db");

// Records who did what, so the Day Report can trace a waiter through the day.
// Logging must never get in the way of a sale: any failure is swallowed.
function logActivity(userId, action, orderId, detail) {
  try {
    db.prepare(
      "INSERT INTO activity_log (user_id, action, order_id, detail) VALUES (?, ?, ?, ?)"
    ).run(userId ?? null, action, orderId ?? null, detail ?? null);
  } catch (err) {
    console.error("activity log failed:", err && err.message);
  }
}

module.exports = { logActivity };
