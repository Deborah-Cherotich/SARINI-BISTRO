import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Category, MenuItemIngredient, StockItem, StockMovement } from "../../types";
import { formatServerDate } from "../../format";

export function AdminStock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newQty, setNewQty] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const [openMovementsFor, setOpenMovementsFor] = useState<number | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementDrafts, setMovementDrafts] = useState<
    Record<number, { change: string; reason: "restock" | "adjustment"; note: string }>
  >({});

  const [recipeMenuItemId, setRecipeMenuItemId] = useState<number | "">("");
  const [recipe, setRecipe] = useState<MenuItemIngredient[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<{ stock_item_id: string; qty_per_unit: string }>({
    stock_item_id: "",
    qty_per_unit: "",
  });

  async function load() {
    try {
      const [stock, menu] = await Promise.all([
        api.get<StockItem[]>("/stock"),
        api.get<Category[]>("/menu"),
      ]);
      setItems(stock);
      setCategories(menu);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addStockItem() {
    if (!newName.trim()) return;
    try {
      await api.post("/stock", {
        name: newName.trim(),
        unit: newUnit.trim() || "pcs",
        quantity: newQty ? Number(newQty) : 0,
        low_stock_threshold: newThreshold ? Number(newThreshold) : 0,
      });
      setNewName("");
      setNewUnit("pcs");
      setNewQty("");
      setNewThreshold("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stock item");
    }
  }

  async function deleteStockItem(id: number) {
    if (!window.confirm("Delete this stock item? It must not be used in any dish's recipe.")) return;
    try {
      await api.delete(`/stock/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete stock item");
    }
  }

  async function toggleMovements(id: number) {
    if (openMovementsFor === id) {
      setOpenMovementsFor(null);
      return;
    }
    try {
      const data = await api.get<StockMovement[]>(`/stock/${id}/movements`);
      setMovements(data);
      setOpenMovementsFor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock history");
    }
  }

  function draftFor(id: number) {
    return movementDrafts[id] || { change: "", reason: "restock" as const, note: "" };
  }

  async function submitMovement(id: number) {
    const draft = draftFor(id);
    const change = Number(draft.change);
    if (!change) return;
    try {
      await api.post(`/stock/${id}/movements`, {
        change: draft.reason === "restock" ? Math.abs(change) : change,
        reason: draft.reason,
        note: draft.note.trim() || null,
      });
      setMovementDrafts((prev) => ({ ...prev, [id]: { change: "", reason: "restock", note: "" } }));
      await load();
      if (openMovementsFor === id) await toggleMovementsRefresh(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record stock movement");
    }
  }

  async function toggleMovementsRefresh(id: number) {
    const data = await api.get<StockMovement[]>(`/stock/${id}/movements`);
    setMovements(data);
  }

  async function loadRecipe(menuItemId: number) {
    setRecipeMenuItemId(menuItemId);
    try {
      const data = await api.get<MenuItemIngredient[]>(`/stock/menu-items/${menuItemId}/ingredients`);
      setRecipe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe");
    }
  }

  async function addIngredientToRecipe() {
    if (!recipeMenuItemId || !recipeDraft.stock_item_id || !recipeDraft.qty_per_unit) return;
    const next = [
      ...recipe.filter((r) => r.stock_item_id !== Number(recipeDraft.stock_item_id)),
      {
        id: 0,
        stock_item_id: Number(recipeDraft.stock_item_id),
        qty_per_unit: Number(recipeDraft.qty_per_unit),
        stock_item_name: items.find((i) => i.id === Number(recipeDraft.stock_item_id))?.name ?? "",
        stock_item_unit: items.find((i) => i.id === Number(recipeDraft.stock_item_id))?.unit ?? "",
      },
    ];
    await saveRecipe(next);
    setRecipeDraft({ stock_item_id: "", qty_per_unit: "" });
  }

  async function removeIngredient(stockItemId: number) {
    await saveRecipe(recipe.filter((r) => r.stock_item_id !== stockItemId));
  }

  async function saveRecipe(next: MenuItemIngredient[]) {
    if (!recipeMenuItemId) return;
    try {
      const data = await api.put<MenuItemIngredient[]>(`/stock/menu-items/${recipeMenuItemId}/ingredients`, {
        ingredients: next.map((r) => ({ stock_item_id: r.stock_item_id, qty_per_unit: r.qty_per_unit })),
      });
      setRecipe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    }
  }

  const allMenuItems = categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name })));

  return (
    <div className="space-y-8">
      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <section className="bg-sarini-panel border border-black/30 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Add Stock Item</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Sausages)"
            className="flex-1 min-w-[160px] rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
          />
          <input
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="Unit (pcs, kg...)"
            className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
          />
          <input
            type="number"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            placeholder="Opening qty"
            className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
          />
          <input
            type="number"
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            placeholder="Low-stock alert at"
            className="w-32 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
          />
          <button
            onClick={addStockItem}
            className="px-4 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
          >
            + Add
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-3">Stock Levels</h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-sarini-panel border border-black/30 rounded-xl p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{item.name}</span>
                  {item.low && (
                    <span className="text-xs px-2 py-0.5 rounded bg-sarini-rose-bg text-sarini-rose">
                      Low stock
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-sarini-yellow font-semibold">
                    {item.quantity} {item.unit}
                  </span>
                  <button
                    onClick={() => toggleMovements(item.id)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    {openMovementsFor === item.id ? "Hide history" : "History"}
                  </button>
                  <button
                    onClick={() => deleteStockItem(item.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-black/20">
                <select
                  value={draftFor(item.id).reason}
                  onChange={(e) =>
                    setMovementDrafts((prev) => ({
                      ...prev,
                      [item.id]: { ...draftFor(item.id), reason: e.target.value as "restock" | "adjustment" },
                    }))
                  }
                  className="rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                >
                  <option value="restock">Restock (+)</option>
                  <option value="adjustment">Adjustment (+/-)</option>
                </select>
                <input
                  type="number"
                  value={draftFor(item.id).change}
                  onChange={(e) =>
                    setMovementDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item.id), change: e.target.value } }))
                  }
                  placeholder="Amount"
                  className="w-24 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                />
                <input
                  value={draftFor(item.id).note}
                  onChange={(e) =>
                    setMovementDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item.id), note: e.target.value } }))
                  }
                  placeholder="Note (optional)"
                  className="flex-1 min-w-[120px] rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                />
                <button
                  onClick={() => submitMovement(item.id)}
                  className="px-3 py-1.5 rounded-md bg-sarini-sage-bg text-sarini-sage text-sm font-medium hover:brightness-110"
                >
                  Apply
                </button>
              </div>

              {openMovementsFor === item.id && (
                <div className="mt-3 pt-3 border-t border-black/20">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-1 pr-3">Date</th>
                        <th className="pb-1 pr-3">Reason</th>
                        <th className="pb-1 pr-3 text-right">Change</th>
                        <th className="pb-1 pr-3">By</th>
                        <th className="pb-1">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-t border-black/20">
                          <td className="py-1 pr-3 text-gray-400">{formatServerDate(m.created_at)}</td>
                          <td className="py-1 pr-3 text-gray-300 capitalize">
                            {m.reason}
                            {m.order_id && ` (order #${m.order_id})`}
                          </td>
                          <td
                            className={`py-1 pr-3 text-right font-medium ${
                              m.change >= 0 ? "text-sarini-sage" : "text-sarini-rose"
                            }`}
                          >
                            {m.change >= 0 ? "+" : ""}
                            {m.change}
                          </td>
                          <td className="py-1 pr-3 text-gray-400">{m.created_by_name ?? "—"}</td>
                          <td className="py-1 text-gray-400">{m.note ?? "—"}</td>
                        </tr>
                      ))}
                      {movements.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-2 text-center text-gray-500">
                            No stock movements yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-gray-500 text-sm">No stock items yet. Add one above.</div>
          )}
        </div>
      </section>

      <section className="bg-sarini-panel border border-black/30 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Dish Recipes</h3>
        <p className="text-xs text-gray-500 mb-3">
          Link a dish to the stock it uses, so stock deducts automatically when it's sold. Dishes with no
          recipe here are never deducted.
        </p>
        <select
          value={recipeMenuItemId}
          onChange={(e) => (e.target.value ? loadRecipe(Number(e.target.value)) : setRecipeMenuItemId(""))}
          className="w-full max-w-sm rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white mb-3"
        >
          <option value="">Select a dish...</option>
          {allMenuItems.map((mi) => (
            <option key={mi.id} value={mi.id}>
              {mi.categoryName} — {mi.name}
            </option>
          ))}
        </select>

        {recipeMenuItemId && (
          <div className="space-y-2">
            {recipe.map((ing) => (
              <div
                key={ing.stock_item_id}
                className="flex items-center justify-between bg-sarini-panel-light rounded-md px-3 py-2 text-sm"
              >
                <span className="text-white">{ing.stock_item_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">
                    {ing.qty_per_unit} {ing.stock_item_unit} per sale
                  </span>
                  <button
                    onClick={() => removeIngredient(ing.stock_item_id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {recipe.length === 0 && (
              <div className="text-gray-500 text-sm">No stock linked to this dish yet.</div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <select
                value={recipeDraft.stock_item_id}
                onChange={(e) => setRecipeDraft((prev) => ({ ...prev, stock_item_id: e.target.value }))}
                className="flex-1 min-w-[140px] rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
              >
                <option value="">Select stock item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={recipeDraft.qty_per_unit}
                onChange={(e) => setRecipeDraft((prev) => ({ ...prev, qty_per_unit: e.target.value }))}
                placeholder="Qty per sale"
                className="w-32 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
              />
              <button
                onClick={addIngredientToRecipe}
                className="px-3 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
              >
                + Link
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
