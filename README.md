# Sarini Bistro POS

A point-of-sale system for Sarini Bistro: table management, order taking from the full
menu (with dish photos), kitchen/receipt printing, staff roles, sales reports, and
stock/inventory tracking. Runs fully offline — no internet connection needed once
installed.

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

- **Login** — pick "Admin" or "Staff" (this is just a label for the sign-in button,
  it doesn't restrict anything — the account's real role decides what you can see
  after logging in), enter username/password, and optionally check **Remember me on
  this device** to stay logged in after closing and reopening the app/browser
  (unchecked, it logs out as soon as the window/tab closes — useful on a shared
  till). Works the same for every role, admin included.
- **Tables** (home screen) — tap a free table to open an order, or start a takeaway
  order. Occupied tables (terracotta) jump back into their existing order.
- **Order screen** — tap menu items by category to add them to the cart (items with
  a photo show it on the tile), adjust quantity/notes, then **Send to Kitchen**
  (prints a kitchen ticket) and **Complete & Print Receipt** (payment itself is
  handled at the hotel's counter, outside this app — this just closes the order,
  prints the customer receipt, and frees the table).
- **Admin** (admin role only) — edit menu categories/items/prices, upload/replace a
  photo per dish, manage tables, create/deactivate staff accounts, and track stock
  (see "Stock / inventory tracking" below). Each staff account can also be edited in
  place (name, username, password, role) via the **Edit** button next to it in the
  Users tab — the person can log in with the updated username/password immediately
  after saving.
- **Reports** (admin role only) — today's sales, a date-range summary, top-selling
  items, and searchable order history.

Printing uses the browser's print dialog (`window.print()`), so it works with any
printer you have installed, including 80mm thermal receipt printers. See "Setting up
a receipt printer" below for connecting one.

## Stock / inventory tracking

Lets the admin track raw stock (e.g. sausages, chicken, drinks) and have it reduce
automatically whenever a dish that uses it gets sold — no manual counting needed.
Found under **Admin → Stock**.

Built on the same stack as the rest of the app — no extra services, databases, or
dependencies added: the API endpoints live in `server/src/routes/stock.js` (Node.js
+ Express), the data lives in three new tables in the existing `sql.js` (SQLite)
database (`stock_items`, `menu_item_ingredients`, `stock_movements` — see `db.js`),
and the screen is a React + TypeScript page (`client/src/pages/admin/AdminStock.tsx`)
styled with Tailwind CSS, same as every other admin screen. The automatic deduction
is wired directly into the existing checkout endpoint in `orders.js`.

**How it works, in plain terms:**
- **Stock items** are your raw supplies — a running count with a unit (pcs, kg,
  litres, whatever fits) and a "low stock" threshold that shows a warning badge once
  you're at or below it.
- **Recipes** are what link a menu dish to the stock it uses, and how much per sale
  — e.g. "Mixed Grill uses 2 Sausages." Not every dish needs one; dishes with no
  recipe (like a cup of tea) simply never touch stock. This is admin-defined and
  opt-in per dish.
- **Deduction is automatic and happens at checkout** — the moment an order is paid
  and closed, the system looks at what was sold, checks each item's recipe, and
  reduces the matching stock quantities on its own. Staff don't do anything extra.
- **Restocking / corrections** are manual: pick "Restock" when new stock arrives, or
  "Adjustment" to correct a miscount or log breakage/spoilage (can be negative), with
  an optional note.
- **History** — every single change (restocks, sale deductions with the order number,
  and manual corrections) is logged with the date and which staff member did it, so
  "History" on any stock item is the full stock report/audit trail.

**Setting it up for the first time:**
1. Admin → Stock → add each stock item you want to track, with its starting quantity.
2. Under "Dish Recipes," pick a dish, then link the stock item(s) it uses and how
   many per sale. Repeat for every dish you want tracked — this is a one-time setup
   per dish, not something done per order.
3. From then on, selling that dish and completing the order deducts stock by itself.

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

**If you're building inside a OneDrive-synced folder** (e.g. the project lives under
`Documents` and that's backed up to OneDrive), the build can fail with a "file is
being used by another process" error while electron-builder repacks
`dist/win-unpacked` — OneDrive briefly locks the file while syncing it. If that
happens, either pause OneDrive syncing first, or point the build at a folder outside
OneDrive: `npx electron-builder -c.directories.output=C:\some\other\folder` (run from
`electron/`), then copy the resulting installer back into `electron/dist/` yourself.

**Remember to rebuild after every code change** — the installer is a snapshot; it
does not update itself. Re-run both commands above and reinstall whenever you want
the installed app to reflect the latest changes.

## Installing on another computer

The installer is fully self-contained — the other machine needs nothing pre-installed
(no Node.js, no internet connection required to run it).

1. Copy `Sarini Bistro POS Setup 1.0.0.exe` to the other computer (USB drive, shared
   network folder, cloud transfer — any way of moving one file works).
2. Double-click it to run. A few things to expect:
   - **Requires 64-bit Windows** (the build targets `x64`).
   - **SmartScreen warning**: since it's unsigned (no code-signing certificate),
     Windows will likely flag it as from an "Unknown Publisher" — click **More info**
     → **Run anyway**.
   - **No admin rights needed** — it's a per-user install, not per-machine.
   - The wizard lets you choose the install folder, and creates both a desktop and a
     Start Menu shortcut automatically.
3. On first launch it creates its own local database and seeds it (menu, tables, and
   the two default logins) inside that machine's own
   `%APPDATA%\sarini-bistro-desktop` folder.

**Each installed machine has its own separate, independent database.** Installing on
a second machine does not share or sync orders/tables with the first one — this is
meant for one standalone till per install, not multiple tills sharing live data.

## Setting up a receipt printer

Printing goes through the normal Windows print dialog (`window.print()`), so any
printer already installed on that computer works — no app-specific driver or setup.

1. **Install the printer in Windows first**: connect it (USB or network), then
   Settings → Bluetooth & devices → Printers & scanners → Add device. Most 80mm
   thermal receipt printers ship with their own driver — install that if Windows
   doesn't auto-detect it.
2. In the app, tap **Print** on a kitchen ticket or receipt — the browser's print
   dialog opens. Pick the receipt printer there (it doesn't have to be the Windows
   default printer; you choose it per print).
3. **For 80mm thermal printers**, in the print dialog: set **Paper size** to your
   printer's roll width (many list an "80mm" or "Receipt" size once the driver is
   installed), turn **Headers and footers** off, and set **Margins** to "None" or
   the smallest option — otherwise you'll get extra blank space or a cut-off receipt.
   These settings are usually remembered after the first print.
4. You can have a regular printer for something else and the receipt printer both
   installed at once — the app doesn't assume a fixed printer, staff just pick the
   right one each time the print dialog opens.

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
    routes/                # auth, menu, tables, orders, reports, users, stock
  seed/
    menu.json               # full Sarini Bistro menu, editable before first run
    images/                  # a few real dish photos seeded onto matching items
client/
  src/
    pages/              # Login, Tables, OrderScreen, Admin, Reports
      admin/                # AdminMenu, AdminTables, AdminUsers, AdminStock
    components/         # Layout, ProtectedRoute, Receipt, KitchenTicket, ItemThumb
    context/AuthContext.tsx
    api.ts                # typed fetch wrapper (JWT auth + file uploads)
    authStorage.ts          # Remember Me: localStorage (persists) vs
                              # sessionStorage (cleared on tab/window close)
electron/
  main.js               # Electron main process — starts the server in-process,
                          # opens a window once it's ready
  package.json            # electron-builder installer configuration
```
