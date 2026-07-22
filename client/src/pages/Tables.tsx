import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { RestaurantTable } from "../types";

export function Tables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<RestaurantTable[]>("/tables");
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openTable(table: RestaurantTable) {
    if (table.open_order_id) {
      navigate(`/order/${table.open_order_id}`);
      return;
    }
    try {
      const order = await api.post<{ id: number }>("/orders", { table_id: table.id });
      navigate(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open table");
    }
  }

  async function startTakeaway() {
    try {
      const order = await api.post<{ id: number }>("/orders", { order_type: "takeaway" });
      navigate(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start takeaway order");
    }
  }

  async function deleteTable(e: React.MouseEvent, table: RestaurantTable) {
    e.stopPropagation();
    if (!window.confirm(`Remove ${table.label}? This can't be undone.`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove table");
    }
  }

  if (loading) return <div className="text-gray-400">Loading tables...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Tables</h1>
        <button
          onClick={startTakeaway}
          className="px-4 py-2 rounded-md bg-sarini-yellow text-black font-medium hover:bg-sarini-yellow-dark"
        >
          + New Takeaway Order
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="relative">
            <button
              onClick={() => openTable(table)}
              className={`w-full rounded-xl p-5 text-left border transition-colors ${
                table.status === "free"
                  ? "bg-sarini-panel border-sarini-sage-border hover:border-sarini-sage"
                  : "bg-sarini-terracotta-bg border-sarini-terracotta-border hover:border-sarini-terracotta"
              }`}
            >
              <div className="text-lg font-semibold text-sarini-cream pr-6">{table.label}</div>
              <div className="text-sm text-gray-400 mt-1">{table.seats} seats</div>
              <div
                className={`mt-3 inline-block text-xs font-medium px-2 py-1 rounded ${
                  table.status === "free"
                    ? "bg-sarini-sage-bg text-sarini-sage"
                    : "bg-sarini-terracotta-bg text-sarini-terracotta"
                }`}
              >
                {table.status === "free" ? "Free" : "Occupied"}
              </div>
            </button>
            {table.status === "free" && (
              <button
                onClick={(e) => deleteTable(e, table)}
                aria-label={`Remove ${table.label}`}
                title="Remove this table (e.g. added by mistake)"
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-red-950/40"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path
                    d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
