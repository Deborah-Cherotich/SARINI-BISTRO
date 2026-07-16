const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { db, dataDir } = require("../db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const IMAGE_EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = Object.prototype.hasOwnProperty.call(IMAGE_EXT_BY_MIME, file.mimetype);
    cb(ok ? null : new Error("Only JPEG, PNG or WEBP images are allowed"), ok);
  },
});

function handleImageUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// Verify the file's actual bytes match a real image format, rather than
// trusting the client-supplied Content-Type header.
function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

router.get("/", (req, res) => {
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order, name")
    .all();
  const items = db
    .prepare("SELECT * FROM menu_items WHERE active = 1 ORDER BY sort_order, name")
    .all();
  const result = categories.map((cat) => ({
    ...cat,
    items: items.filter((item) => item.category_id === cat.id),
  }));
  res.json(result);
});

router.post("/categories", requireRole("admin"), (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const { lastInsertRowid } = db
    .prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)")
    .run(name, sort_order);
  res.status(201).json(db.prepare("SELECT * FROM categories WHERE id = ?").get(lastInsertRowid));
});

router.put("/categories/:id", requireRole("admin"), (req, res) => {
  const { name, sort_order } = req.body || {};
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Category not found" });
  db.prepare("UPDATE categories SET name = ?, sort_order = ? WHERE id = ?").run(
    name ?? existing.name,
    sort_order ?? existing.sort_order,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id));
});

router.delete("/categories/:id", requireRole("admin"), (req, res) => {
  const itemCount = db
    .prepare("SELECT COUNT(*) AS c FROM menu_items WHERE category_id = ? AND active = 1")
    .get(req.params.id).c;
  if (itemCount > 0) {
    return res.status(400).json({ error: "Cannot delete a category that still has menu items" });
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

function isValidPrice(price) {
  return typeof price === "number" && Number.isFinite(price) && price >= 0;
}

router.post("/items", requireRole("admin"), (req, res) => {
  const { category_id, name, price, description = null, sort_order = 0 } = req.body || {};
  if (!category_id || !name || price == null) {
    return res.status(400).json({ error: "category_id, name and price are required" });
  }
  if (!isValidPrice(price)) {
    return res.status(400).json({ error: "price must be a number >= 0" });
  }
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO menu_items (category_id, name, price, description, sort_order) VALUES (?, ?, ?, ?, ?)"
    )
    .run(category_id, name, price, description, sort_order);
  res.status(201).json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(lastInsertRowid));
});

router.put("/items/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Item not found" });
  const {
    category_id = existing.category_id,
    name = existing.name,
    price = existing.price,
    description = existing.description,
    sort_order = existing.sort_order,
    active = existing.active,
  } = req.body || {};
  if (!isValidPrice(price)) {
    return res.status(400).json({ error: "price must be a number >= 0" });
  }
  db.prepare(
    "UPDATE menu_items SET category_id = ?, name = ?, price = ?, description = ?, sort_order = ?, active = ? WHERE id = ?"
  ).run(category_id, name, price, description, sort_order, active ? 1 : 0, req.params.id);
  res.json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id));
});

router.delete("/items/:id", requireRole("admin"), (req, res) => {
  db.prepare("UPDATE menu_items SET active = 0 WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

router.post(
  "/items/:id/image",
  requireRole("admin"),
  handleImageUpload,
  (req, res) => {
    const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Item not found" });
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const sniffed = sniffImageMime(req.file.buffer);
    if (!sniffed || !IMAGE_EXT_BY_MIME[sniffed]) {
      return res.status(400).json({ error: "File is not a valid JPEG, PNG or WEBP image" });
    }

    const ext = IMAGE_EXT_BY_MIME[sniffed];
    const filename = `item-${existing.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

    const imagePath = `/uploads/${filename}`;
    db.prepare("UPDATE menu_items SET image_path = ? WHERE id = ?").run(imagePath, existing.id);

    if (existing.image_path) {
      const oldFile = path.join(dataDir, existing.image_path.replace(/^\//, ""));
      fs.unlink(oldFile, () => {});
    }

    res.json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(existing.id));
  }
);

module.exports = router;
