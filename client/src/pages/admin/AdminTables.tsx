import { useEffect, useState } from "react";
import { api } from "../../api";
import type { RestaurantTable } from "../../types";

export function AdminTables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState("4");

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
    try {
      await api.post("/tables", { label: label.trim(), seats: Number(seats) || 4 });
      setLabel("");
      setSeats("4");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add table");
    }
  }

  async function removeTable(id: number) {
    if (!window.confirm("Delete this table?")) return;
    try {
      await api.delete(`/tables/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete table");
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
        {tables.map((t) => (
          <div key={t.id} className="bg-sarini-panel border border-black/30 rounded-lg p-3">
            <div className="text-white font-medium">{t.label}</div>
            <div className="text-xs text-gray-400 mb-2">
              {t.seats} seats · {t.status}
            </div>
            <button
              onClick={() => removeTable(t.id)}
              disabled={t.status === "occupied"}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
