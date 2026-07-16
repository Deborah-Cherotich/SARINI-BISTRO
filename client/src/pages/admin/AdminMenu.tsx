import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Category, MenuItem } from "../../types";
import { formatMoney } from "../../format";
import { ItemThumb } from "../../components/ItemThumb";

export function AdminMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<number, { name: string; price: string }>>({});

  async function load() {
    try {
      const data = await api.get<Category[]>("/menu");
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    try {
      await api.post("/menu/categories", { name: newCategoryName.trim() });
      setNewCategoryName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function deleteCategory(id: number) {
    if (!window.confirm("Delete this category? It must have no items.")) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  async function addItem(categoryId: number) {
    const draft = itemDrafts[categoryId];
    if (!draft?.name.trim() || !draft?.price) return;
    try {
      await api.post("/menu/items", {
        category_id: categoryId,
        name: draft.name.trim(),
        price: Number(draft.price),
      });
      setItemDrafts((prev) => ({ ...prev, [categoryId]: { name: "", price: "" } }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function updatePrice(itemId: number, price: number) {
    try {
      await api.put(`/menu/items/${itemId}`, { price });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update price");
    }
  }

  async function deleteItem(itemId: number) {
    if (!window.confirm("Remove this item from the menu?")) return;
    try {
      await api.delete(`/menu/items/${itemId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  async function uploadImage(item: MenuItem, file: File) {
    try {
      const formData = new FormData();
      formData.append("image", file);
      await api.upload(`/menu/items/${item.id}/image`, formData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
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
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name"
          className="flex-1 max-w-xs rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-2 text-white"
        />
        <button
          onClick={addCategory}
          className="px-4 py-2 rounded-md bg-sarini-yellow text-black font-medium hover:bg-sarini-yellow-dark"
        >
          + Add Category
        </button>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-sarini-panel border border-black/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{cat.name}</h3>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete category
              </button>
            </div>
            <div className="space-y-2 mb-3">
              {cat.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-sarini-panel-light rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemThumb
                      imagePath={item.image_path}
                      name={item.name}
                      className="w-10 h-10 rounded-md shrink-0"
                    />
                    <span className="text-sm text-white truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="text-xs text-gray-400 hover:text-white cursor-pointer">
                      {item.image_path ? "Change photo" : "Add photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(item, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <input
                      type="number"
                      defaultValue={item.price}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== item.price) updatePrice(item.id, val);
                      }}
                      className="w-24 text-right rounded bg-sarini-bg border border-gray-700 px-2 py-1 text-sarini-yellow text-sm"
                    />
                    <span className="text-xs text-gray-500">{formatMoney(item.price)}</span>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder="Item name"
                value={itemDrafts[cat.id]?.name || ""}
                onChange={(e) =>
                  setItemDrafts((prev) => ({
                    ...prev,
                    [cat.id]: { name: e.target.value, price: prev[cat.id]?.price || "" },
                  }))
                }
                className="flex-1 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
              />
              <input
                placeholder="Price"
                type="number"
                value={itemDrafts[cat.id]?.price || ""}
                onChange={(e) =>
                  setItemDrafts((prev) => ({
                    ...prev,
                    [cat.id]: { name: prev[cat.id]?.name || "", price: e.target.value },
                  }))
                }
                className="w-28 rounded-md bg-sarini-panel-light border border-gray-700 px-3 py-1.5 text-sm text-white"
              />
              <button
                onClick={() => addItem(cat.id)}
                className="px-3 py-1.5 rounded-md bg-sarini-yellow text-black text-sm font-medium hover:bg-sarini-yellow-dark"
              >
                Add item
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
