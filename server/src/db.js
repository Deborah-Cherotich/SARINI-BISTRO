const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const dataDir = process.env.SARINI_DATA_DIR || path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, "sarini.db");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  image_path TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER REFERENCES tables(id),
  order_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in','takeaway')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  received_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER REFERENCES menu_items(id),
  name_snapshot TEXT NOT NULL,
  price_snapshot REAL NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  kitchen_status TEXT NOT NULL DEFAULT 'pending' CHECK (kitchen_status IN ('pending','sent')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// sql.js is SQLite compiled to WASM (pure JS, no native addon) so it can be
// packaged into an Electron installer without a matching prebuilt binary for
// Electron's Node ABI. This adapter mimics the better-sqlite3 API
// (prepare().get/all/run, exec, transaction) so route files are unaffected.
const db = {};
let sqlDb = null;
let suspendPersist = false;

function persist() {
  if (suspendPersist) return;
  const data = sqlDb.export();
  fs.writeFileSync(dbFile, Buffer.from(data));
}

function makeStatement(sql) {
  return {
    get(...params) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...params) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      const changes = sqlDb.getRowsModified();
      const idRes = sqlDb.exec("SELECT last_insert_rowid() AS id");
      const lastInsertRowid = idRes[0]?.values[0][0];
      persist();
      return { changes, lastInsertRowid };
    },
  };
}

// Older installs already have a `users` table on disk with the strict
// CHECK (role IN ('admin','cashier')) constraint baked in — CREATE TABLE IF
// NOT EXISTS above won't touch it, so rebuild the table in place the first
// time we see the old constraint, to allow the now open-ended role values.
function usersTableHasOldRoleCheck(sqlDb) {
  const res = sqlDb.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
  const createSql = res[0]?.values[0]?.[0];
  return typeof createSql === "string" && createSql.includes("CHECK (role IN");
}

function migrateUsersRoleColumn(sqlDb) {
  // orders.created_by/received_by reference users(id), so dropping the old
  // `users` table with foreign keys enabled fails with a FOREIGN KEY
  // constraint error the moment any order history exists. Disabling the
  // pragma around the rebuild is SQLite's documented procedure for this
  // exact kind of schema change (see "Making Other Kinds Of Table Schema
  // Changes" in the SQLite ALTER TABLE docs) — it must happen outside the
  // transaction since foreign_keys can't be toggled mid-transaction.
  sqlDb.run("PRAGMA foreign_keys = OFF");
  try {
    sqlDb.run("BEGIN");
    try {
      sqlDb.run(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      sqlDb.run(`
        INSERT INTO users_new (id, name, username, password_hash, role, active, created_at)
        SELECT id, name, username, password_hash, role, active, created_at FROM users;
      `);
      sqlDb.run("DROP TABLE users");
      sqlDb.run("ALTER TABLE users_new RENAME TO users");
      sqlDb.run("COMMIT");
    } catch (err) {
      sqlDb.run("ROLLBACK");
      throw err;
    }
  } finally {
    sqlDb.run("PRAGMA foreign_keys = ON");
  }
}

let initPromise = null;

function initDb() {
  if (initPromise) return initPromise;
  initPromise = initSqlJs().then((SQL) => {
    const fileBuffer = fs.existsSync(dbFile) ? fs.readFileSync(dbFile) : undefined;
    sqlDb = new SQL.Database(fileBuffer);
    sqlDb.run("PRAGMA foreign_keys = ON");
    sqlDb.run(SCHEMA_SQL);
    if (usersTableHasOldRoleCheck(sqlDb)) {
      migrateUsersRoleColumn(sqlDb);
    }
    persist();

    db.exec = (sql) => {
      sqlDb.run(sql);
      persist();
    };
    db.pragma = () => {};
    db.prepare = (sql) => makeStatement(sql);
    db.transaction = (fn) => (...args) => {
      suspendPersist = true;
      sqlDb.run("BEGIN");
      try {
        const result = fn(...args);
        sqlDb.run("COMMIT");
        suspendPersist = false;
        persist();
        return result;
      } catch (err) {
        sqlDb.run("ROLLBACK");
        suspendPersist = false;
        throw err;
      }
    };

    return db;
  });
  return initPromise;
}

module.exports = { db, initDb, dataDir };
