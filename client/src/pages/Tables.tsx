import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { RestaurantTable } from "../types";

export function Tables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSeats, setEditSeats] = useState("");
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

  function startEdit(e: React.MouseEvent, table: RestaurantTable) {
    e.stopPropagation();
    setError(null);
    setEditingId(table.id);
    setEditLabel(table.label);
    setEditSeats(String(table.seats));
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
  }

  async function saveEdit(e: React.MouseEvent, table: RestaurantTable) {
    e.stopPropagation();
    if (!editLabel.trim()) return;
    try {
      await api.put(`/tables/${table.id}`, { label: editLabel.trim(), seats: Number(editSeats) || table.seats });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update table");
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
        {tables.map((table) =>
          editingId === table.id ? (
            <div
              key={table.id}
              className="rounded-xl p-4 border border-sarini-yellow/50 bg-sarini-panel space-y-2"
            >
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Table label"
                className="w-full rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                autoFocus
              />
              <input
                value={editSeats}
                onChange={(e) => setEditSeats(e.target.value)}
                type="number"
                placeholder="Seats"
                className="w-full rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => saveEdit(e, table)}
                  className="flex-1 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex-1 py-1.5 rounded-md border border-gray-600 text-gray-300 text-sm hover:bg-sarini-panel-light"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={table.id} className="relative">
              <button
                onClick={() => openTable(table)}
                className={`w-full rounded-xl p-5 text-left border transition-colors ${
                  table.status === "free"
                    ? "bg-sarini-panel border-sarini-sage-border hover:border-sarini-sage"
                    : "bg-sarini-terracotta-bg border-sarini-terracotta-border hover:border-sarini-terracotta"
                }`}
              >
                <div className="text-lg font-semibold text-sarini-cream pr-12">{table.label}</div>
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
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <button
                  onClick={(e) => startEdit(e, table)}
                  aria-label={`Edit ${table.label}`}
                  title="Edit table name/seats"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-sarini-yellow hover:bg-sarini-yellow/10"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path
                      d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {table.status === "free" && (
                  <button
                    onClick={(e) => deleteTable(e, table)}
                    aria-label={`Remove ${table.label}`}
                    title="Remove this table (e.g. added by mistake)"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-red-950/40"
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
            </div>
          )
        )}
      </div>
    </div>
  );
}
