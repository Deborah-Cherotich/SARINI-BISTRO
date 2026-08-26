import type { Order, OrderItem } from "../types";
import { formatMoney, formatServerDate } from "../format";

export function NewItemsReceipt({ order, newItems }: { order: Order; newItems: OrderItem[] }) {
  const newItemsTotal = newItems.reduce((sum, i) => sum + i.price_snapshot * i.qty, 0);

  return (
    <div
      id="printable"
      // See Receipt.tsx for why this is a fixed narrow width rather than
      // 100% — keeps this safely inside a small thermal printer's
      // printable area regardless of what page size Chrome assumes. Extra
      // left padding clears the printer's left-edge non-printable zone.
      className="bg-white text-black pl-4 pr-2 py-2 font-mono text-[11px] leading-snug w-[210px] max-w-full break-words"
    >
      <div className="text-center font-bold text-sm tracking-wide">SARINI BISTRO</div>
      <div className="text-center font-bold">NEW ITEMS ADDED</div>
      <div className="text-center mb-1">(after order was paid)</div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Order #</span>
          <span>{order.id}</span>
        </div>
        <div className="flex justify-between">
          <span>{order.table ? "Table" : "Type"}</span>
          <span>{order.table ? order.table.label : "Takeaway"}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      {newItems.map((item) => (
        <div key={item.id} className="flex justify-between mb-0.5">
          <span>
            {item.name_snapshot} x{item.qty}
          </span>
          <span>{formatMoney(item.price_snapshot * item.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-1" />
      <div className="flex justify-between font-bold text-sm">
        <span>NEW ITEMS TOTAL</span>
        <span>{formatMoney(newItemsTotal)}</span>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="flex justify-between text-[10px]">
        <span>Order grand total (ref.)</span>
        <span>{formatMoney(order.total)}</span>
      </div>
      {order.closed_at && (
        <div className="flex justify-between text-[10px]">
          <span>Originally paid</span>
          <span>{formatServerDate(order.closed_at)}</span>
        </div>
      )}
    </div>
  );
}
