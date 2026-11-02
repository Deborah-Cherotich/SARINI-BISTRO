// Built by willykisg
import { useEffect, useState } from "react";
import { api } from "../../api";
import { formatMoney, parseServerDate } from "../../format";

interface StaffUser {
  id: number;
  name: string;
  username: string;
  role: string;
  active: number;
}

interface TraceResult {
  user: { id: number; name: string; username: string; role: string };
  date: string;
  summary: {
    ordersOpened: number;
    salesOrders: number;
    salesAmount: number;
    settledOrders: number;
    settledAmount: number;
    cancelledItems: number;
    cancelledAmount: number;
    voids: number;
    actions: number;
  };
  itemsSold: { name: string; quantity: number; amount: number }[];
  timeline: {
    id: number;
    action: string;
    order_id: number | null;
    detail: string | null;
    created_at: string;
  }[];
}

// Plain-English label for each logged action, and whether it deserves a
// second look (removals, voids, deletes and reprints).
const ACTIONS: Record<string, { label: string; flag: boolean }> = {
  order_opened: { label: "Opened order", flag: false },
  item_added: { label: "Added item", flag: false },
  item_cancelled: { label: "Removed item", flag: true },
  sent_to_kitchen: { label: "Sent to kitchen", flag: false },
  order_settled: { label: "Settled order", flag: false },
  order_voided: { label: "Voided order", flag: true },
  order_deleted: { label: "Deleted order", flag: true },
  receipt_reprinted: { label: "Reprinted receipt", flag: true },
  new_items_printed: { label: "Printed new-items receipt", flag: false },
};

function timeOf(value: string): string {
  const d = parseServerDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

const TH = "py-2 pr-4";

interface Props {
  date: string;
  userId: number | null;
  onSelect: (id: number | null) => void;
}

export function AdminWaiterTrace({ date, userId, onSelect }: Props) {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState("");
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<StaffUser[]>("/users")
      .then(setStaff)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load staff"));
  }, []);

  useEffect(() => {
    if (userId === null || !date) {
      setTrace(null);
      return;
    }
    let stale = false;
    setLoading(true);
    setError("");
    api
      .get<TraceResult>(`/reports/waiter-trace?user_id=${userId}&date=${date}`)
      .then((r) => {
        if (!stale) setTrace(r);
      })
      .catch((err) => {
        if (!stale) {
          setTrace(null);
          setError(err instanceof Error ? err.message : "Failed to load waiter trace");
        }
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [userId, date]);

  const term = search.trim().toLowerCase();
  const matches = staff.filter(
    (s) => !term || s.name.toLowerCase().includes(term) || s.username.toLowerCase().includes(term)
  );

  return (
    <section className="bg-sarini-panel border border-black/30 rounded-xl p-5">
      <h3 className="text-white font-medium mb-1">Waiter Trace</h3>
      <p className="text-xs text-gray-500 mb-3">
        Search a staff member to see what they did on {date}. The list of actions is recorded from
        the day this version was installed; the totals are always complete.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a waiter..."
        className="w-full sm:w-72 rounded bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-white text-sm mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {matches.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id === userId ? null : s.id)}
            className={`py-1 px-3 rounded-md text-sm border ${
              s.id === userId
                ? "bg-sarini-yellow text-black border-sarini-yellow font-medium"
                : "border-gray-600 text-gray-300 hover:bg-sarini-panel-light"
            }`}
          >
            {s.name}
            {s.active ? "" : " (inactive)"}
          </button>
        ))}
        {matches.length === 0 && <span className="text-gray-500 text-sm">No staff match.</span>}
      </div>

      {error && <div className="text-sarini-rose text-sm mb-2">{error}</div>}
      {userId === null && <div className="text-gray-500 text-sm">Pick a name to see their day.</div>}
      {userId !== null && loading && <div className="text-gray-500 text-sm">Loading...</div>}

      {trace && !loading && (
        <div className="space-y-4">
          <div className="text-white font-medium">
            {trace.user.name} <span className="text-gray-500 text-sm">({trace.user.role})</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Orders opened</div>
              <div className="text-white font-semibold">{trace.summary.ordersOpened}</div>
            </div>
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Sales on their orders</div>
              <div className="text-sarini-yellow font-semibold">
                {formatMoney(trace.summary.salesAmount)}
              </div>
              <div className="text-xs text-gray-500">{trace.summary.salesOrders} paid</div>
            </div>
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Orders they settled</div>
              <div className="text-white font-semibold">
                {trace.summary.settledOrders} ({formatMoney(trace.summary.settledAmount)})
              </div>
            </div>
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Items they removed</div>
              <div className="text-sarini-terracotta font-semibold">
                {trace.summary.cancelledItems} ({formatMoney(trace.summary.cancelledAmount)})
              </div>
            </div>
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Orders they voided</div>
              <div className="text-sarini-rose font-semibold">{trace.summary.voids}</div>
            </div>
            <div className="rounded-md bg-sarini-panel-light p-3">
              <div className="text-xs text-gray-400">Actions recorded</div>
              <div className="text-white font-semibold">{trace.summary.actions}</div>
            </div>
          </div>

          {trace.itemsSold.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">Items sold on their orders</div>
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
                    {trace.itemsSold.map((i) => (
                      <tr key={i.name} className="border-b border-black/20">
                        <td className="py-2 pr-4 text-white">{i.name}</td>
                        <td className="py-2 pr-4 text-right text-gray-300">{i.quantity}</td>
                        <td className="py-2 text-right text-sarini-yellow">
                          {formatMoney(i.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="text-gray-400 text-xs mb-1">What they did, in order</div>
            {trace.timeline.length === 0 ? (
              <div className="text-gray-500 text-sm">
                No actions recorded for this person on this day.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-black/30">
                      <th className={TH}>Time</th>
                      <th className={TH}>Action</th>
                      <th className={TH}>Order</th>
                      <th className="py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.timeline.map((e) => {
                      const info = ACTIONS[e.action] ?? { label: e.action, flag: false };
                      return (
                        <tr key={e.id} className="border-b border-black/20">
                          <td className="py-2 pr-4 text-gray-400">{timeOf(e.created_at)}</td>
                          <td
                            className={`py-2 pr-4 ${
                              info.flag ? "text-sarini-rose font-medium" : "text-white"
                            }`}
                          >
                            {info.label}
                          </td>
                          <td className="py-2 pr-4 text-gray-300">
                            {e.order_id !== null ? `#${e.order_id}` : "-"}
                          </td>
                          <td className="py-2 text-gray-400">{e.detail ?? ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
