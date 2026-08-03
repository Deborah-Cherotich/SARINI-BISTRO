import { useEffect, useState } from "react";
import { api } from "../api";
import type { Order } from "../types";
import { formatMoney, formatServerDate } from "../format";

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

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const sinceMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - sinceMonday);
  return toLocalDateString(d);
}

function startOfMonth() {
  const d = new Date();
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

type Period = "today" | "week" | "month" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

export function Reports() {
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [range, setRange] = useState<RangeReport | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectPeriod(p: Period) {
    setPeriod(p);
    if (p === "today") {
      setFrom(today());
      setTo(today());
    } else if (p === "week") {
      setFrom(startOfWeek());
      setTo(today());
    } else if (p === "month") {
      setFrom(startOfMonth());
      setTo(today());
    }
    // "custom" leaves from/to as whatever the date pickers currently hold.
  }

  async function load() {
    try {
      const historyParams = new URLSearchParams({ from, to });
      if (historyQuery.trim()) historyParams.set("q", historyQuery.trim());
      const [r, t, h] = await Promise.all([
        api.get<RangeReport>(`/reports/range?from=${from}&to=${to}`),
        api.get<TopItem[]>(`/reports/top-items?from=${from}&to=${to}&limit=10`),
        api.get<Order[]>(`/orders/history?${historyParams.toString()}`),
      ]);
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
  }, [from, to]);

  async function deleteOrder(id: number) {
    if (
      !window.confirm(
        `Permanently delete order #${id}? This cannot be undone and will remove it from past totals.`
      )
    )
      return;
    try {
      await api.delete(`/orders/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  }

  async function resetSalesData() {
    const typed = window.prompt(
      'This permanently deletes every order and sale on record, and resets all stock quantities/history to zero (menu, tables, staff accounts, stock items, and dish recipes are kept). Type RESET to confirm.'
    );
    if (typed !== "RESET") return;
    try {
      await api.post("/reports/reset-sales-data", { confirm: "RESET" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset sales data");
    }
  }

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <button
          onClick={resetSalesData}
          className="text-xs px-3 py-1.5 rounded-md border border-red-800 text-red-400 hover:bg-red-950/40"
        >
          Reset Sales Data
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <section className="bg-sarini-panel border border-black/30 rounded-xl p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => selectPeriod(p.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-sarini-yellow text-black"
                  : "bg-sarini-panel-light text-gray-300 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-4 mb-4 pt-2 border-t border-black/30">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <div className="text-gray-400 text-sm">
            {periodLabel} {from !== to && `(${from} → ${to})`}
          </div>
          <div className="text-3xl font-semibold text-sarini-yellow mt-1">
            {range ? formatMoney(range.grandTotal) : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {range?.days.reduce((sum, d) => sum + d.orderCount, 0) ?? 0} orders
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-white font-semibold mb-3">Sales Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Sales by Day</h3>
            <div className="space-y-2">
              {range?.days.map((d) => (
                <div key={d.day} className="flex justify-between text-sm">
                  <span className="text-gray-300">{d.day}</span>
                  <span className="text-gray-400">{d.orderCount} orders</span>
                  <span className="text-sarini-yellow">{formatMoney(d.total)}</span>
                </div>
              ))}
              {range?.days.length === 0 && (
                <div className="text-gray-500 text-sm">No sales in this period.</div>
              )}
            </div>
          </div>

          <div className="bg-sarini-panel border border-black/30 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Top Selling Items</h3>
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
      </section>

      <section className="bg-sarini-panel border border-black/30 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-3 gap-4 flex-wrap">
          <h2 className="text-white font-semibold">Order History ({periodLabel})</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search order #"
              className="rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm"
            />
            <button
              onClick={load}
              className="py-1.5 px-3 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
            >
              Search
            </button>
            <span className="text-xs text-gray-500 whitespace-nowrap">{history.length} orders</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-black/30">
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 text-right">Actions</th>
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
                  <td className="py-2 pr-4 text-gray-400">{formatServerDate(o.created_at)}</td>
                  <td className="py-2 pr-4 text-right text-sarini-yellow">
                    {formatMoney(o.total)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteOrder(o.id)}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No orders in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
