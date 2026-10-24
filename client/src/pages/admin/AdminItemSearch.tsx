// Built by willykisg
import { useEffect, useState } from "react";
import { api } from "../../api";
import { formatMoney } from "../../format";

interface SearchItem {
  name: string;
  quantity: number;
  amount: number;
  orders: number;
}

interface SearchResult {
  q: string;
  from: string;
  to: string;
  items: SearchItem[];
  totalQuantity: number;
  totalAmount: number;
}

// The browser's own calendar day (the till's local day), as YYYY-MM-DD.
function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function rangeText(from: string, to: string): string {
  return from === to ? `on ${from}` : `from ${from} to ${to}`;
}

const INPUT =
  "rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm";
const PRESET =
  "py-1 px-2.5 rounded-md border border-gray-600 text-gray-300 text-xs hover:bg-sarini-panel-light";

export function AdminItemSearch() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(dayString(new Date()));
  const [to, setTo] = useState(dayString(new Date()));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pickRange(kind: "today" | "week" | "month") {
    const now = new Date();
    const end = dayString(now);
    if (kind === "today") {
      setFrom(end);
    } else if (kind === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setFrom(dayString(start));
    } else {
      setFrom(dayString(new Date(now.getFullYear(), now.getMonth(), 1)));
    }
    setTo(end);
  }

  useEffect(() => {
    const q = query.trim();
    if (!q || !from || !to) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    setError("");
    // Wait a moment after typing stops so we don't search on every keystroke.
    const timer = setTimeout(() => {
      api
        .get<SearchResult>(
          `/reports/item-search?q=${encodeURIComponent(q)}&from=${from}&to=${to}`
        )
        .then((r) => {
          if (!stale) setResult(r);
        })
        .catch((err) => {
          if (!stale) {
            setResult(null);
            setError(err instanceof Error ? err.message : "Search failed");
          }
        })
        .finally(() => {
          if (!stale) setLoading(false);
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, from, to]);

  let headline = "";
  if (result) {
    const when = rangeText(result.from, result.to);
    if (result.items.length === 0) {
      headline = `Nothing on the menu or in sales matches "${result.q}".`;
    } else if (result.totalQuantity === 0) {
      headline = `"${result.q}" was not sold ${when}.`;
    } else {
      headline = `${result.totalQuantity} sold ${when} (${formatMoney(result.totalAmount)}).`;
    }
  }

  return (
    <section className="bg-sarini-panel border border-black/30 rounded-xl p-5">
      <h3 className="text-white font-medium mb-1">Item Search</h3>
      <p className="text-xs text-gray-500 mb-3">
        Type an item name (for example chips or tea) to see how many were sold. Only paid sales
        count.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an item..."
          className={`${INPUT} flex-1 min-w-[10rem]`}
        />
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className={INPUT}
        />
        <span className="text-gray-500 text-sm">to</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className={INPUT}
        />
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => pickRange("today")} className={PRESET}>
          Today
        </button>
        <button onClick={() => pickRange("week")} className={PRESET}>
          Last 7 days
        </button>
        <button onClick={() => pickRange("month")} className={PRESET}>
          This month
        </button>
      </div>

      {error && <div className="text-sarini-rose text-sm mb-2">{error}</div>}
      {!query.trim() && <div className="text-gray-500 text-sm">Start typing an item name.</div>}
      {query.trim() && loading && <div className="text-gray-500 text-sm">Searching...</div>}

      {result && !loading && (
        <>
          <div
            className={`text-sm font-medium mb-3 ${
              result.totalQuantity > 0 ? "text-sarini-yellow" : "text-sarini-rose"
            }`}
          >
            {headline}
          </div>
          {result.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-black/30">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4 text-right">Qty sold</th>
                    <th className="py-2 pr-4 text-right">Orders</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((i) => (
                    <tr key={i.name} className="border-b border-black/20">
                      <td className="py-2 pr-4 text-white">{i.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{i.quantity}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{i.orders}</td>
                      <td className="py-2 text-right">
                        {i.quantity > 0 ? (
                          <span className="text-sarini-yellow">{formatMoney(i.amount)}</span>
                        ) : (
                          <span className="text-gray-500">Not sold</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
