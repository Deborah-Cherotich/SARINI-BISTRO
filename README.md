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
  (prints a kitchen ticket) and **Complete & Print Receipt** (payment itself is
  handled at the hotel's counter, outside this app — this just closes the order,
  prints the customer receipt, and frees the table).
- **Admin** (admin role only) — edit menu categories/items/prices, upload/replace a
  photo per dish, manage tables, and create/deactivate staff accounts. Each staff
  account can also be edited in place (name, username, password, role) via the
  **Edit** button next to it in the Users tab — the person can log in with the
  updated username/password immediately after saving.
- **Reports** (admin role only) — today's sales, a date-range summary, top-selling
  items, and searchable order history.

Printing uses the browser's print dialog (`window.print()`), so it works with any
printer you have installed, including 80mm thermal receipt printers. See "Setting up
a receipt printer" below for connecting one.

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
