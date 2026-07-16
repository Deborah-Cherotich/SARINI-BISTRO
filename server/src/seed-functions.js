const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { db, dataDir } = require("./db");

const SEED_IMAGES_DIR = path.join(__dirname, "..", "seed", "images");
const UPLOADS_DIR = path.join(dataDir, "uploads");

// Maps a menu item's exact name (from seed/menu.json) to a photo extracted
// from the original Sarini Bistro PDF menu, so the first-run seed ships with
// a few real dish photos instead of only placeholders.
const SEED_IMAGE_BY_ITEM_NAME = {
  Cappuccino: "cappuccino.jpg",
  "Vegetarian Burger": "vegetarian-burger.jpg",
  "Oreo Shake": "oreo-shake.jpg",
  "Classic Shake (Mango)": "classic-shake-mango.jpg",
  "Mocha Shake": "mocha-shake.jpg",
};

function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;
  const insert = db.prepare(
    "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)"
  );
  insert.run("Administrator", "sariniadmin", bcrypt.hashSync("admin123", 10), "admin");
  insert.run("Staff", "sarinistaff", bcrypt.hashSync("staff123", 10), "cashier");
  console.log("Seeded default users: sariniadmin/admin123, sarinistaff/staff123");
}

function seedTables() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM tables").get().c;
  if (count > 0) return;
  const insert = db.prepare("INSERT INTO tables (label, seats) VALUES (?, ?)");
  for (let i = 1; i <= 10; i++) {
    insert.run(`Table ${i}`, i % 3 === 0 ? 6 : 4);
  }
  console.log("Seeded 10 default tables");
}

function seedItemImage(itemName) {
  const filename = SEED_IMAGE_BY_ITEM_NAME[itemName];
  if (!filename) return null;
  const src = path.join(SEED_IMAGES_DIR, filename);
  if (!fs.existsSync(src)) return null;
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const dest = path.join(UPLOADS_DIR, filename);
  fs.copyFileSync(src, dest);
  return `/uploads/${filename}`;
}

function seedMenu() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
  if (count > 0) return;
  const menuPath = path.join(__dirname, "..", "seed", "menu.json");
  const data = JSON.parse(fs.readFileSync(menuPath, "utf-8"));

  const insertCategory = db.prepare(
    "INSERT INTO categories (name, sort_order) VALUES (?, ?)"
  );
  const insertItem = db.prepare(
    "INSERT INTO menu_items (category_id, name, price, description, image_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const seedTx = db.transaction((categories) => {
    categories.forEach((cat, catIndex) => {
      const { lastInsertRowid: categoryId } = insertCategory.run(cat.category, catIndex);
      cat.items.forEach((item, itemIndex) => {
        insertItem.run(
          categoryId,
          item.name,
          item.price,
          item.description || null,
          seedItemImage(item.name),
          itemIndex
        );
      });
    });
  });

  seedTx(data);
  const totalItems = data.reduce((sum, c) => sum + c.items.length, 0);
  console.log(`Seeded ${data.length} categories and ${totalItems} menu items`);
}

function seedAll() {
  seedUsers();
  seedTables();
  seedMenu();
}

module.exports = { seedUsers, seedTables, seedMenu, seedAll };
