import { useEffect, useState } from "react";
import { api } from "../api";
import type { Order } from "../types";
import { formatMoney } from "../format";

interface DailyReport {
  date: string;
  orderCount: number;
  total: number;
  byMethod: Record<string, number>;
}

interface RangeReport {
  from: string;
  to: string;
  days: { day: string; orderCount: number; total: number }[];
  grandTotal: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

// Local calendar date (not UTC) so "today" matches the till's own clock —
// using toISOString() here would shift late-evening orders onto the wrong day.
function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function today() {
  return toLocalDateString(new Date());
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateString(d);
}

export function Reports() {
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [range, setRange] = useState<RangeReport | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [historyQuery, setHistoryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const historyParams = new URLSearchParams({ from, to });
      if (historyQuery.trim()) historyParams.set("q", historyQuery.trim());
      const [d, r, t, h] = await Promise.all([
        api.get<DailyReport>(`/reports/daily?date=${today()}`),
        api.get<RangeReport>(`/reports/range?from=${from}&to=${to}`),
        api.get<TopItem[]>(`/reports/top-items?from=${from}&to=${to}&limit=10`),
        api.get<Order[]>(`/orders/history?${historyParams.toString()}`),
      ]);
      setDaily(d);
      setRange(r);
      setTopItems(t);
      setHistory(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-4">Reports</h1>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Today's Sales</div>
          <div className="text-2xl font-semibold text-sarini-yellow mt-1">
            {daily ? formatMoney(daily.total) : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">{daily?.orderCount ?? 0} orders</div>
        </div>
        <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Range Total ({from} → {to})</div>
          <div className="text-2xl font-semibold text-sarini-yellow mt-1">
            {range ? formatMoney(range.grandTotal) : "—"}
          </div>
        </div>
        <div className="bg-sarini-panel border border-black/30 rounded-xl p-5 flex flex-col gap-2 justify-center">
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-400 w-8">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded bg-sarini-panel-light border border-gray-700 px-2 py-1 text-white text-sm"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-400 w-8">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded bg-sarini-panel-light border border-gray-700 px-2 py-1 text-white text-sm"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-400 w-8">Order</label>
            <input
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Search order #"
              className="flex-1 rounded bg-sarini-panel-light border border-gray-700 px-2 py-1 text-white text-sm"
            />
          </div>
          <button
            onClick={load}
            className="mt-1 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Sales by Day</h2>
          <div className="space-y-2">
            {range?.days.map((d) => (
              <div key={d.day} className="flex justify-between text-sm">
                <span className="text-gray-300">{d.day}</span>
                <span className="text-gray-400">{d.orderCount} orders</span>
                <span className="text-sarini-yellow">{formatMoney(d.total)}</span>
              </div>
            ))}
            {range?.days.length === 0 && (
              <div className="text-gray-500 text-sm">No sales in this range.</div>
            )}
          </div>
        </div>

        <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Top Selling Items</h2>
          <div className="space-y-2">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex justify-between text-sm">
                <span className="text-gray-300">
                  {i + 1}. {item.name}
                </span>
                <span className="text-gray-400">{item.quantity} sold</span>
                <span className="text-sarini-yellow">{formatMoney(item.revenue)}</span>
              </div>
            ))}
            {topItems.length === 0 && (
              <div className="text-gray-500 text-sm">No sales data yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-sarini-panel border border-black/30 rounded-xl p-5 mt-6">
        <h2 className="text-white font-semibold mb-3">Order History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-black/30">
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((o) => (
                <tr key={o.id} className="border-b border-black/20">
                  <td className="py-2 pr-4 text-white">#{o.id}</td>
                  <td className="py-2 pr-4 text-gray-300">
                    {o.table ? o.table.label : "Takeaway"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        o.status === "paid"
                          ? "bg-sarini-sage-bg text-sarini-sage"
                          : o.status === "void"
                          ? "bg-sarini-rose-bg text-sarini-rose"
                          : "bg-sarini-terracotta-bg text-sarini-terracotta"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{o.created_at}</td>
                  <td className="py-2 pr-4 text-gray-400 uppercase">{o.payment_method || "—"}</td>
                  <td className="py-2 text-right text-sarini-yellow">{formatMoney(o.total)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
