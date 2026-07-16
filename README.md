# Sarini Bistro POS

A point-of-sale system for Sarini Bistro: table management, order taking from the full
menu (with dish photos), kitchen/receipt printing, staff roles, and sales reports.
Runs fully offline — no internet connection needed once installed.

- **Server**: Node.js + Express + `sql.js` (SQLite compiled to WASM — pure JS, no
  native/compiled dependencies, which is what makes the desktop installer possible
  without a C++ build toolchain)
- **Client**: React + TypeScript + Tailwind CSS
- **Desktop shell**: Electron (`electron/`) — wraps the client + server into one
  installable Windows app

## Two ways to run this

1. **As a developer**, for making changes — two dev servers, hot reload (below).
2. **As a real installed app** for day-to-day use at the till — a proper Windows
   installer with a desktop/Start Menu icon, works fully offline, no terminals. See
   "Building the desktop installer" further down.

## Developer setup

Open two terminals.

**Terminal 1 — server**
```
cd server
npm install
npm run dev
```
This starts the API on http://localhost:4000 and automatically creates
`server/data/sarini.db`, seeding it with the full Sarini Bistro menu (including a
few real dish photos), 10 tables, and two default logins the first time it runs:

| Username    | Password  | Role    |
|-------------|-----------|---------|
| sariniadmin | admin123  | admin   |
| sarinistaff | staff123  | cashier |

**Change these passwords** (Admin → Users tab) before using this in a real shift.

**Terminal 2 — client**
```
cd client
npm install
npm run dev
```
This starts the app on http://localhost:5173 (Vite proxies `/api` and `/uploads`
calls to the server, so no extra configuration is needed). Open that URL in a
browser and log in.

## Day-to-day use

- **Tables** (home screen) — tap a free table to open an order, or start a takeaway
  order. Occupied tables (terracotta) jump back into their existing order.
- **Order screen** — tap menu items by category to add them to the cart (items with
  a photo show it on the tile), adjust quantity/notes, then **Send to Kitchen**
  (prints a kitchen ticket) and **Checkout** (choose payment method, prints a
  customer receipt, frees the table).
- **Admin** (admin role only) — edit menu categories/items/prices, upload/replace a
  photo per dish, manage tables, and create/deactivate staff accounts.
- **Reports** (admin role only) — today's sales, a date-range summary, top-selling
  items, and searchable order history.

Printing uses the browser's print dialog (`window.print()`), so it works with any
printer you have installed, including 80mm thermal receipt printers.

## Building the desktop installer

This packages the app into a real Windows installer (`.exe`) using
[electron-builder](https://www.electron.build/) — the person who runs it just
double-clicks it like any other program, gets a desktop/Start Menu shortcut, and the
app works with zero internet connection (the database and any uploaded photos live
in that computer's own user data folder, so they persist across reinstalls/updates).

**One-time requirement**: electron-builder needs to create symbolic links while
preparing its packaging tools, which on Windows requires **Developer Mode**:
Settings → Privacy & security → For developers → turn on **Developer Mode**. No
reboot needed. (Alternatively, run the build step from an elevated/Administrator
terminal.)

```
cd client && npm install && npm run build      # builds the production React app
cd ../electron && npm install && npm run dist  # produces the installer
```

The installer lands in `electron/dist/` (e.g. `Sarini Bistro POS Setup 1.0.0.exe`).
Copy that file to the till computer and run it — that's the whole install.

## Resetting the database

**Developer mode**: stop the server, delete the database file, then start it again:
```
rm server/data/sarini.db
npm run dev   # from server/, recreates and reseeds automatically
```

**Installed desktop app**: close the app, then delete its data folder — press
`Win+R`, enter `%APPDATA%\sarini-bistro-desktop`, delete the `data` folder inside,
and relaunch the app.

To only reseed missing pieces without wiping (e.g. after manually clearing a table),
run `npm run seed` from `server/` — it skips any table that already has rows.

## Project structure

```
server/
  src/
    index.js            # Express app entry point (serves API + built client)
    db.js                # sql.js (SQLite/WASM) schema + better-sqlite3-like adapter
    seed-functions.js     # seed logic (users, tables, menu, seed photos)
    routes/                # auth, menu, tables, orders, reports, users
  seed/
    menu.json               # full Sarini Bistro menu, editable before first run
    images/                  # a few real dish photos seeded onto matching items
client/
  src/
    pages/              # Login, Tables, OrderScreen, Admin, Reports
    components/         # Layout, ProtectedRoute, Receipt, KitchenTicket, ItemThumb
    context/AuthContext.tsx
    api.ts                # typed fetch wrapper (JWT auth + file uploads)
electron/
  main.js               # Electron main process — starts the server in-process,
                          # opens a window once it's ready
  package.json            # electron-builder installer configuration
```
