import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import type { RestaurantTable } from "../../types";

export function AdminTables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState("4");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSeats, setEditSeats] = useState("");
  const navigate = useNavigate();

  async function load() {
    try {
      const data = await api.get<RestaurantTable[]>("/tables");
      setTables(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addTable() {
    if (!label.trim()) return;
    setError(null);
    try {
      await api.post("/tables", { label: label.trim(), seats: Number(seats) || 4 });
      setLabel("");
      setSeats("4");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add table");
    }
  }

  async function removeTable(t: RestaurantTable) {
    if (!window.confirm(`Delete ${t.label}? This can't be undone.`)) return;
    setError(null);
    try {
      await api.delete(`/tables/${t.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete table");
    }
  }

  function startEdit(t: RestaurantTable) {
    setError(null);
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditSeats(String(t.seats));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(t: RestaurantTable) {
    if (!editLabel.trim()) return;
    setError(null);
    try {
      await api.put(`/tables/${t.id}`, {
        label: editLabel.trim(),
        seats: Number(editSeats) || t.seats,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update table");
    }
  }

  // Same as the main Tables screen's quick action — voids the table's open
  // order so a table that's been abandoned (or opened by mistake) doesn't
  // stay stuck "occupied" forever. Admin gets it here too, plus a way to
  // actually look at the order first before deciding.
  async function freeTable(t: RestaurantTable) {
    if (!t.open_order_id) return;
    if (
      !window.confirm(`Free ${t.label}? This cancels its current order and marks the table free again.`)
    ) {
      return;
    }
    setError(null);
    try {
      await api.post(`/orders/${t.open_order_id}/void`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to free table");
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex gap-2 mb-6">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Table label (e.g. Table 11)"
          className="rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <input
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          type="number"
          placeholder="Seats"
          className="w-24 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <button
          onClick={addTable}
          className="px-4 py-2 rounded-md bg-sarini-yellow text-black font-medium hover:bg-sarini-yellow-dark"
        >
          + Add Table
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tables.map((t) =>
          editingId === t.id ? (
            <div
              key={t.id}
              className="bg-sarini-panel border border-sarini-yellow/50 rounded-lg p-3 space-y-2"
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
                  onClick={() => saveEdit(t)}
                  className="flex-1 py-1.5 rounded-md bg-sarini-yellow text-black text-xs font-medium hover:bg-sarini-yellow-dark"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex-1 py-1.5 rounded-md border border-gray-600 text-gray-300 text-xs hover:bg-sarini-panel-light"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="bg-sarini-panel border border-black/30 rounded-lg p-3">
              <div className="text-white font-medium">{t.label}</div>
              <div className="text-xs text-gray-400 mb-2">{t.seats} seats</div>
              <div
                className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mb-2 ${
                  t.status === "free"
                    ? "bg-sarini-sage-bg text-sarini-sage"
                    : "bg-sarini-terracotta-bg text-sarini-terracotta"
                }`}
              >
                {t.status}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <button
                  onClick={() => startEdit(t)}
                  className="text-xs text-gray-300 hover:text-white"
                >
                  Edit
                </button>
                {t.status === "occupied" && t.open_order_id && (
                  <>
                    <button
                      onClick={() => navigate(`/order/${t.open_order_id}`)}
                      className="text-xs text-sarini-yellow hover:text-sarini-yellow-dark"
                    >
                      View order
                    </button>
                    <button
                      onClick={() => freeTable(t)}
                      className="text-xs text-sarini-sage hover:text-emerald-300"
                    >
                      Free table
                    </button>
                  </>
                )}
                {t.status === "free" && (
                  <button
                    onClick={() => removeTable(t)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
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
