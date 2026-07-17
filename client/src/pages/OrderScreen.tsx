import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { Category, Order } from "../types";
import { formatMoney } from "../format";
import { KitchenTicket } from "../components/KitchenTicket";
import { Receipt } from "../components/Receipt";
import { ItemThumb } from "../components/ItemThumb";
import { useAuth } from "../context/AuthContext";

export function OrderScreen() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<"kitchen" | "receipt" | null>(null);

  async function loadMenu() {
    const data = await api.get<Category[]>("/menu");
    setCategories(data);
    if (data.length > 0) setActiveCategory(data[0].id);
  }

  async function loadOrder() {
    const data = await api.get<Order>(`/orders/${orderId}`);
    setOrder(data);
  }

  useEffect(() => {
    loadMenu().catch((err) => setError(err.message));
    loadOrder().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function addItem(menuItemId: number) {
    if (!order) return;
    setError(null);
    const existing = order.items.find(
      (i) => i.menu_item_id === menuItemId && i.kitchen_status === "pending"
    );
    try {
      if (existing) {
        await api.patch(`/orders/${order.id}/items/${existing.id}`, { qty: existing.qty + 1 });
      } else {
        await api.post(`/orders/${order.id}/items`, { menu_item_id: menuItemId, qty: 1 });
      }
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function updateQty(itemId: number, qty: number) {
    if (!order) return;
    if (qty <= 0) return removeItem(itemId);
    try {
      await api.patch(`/orders/${order.id}/items/${itemId}`, { qty });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function removeItem(itemId: number) {
    if (!order) return;
    try {
      await api.patch(`/orders/${order.id}/items/${itemId}`, { remove: true });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  }

  async function editNote(itemId: number, currentNote: string | null) {
    if (!order) return;
    const note = window.prompt("Note for kitchen (e.g. no onions)", currentNote || "");
    if (note === null) return;
    try {
      await api.patch(`/orders/${order.id}/items/${itemId}`, { notes: note });
      await loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note");
    }
  }

  async function sendToKitchen() {
    if (!order || order.items.length === 0) return;
    try {
      await api.post(`/orders/${order.id}/send-to-kitchen`);
      await loadOrder();
      setPrintMode("kitchen");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send to kitchen");
    }
  }

  async function checkout() {
    if (!order) return;
    try {
      const updated = await api.post<Order>(`/orders/${order.id}/checkout`);
      setOrder(updated);
      setPrintMode("receipt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    }
  }

  async function voidOrder() {
    if (!order) return;
    if (!window.confirm("Void this order and free the table? This cannot be undone.")) return;
    try {
      await api.post(`/orders/${order.id}/void`);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void order");
    }
  }

  function closePrint() {
    setPrintMode(null);
    if (order?.status === "paid") navigate("/");
  }

  if (!order) {
    return <div className="text-gray-400">{error || "Loading order..."}</div>;
  }

  const activeItems = categories.find((c) => c.id === activeCategory)?.items || [];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-sarini-panel-light"
          >
            ← Tables
          </button>
          <h1 className="text-xl font-semibold text-white">
            {order.table ? order.table.label : `Takeaway #${order.id}`}
          </h1>
        </div>
        <div className="text-sm text-gray-400">Order #{order.id} · {order.status}</div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-sarini-yellow text-black font-medium"
                    : "bg-sarini-panel text-gray-300 hover:bg-sarini-panel-light"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-2">
            {activeItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item.id)}
                disabled={order.status !== "open"}
                className="text-left self-start bg-sarini-panel hover:bg-sarini-panel-light rounded-lg border border-black/30 disabled:opacity-50"
              >
                <ItemThumb
                  imagePath={item.image_path}
                  name={item.name}
                  className="w-full h-24 rounded-t-lg"
                />
                <div className="p-3">
                  <div className="text-sm font-medium text-white">{item.name}</div>
                  <div className="text-sarini-yellow text-sm mt-1">{formatMoney(item.price)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-96 flex flex-col bg-sarini-panel rounded-xl border border-black/30 min-h-0">
          <div className="p-4 border-b border-black/30 font-semibold text-white">
            Current Order
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {order.items.length === 0 && (
              <div className="text-gray-500 text-sm">No items yet. Tap a menu item to add.</div>
            )}
            {order.items.map((item) => (
              <div key={item.id} className="bg-sarini-panel-light rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="text-sm text-white font-medium">{item.name_snapshot}</div>
                  <div className="text-sarini-yellow text-sm">
                    {formatMoney(item.price_snapshot * item.qty)}
                  </div>
                </div>
                {item.notes && (
                  <div className="text-xs text-gray-400 italic mt-1">Note: {item.notes}</div>
                )}
                {item.kitchen_status === "sent" && (
                  <div className="text-[10px] uppercase tracking-wide text-sarini-sage mt-1">
                    Sent to kitchen
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      disabled={order.status !== "open"}
                      className="w-7 h-7 rounded bg-sarini-bg text-white disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="text-white text-sm w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      disabled={order.status !== "open"}
                      className="w-7 h-7 rounded bg-sarini-bg text-white disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => editNote(item.id, item.notes)}
                      disabled={order.status !== "open"}
                      className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
                    >
                      Note
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={order.status !== "open"}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-black/30 space-y-3">
            <div className="flex justify-between text-white font-semibold text-lg">
              <span>Total</span>
              <span>{formatMoney(order.total)}</span>
            </div>
            {order.status === "open" && (
              <div className="flex gap-2">
                <button
                  onClick={sendToKitchen}
                  disabled={order.items.length === 0}
                  className="flex-1 py-2.5 rounded-md border border-sarini-yellow text-sarini-yellow font-medium hover:bg-sarini-yellow/10 disabled:opacity-40"
                >
                  Send to Kitchen
                </button>
                <button
                  onClick={checkout}
                  disabled={order.items.length === 0}
                  className="flex-1 py-2.5 rounded-md bg-sarini-yellow text-black font-semibold hover:bg-sarini-yellow-dark disabled:opacity-40"
                >
                  Complete & Print Receipt
                </button>
              </div>
            )}
            {order.status === "open" && user?.role === "admin" && (
              <button
                onClick={voidOrder}
                className="w-full py-2 rounded-md text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30"
              >
                Void Order
              </button>
            )}
            {order.status === "paid" && (
              <button
                onClick={() => setPrintMode("receipt")}
                className="w-full py-2.5 rounded-md border border-gray-600 text-gray-200 hover:bg-sarini-panel-light"
              >
                Reprint Receipt
              </button>
            )}
          </div>
        </div>
      </div>

      {printMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-sarini-panel rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            {printMode === "kitchen" ? <KitchenTicket order={order} /> : <Receipt order={order} />}
            <div className="flex gap-2 mt-4">
              <button
                onClick={closePrint}
                className="flex-1 py-2.5 rounded-md border border-gray-600 text-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-md bg-sarini-yellow text-black font-semibold hover:bg-sarini-yellow-dark"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
