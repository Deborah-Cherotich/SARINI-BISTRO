import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../api";
import type { Category, MenuItemIngredient, StockItem, StockMovement } from "../../types";
import { formatServerDate } from "../../format";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      {children}
    </label>
  );
}

export function AdminStock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newQty, setNewQty] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; unit: string; low_stock_threshold: string }>({
    name: "",
    unit: "",
    low_stock_threshold: "",
  });

  const [openMovementsFor, setOpenMovementsFor] = useState<number | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [openRestockFor, setOpenRestockFor] = useState<number | null>(null);
  const [movementDrafts, setMovementDrafts] = useState<
    Record<number, { change: string; reason: "restock" | "adjustment"; note: string }>
  >({});

  const [dishQuery, setDishQuery] = useState("");
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

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setOpenRestockFor(null);
    setEditDraft({ name: item.name, unit: item.unit, low_stock_threshold: String(item.low_stock_threshold) });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    if (!editDraft.name.trim()) return;
    try {
      await api.put(`/stock/${id}`, {
        name: editDraft.name.trim(),
        unit: editDraft.unit.trim() || "pcs",
        low_stock_threshold: editDraft.low_stock_threshold ? Number(editDraft.low_stock_threshold) : 0,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stock item");
    }
  }

  async function deleteStockItem(id: number, force = false) {
    if (!force && !window.confirm("Delete this stock item?")) return;
    try {
      await api.delete(`/stock/${id}${force ? "?force=true" : ""}`);
      if (recipeMenuItemId) await loadRecipe(recipeMenuItemId as number);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete stock item";
      if (!force && message.startsWith("Still used by:")) {
        const dishes = message.replace("Still used by:", "").trim();
        if (window.confirm(`This stock item is linked to: ${dishes}.\n\nUnlink it from those dishes and delete it anyway?`)) {
          await deleteStockItem(id, true);
        }
        return;
      }
      setError(message);
    }
  }

  async function toggleMovements(id: number) {
    setOpenRestockFor(null);
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

  function toggleRestock(id: number) {
    setOpenMovementsFor(null);
    setOpenRestockFor((cur) => (cur === id ? null : id));
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
      setOpenRestockFor(null);
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

  async function unlinkIngredient(stockItemId: number) {
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
  const dishLabel = (mi: { categoryName: string; name: string }) => `${mi.categoryName} — ${mi.name}`;
  const selectedDishForHeading = allMenuItems.find((mi) => mi.id === recipeMenuItemId);
  const draftStockUnit = items.find((i) => i.id === Number(recipeDraft.stock_item_id))?.unit;

  function handleDishQueryChange(value: string) {
    setDishQuery(value);
    const match = allMenuItems.find((mi) => dishLabel(mi) === value);
    if (match) {
      loadRecipe(match.id);
    } else if (!value) {
      setRecipeMenuItemId("");
      setRecipe([]);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-white text-lg font-semibold mb-1">Stock / Inventory</h2>
        <p className="text-sm text-gray-400">
          Track raw supplies here (sausages, chicken, drinks, etc). Link a supply to a dish further down and
          it will deduct on its own every time that dish is sold — no extra work at the till.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white shrink-0">
            ✕
          </button>
        </div>
      )}

      <section className="bg-sarini-panel border-2 border-sarini-yellow/40 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sarini-yellow text-black text-xs font-bold">
            1
          </span>
          Add a New Stock Item
        </h3>
        <p className="text-xs text-gray-500 mb-3 ml-7">
          A raw supply you want to track — e.g. Sausages, Chicken, Cooking Gas.
        </p>
        <div className="flex flex-wrap gap-3 ml-7">
          <Field label="Name">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sausages"
              className="w-44 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
            />
          </Field>
          <Field label="Unit">
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="pcs, kg, litres..."
              className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
            />
          </Field>
          <Field label="Opening quantity">
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="0"
              className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
            />
          </Field>
          <Field label="Warn me when at/below">
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder="0"
              className="w-36 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
            />
          </Field>
          <div className="flex items-end">
            <button
              onClick={addStockItem}
              className="px-4 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
            >
              + Add Stock Item
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sarini-panel-light text-gray-300 text-xs font-bold">
            2
          </span>
          Current Stock Levels
        </h3>
        <p className="text-xs text-gray-500 mb-3 ml-7">
          What you have on hand right now. Use "Restock" when new supplies arrive.
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-sarini-panel border border-black/30 rounded-xl p-3">
              {editingId === item.id ? (
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Name">
                    <input
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-40 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      value={editDraft.unit}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, unit: e.target.value }))}
                      className="w-24 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                    />
                  </Field>
                  <Field label="Warn me when at/below">
                    <input
                      type="number"
                      value={editDraft.low_stock_threshold}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, low_stock_threshold: e.target.value }))}
                      className="w-36 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                    />
                  </Field>
                  <button
                    onClick={() => saveEdit(item.id)}
                    className="px-3 py-1.5 rounded-md bg-sarini-sage-bg text-sarini-sage text-sm font-medium hover:brightness-110"
                  >
                    Save
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-white pb-1.5">
                    Cancel
                  </button>
                </div>
              ) : (
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
                      onClick={() => toggleRestock(item.id)}
                      className="text-xs px-2 py-1 rounded bg-sarini-sage-bg text-sarini-sage hover:brightness-110"
                    >
                      {openRestockFor === item.id ? "Close" : "Restock / Adjust"}
                    </button>
                    <button
                      onClick={() => toggleMovements(item.id)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      {openMovementsFor === item.id ? "Hide history" : "History"}
                    </button>
                    <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-white">
                      Edit
                    </button>
                    <button
                      onClick={() => deleteStockItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {openRestockFor === item.id && (
                <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-black/20">
                  <Field label="Type">
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
                      <option value="restock">Restock (new delivery, always adds)</option>
                      <option value="adjustment">Adjustment (correction, breakage/spoilage — can be negative)</option>
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      value={draftFor(item.id).change}
                      onChange={(e) =>
                        setMovementDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item.id), change: e.target.value } }))
                      }
                      placeholder="0"
                      className="w-24 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                    />
                  </Field>
                  <Field label="Note (optional)">
                    <input
                      value={draftFor(item.id).note}
                      onChange={(e) =>
                        setMovementDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item.id), note: e.target.value } }))
                      }
                      placeholder="e.g. Delivery from supplier"
                      className="w-56 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                    />
                  </Field>
                  <button
                    onClick={() => submitMovement(item.id)}
                    className="px-3 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
                  >
                    Apply
                  </button>
                </div>
              )}

              {openMovementsFor === item.id && (
                <div className="mt-3 pt-3 border-t border-black/20 overflow-x-auto">
                  <p className="text-xs text-gray-500 mb-2">
                    Every change to this item: restocks, sales (with order #), and corrections.
                  </p>
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
                          <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">{formatServerDate(m.created_at)}</td>
                          <td className="py-1 pr-3 text-gray-300 capitalize whitespace-nowrap">
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
                          <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">{m.created_by_name ?? "—"}</td>
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
            <div className="text-gray-500 text-sm ml-7">No stock items yet. Add one above.</div>
          )}
        </div>
      </section>

      <section className="bg-sarini-panel border border-black/30 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sarini-panel-light text-gray-300 text-xs font-bold">
            3
          </span>
          Link Stock to a Dish (Recipe)
        </h3>
        <p className="text-xs text-gray-500 mb-3 ml-7">
          Tell the system which stock a dish uses, and how much per sale — e.g. "Mixed Grill uses 2
          Sausages." Once linked, that stock deducts automatically every time the dish is sold. Dishes with
          nothing linked here are never deducted.
        </p>
        <div className="ml-7">
          <Field label="Search for a dish">
            <input
              list="admin-stock-dish-options"
              value={dishQuery}
              onChange={(e) => handleDishQueryChange(e.target.value)}
              placeholder="Start typing a dish name..."
              className="w-full max-w-sm rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
            />
          </Field>
          <datalist id="admin-stock-dish-options">
            {allMenuItems.map((mi) => (
              <option key={mi.id} value={dishLabel(mi)} />
            ))}
          </datalist>
        </div>

        {!recipeMenuItemId && (
          <div className="ml-7 mt-3 text-sm text-gray-500 italic">
            Pick a dish above to see and edit what stock it uses.
          </div>
        )}

        {recipeMenuItemId && (
          <div className="mt-3 ml-7 bg-sarini-panel-light/40 border border-black/20 rounded-lg p-3">
            <h4 className="text-white text-sm font-semibold mb-2">
              Recipe for <span className="text-sarini-yellow">{dishLabel(selectedDishForHeading!)}</span>
            </h4>

            {recipe.length > 0 ? (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="pb-1 pr-3 font-medium">Stock item</th>
                    <th className="pb-1 pr-3 font-medium">Used per order</th>
                    <th className="pb-1 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.map((ing) => (
                    <tr key={ing.stock_item_id} className="border-t border-black/20">
                      <td className="py-2 pr-3 text-white">{ing.stock_item_name}</td>
                      <td className="py-2 pr-3 text-gray-300">
                        {ing.qty_per_unit} {ing.stock_item_unit}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => unlinkIngredient(ing.stock_item_id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Unlink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-gray-500 text-sm mb-3">
                Nothing linked yet — this dish won't deduct any stock when it's sold.
              </div>
            )}

            <div className="pt-3 border-t border-black/20">
              <p className="text-xs text-gray-500 mb-2">Link another stock item to this dish:</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Stock item">
                  <select
                    value={recipeDraft.stock_item_id}
                    onChange={(e) => setRecipeDraft((prev) => ({ ...prev, stock_item_id: e.target.value }))}
                    className="w-48 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                  >
                    <option value="">Select...</option>
                    {items
                      .filter((i) => !recipe.some((r) => r.stock_item_id === i.id))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field
                  label={
                    draftStockUnit ? `How many ${draftStockUnit} per order?` : "Quantity used per order"
                  }
                >
                  <input
                    type="number"
                    value={recipeDraft.qty_per_unit}
                    onChange={(e) => setRecipeDraft((prev) => ({ ...prev, qty_per_unit: e.target.value }))}
                    placeholder="e.g. 2"
                    className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-2 py-1.5 text-sm text-white"
                  />
                </Field>
                <button
                  onClick={addIngredientToRecipe}
                  disabled={!recipeDraft.stock_item_id || !recipeDraft.qty_per_unit}
                  title={
                    !recipeDraft.stock_item_id
                      ? "Pick a stock item first"
                      : !recipeDraft.qty_per_unit
                        ? "Enter a quantity per sale"
                        : undefined
                  }
                  className="px-3 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sarini-yellow"
                >
                  + Link
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Example: if the Mixed Grill uses 2 sausages per order, pick "Sausages" and enter{" "}
                <span className="text-gray-300">2</span>. Every time this dish is sold, 2 sausages get
                deducted from stock automatically.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
