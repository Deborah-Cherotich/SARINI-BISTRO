// Built by willykisg
import { useEffect, useState } from "react";
import { api } from "../../api";
import { formatMoney, parseServerDate } from "../../format";
import { AdminItemSearch } from "./AdminItemSearch";

interface SoldItem {
  name: string;
  quantity: number;
  amount: number;
}

interface WaiterTotal {
  name: string;
  orders: number;
  amount: number;
}

interface WaiterItem {
  waiter: string;
  name: string;
  quantity: number;
  amount: number;
}

interface VoidedOrder {
  id: number;
  total: number;
  created_at: string;
  closed_at: string;
  opened_by: string;
  table_label: string;
  items: { name: string; qty: number }[];
}

interface CancelledItem {
  id: number;
  order_id: number;
  name: string;
  qty: number;
  amount: number;
  was_sent: number;
  created_at: string;
  cancelled_by: string;
}

interface DaySummary {
  date: string;
  totals: {
    orders: number;
    sales: number;
    voidedCount: number;
    voidedAmount: number;
    cancelledCount: number;
    cancelledAmount: number;
  };
  sold: SoldItem[];
  waiters: WaiterTotal[];
  itemsByWaiter: WaiterItem[];
  voided: VoidedOrder[];
  cancelled: CancelledItem[];
}

// The browser's own calendar day (the till's local day), as YYYY-MM-DD.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Server timestamps are UTC without a marker — show them as local time.
function timeOf(value: string): string {
  const d = parseServerDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function itemsText(items: { name: string; qty: number }[]): string {
  return items.map((i) => `${i.qty} x ${i.name}`).join(", ");
}

type Cell = string | number;

function csvCell(value: Cell): string {
  let text = typeof value === "number" ? String(Math.round(value * 100) / 100) : value;
  // A text cell starting with = + - @ would be run as a formula by Excel.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) text = `'${value}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCsv(data: DaySummary): string {
  const rows: Cell[][] = [];
  const blank = () => rows.push([]);
  const none = () => rows.push(["None"]);

  rows.push(["SARINI BISTRO - END OF DAY REPORT"]);
  rows.push(["Date", data.date]);
  blank();

  rows.push(["SUMMARY"]);
  rows.push(["Paid orders", data.totals.orders]);
  rows.push(["Total sales", data.totals.sales]);
  rows.push(["Voided orders", data.totals.voidedCount]);
  rows.push(["Voided amount", data.totals.voidedAmount]);
  rows.push(["Cancelled items", data.totals.cancelledCount]);
  rows.push(["Cancelled amount", data.totals.cancelledAmount]);
  blank();

  rows.push(["ITEMS SOLD"]);
  rows.push(["Item", "Qty sold", "Amount"]);
  if (data.sold.length === 0) none();
  data.sold.forEach((s) => rows.push([s.name, s.quantity, s.amount]));
  if (data.sold.length > 0) {
    rows.push([
      "TOTAL",
      data.sold.reduce((n, s) => n + s.quantity, 0),
      data.sold.reduce((n, s) => n + s.amount, 0),
    ]);
  }
  blank();

  rows.push(["SALES BY WAITER (person who opened the order)"]);
  rows.push(["Waiter", "Orders", "Amount"]);
  if (data.waiters.length === 0) none();
  data.waiters.forEach((w) => rows.push([w.name, w.orders, w.amount]));
  blank();

  rows.push(["ITEMS SOLD BY WAITER"]);
  rows.push(["Waiter", "Item", "Qty sold", "Amount"]);
  if (data.itemsByWaiter.length === 0) none();
  data.itemsByWaiter.forEach((w) => rows.push([w.waiter, w.name, w.quantity, w.amount]));
  blank();

  rows.push(["VOIDED SALES"]);
  rows.push(["Order #", "Table", "Opened by", "Opened", "Voided", "Items", "Amount"]);
  if (data.voided.length === 0) none();
  data.voided.forEach((v) =>
    rows.push([
      v.id,
      v.table_label,
      v.opened_by,
      timeOf(v.created_at),
      timeOf(v.closed_at),
      itemsText(v.items),
      v.total,
    ])
  );
  blank();

  rows.push(["CANCELLED ITEMS"]);
  rows.push(["Time", "Order #", "Item", "Qty", "Amount", "Sent to kitchen", "Cancelled by"]);
  if (data.cancelled.length === 0) none();
  data.cancelled.forEach((c) =>
    rows.push([
      timeOf(c.created_at),
      c.order_id,
      c.name,
      c.qty,
      c.amount,
      c.was_sent ? "Yes" : "No",
      c.cancelled_by,
    ])
  );

  // BOM so Excel opens it as UTF-8; CRLF line endings are what Excel expects.
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(data: DaySummary) {
  const blob = new Blob([buildCsv(data)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sarini-day-report-${data.date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const PANEL = "bg-sarini-panel border border-black/30 rounded-xl p-5";
const TH = "py-2 pr-4";

export function AdminDayReport() {
  const [date, setDate] = useState(localToday());
  const [data, setData] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!date) return;
    let stale = false;
    setLoading(true);
    setError("");
    api
      .get<DaySummary>(`/reports/day-summary?date=${date}`)
      .then((result) => {
        if (!stale) setData(result);
      })
      .catch((err) => {
        if (!stale) setError(err instanceof Error ? err.message : "Failed to load report");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [date]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-semibold">End-of-Day Report</h2>
          <p className="text-xs text-gray-500">
            Sales, voids and cancelled items for one day. Download it as a CSV for Excel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={localToday()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm"
          />
          <button
            onClick={() => data && downloadCsv(data)}
            disabled={!data || loading}
            className="py-1.5 px-3 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-sarini-rose-bg border border-black/30 text-sarini-rose text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading && !data && <div className="text-gray-500 text-sm">Loading report...</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={PANEL}>
              <div className="text-xs text-gray-400">Total sales</div>
              <div className="text-xl text-sarini-yellow font-semibold">
                {formatMoney(data.totals.sales)}
              </div>
              <div className="text-xs text-gray-500">{data.totals.orders} paid orders</div>
            </div>
            <div className={PANEL}>
              <div className="text-xs text-gray-400">Voided sales</div>
              <div className="text-xl text-sarini-rose font-semibold">
                {formatMoney(data.totals.voidedAmount)}
              </div>
              <div className="text-xs text-gray-500">{data.totals.voidedCount} voided orders</div>
            </div>
            <div className={PANEL}>
              <div className="text-xs text-gray-400">Cancelled items</div>
              <div className="text-xl text-sarini-terracotta font-semibold">
                {formatMoney(data.totals.cancelledAmount)}
              </div>
              <div className="text-xs text-gray-500">{data.totals.cancelledCount} removals</div>
            </div>
          </div>

          <AdminItemSearch />

          <section className={PANEL}>
            <h3 className="text-white font-medium mb-3">Items Sold</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-black/30">
                    <th className={TH}>Item</th>
                    <th className={`${TH} text-right`}>Qty</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sold.map((s) => (
                    <tr key={s.name} className="border-b border-black/20">
                      <td className="py-2 pr-4 text-white">{s.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{s.quantity}</td>
                      <td className="py-2 text-right text-sarini-yellow">{formatMoney(s.amount)}</td>
                    </tr>
                  ))}
                  {data.sold.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-gray-500">
                        No paid sales on this day.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={PANEL}>
            <h3 className="text-white font-medium mb-1">Sales by Waiter</h3>
            <p className="text-xs text-gray-500 mb-3">
              Credited to the person who opened the order. The CSV also lists every item each waiter sold.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-black/30">
                    <th className={TH}>Waiter</th>
                    <th className={`${TH} text-right`}>Orders</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.waiters.map((w, i) => (
                    <tr key={`${w.name}-${i}`} className="border-b border-black/20">
                      <td className="py-2 pr-4 text-white">{w.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{w.orders}</td>
                      <td className="py-2 text-right text-sarini-yellow">{formatMoney(w.amount)}</td>
                    </tr>
                  ))}
                  {data.waiters.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-gray-500">
                        No paid sales on this day.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={PANEL}>
            <h3 className="text-white font-medium mb-3">Voided Sales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-black/30">
                    <th className={TH}>Order</th>
                    <th className={TH}>Table</th>
                    <th className={TH}>Opened by</th>
                    <th className={TH}>Voided</th>
                    <th className={TH}>Items</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.voided.map((v) => (
                    <tr key={v.id} className="border-b border-black/20">
                      <td className="py-2 pr-4 text-white">#{v.id}</td>
                      <td className="py-2 pr-4 text-gray-300">{v.table_label}</td>
                      <td className="py-2 pr-4 text-gray-300">{v.opened_by}</td>
                      <td className="py-2 pr-4 text-gray-400">{timeOf(v.closed_at)}</td>
                      <td className="py-2 pr-4 text-gray-400">{itemsText(v.items) || "-"}</td>
                      <td className="py-2 text-right text-sarini-rose">{formatMoney(v.total)}</td>
                    </tr>
                  ))}
                  {data.voided.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-gray-500">
                        No voided orders on this day.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={PANEL}>
            <h3 className="text-white font-medium mb-1">Cancelled Items</h3>
            <p className="text-xs text-gray-500 mb-3">
              Items removed from an order, or whose quantity was reduced. Removals made before this
              report was installed were not recorded.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-black/30">
                    <th className={TH}>Time</th>
                    <th className={TH}>Order</th>
                    <th className={TH}>Item</th>
                    <th className={`${TH} text-right`}>Qty</th>
                    <th className={TH}>Sent to kitchen</th>
                    <th className={TH}>Cancelled by</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cancelled.map((c) => (
                    <tr key={c.id} className="border-b border-black/20">
                      <td className="py-2 pr-4 text-gray-400">{timeOf(c.created_at)}</td>
                      <td className="py-2 pr-4 text-white">#{c.order_id}</td>
                      <td className="py-2 pr-4 text-gray-300">{c.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{c.qty}</td>
                      <td className="py-2 pr-4 text-gray-400">{c.was_sent ? "Yes" : "No"}</td>
                      <td className="py-2 pr-4 text-gray-300">{c.cancelled_by}</td>
                      <td className="py-2 text-right text-sarini-terracotta">
                        {formatMoney(c.amount)}
                      </td>
                    </tr>
                  ))}
                  {data.cancelled.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-3 text-gray-500">
                        No cancelled items on this day.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
