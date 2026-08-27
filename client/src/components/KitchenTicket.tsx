import type { Order, OrderItem } from "../types";
import { formatMoney } from "../format";

export function KitchenTicket({
  order,
  items,
  servedByName,
}: {
  order: Order;
  items?: OrderItem[];
  servedByName?: string | null;
}) {
  const showItems = items ?? order.items;
  const isNew = order.status === "paid";

  return (
    <div
      id="printable"
      // See Receipt.tsx for why this is a fixed narrow width rather than
      // 100% — keeps this safely inside a small thermal printer's
      // printable area regardless of what page size Chrome assumes. Extra
      // left padding clears the printer's left-edge non-printable zone.
      className="bg-white text-black pl-4 pr-2 py-2 font-mono text-[11px] leading-snug w-[210px] max-w-full break-words"
    >
      <div className="text-center font-bold text-sm mb-0.5">
        {isNew ? "NEW ITEMS - KITCHEN" : "KITCHEN TICKET"}
      </div>
      <div className="text-center text-[10px] mb-0.5">
        {isNew ? "(added after order was paid)" : ""}
      </div>
      <div className="text-center font-bold mb-1">
        {order.table ? `TABLE: ${order.table.label}` : `TAKEAWAY #${order.id}`}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="flex justify-between mb-1">
        <span>Order #{order.id}</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      {servedByName && (
        <div className="flex justify-between mb-1">
          <span>Served by</span>
          <span>{servedByName}</span>
        </div>
      )}
      {order.created_by_name && (
        <div className="flex justify-between mb-1">
          <span>Started by</span>
          <span>{order.created_by_name}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black my-1" />
      {showItems.map((item) => (
        <div key={item.id} className="mb-1">
          <div className="flex justify-between font-semibold">
            <span>{item.name_snapshot}</span>
            <span>x{item.qty}</span>
          </div>
          <div className="flex justify-end text-[10px]">
            <span>{formatMoney(item.price_snapshot * item.qty)}</span>
          </div>
          {item.notes && <div className="italic">Note: {item.notes}</div>}
        </div>
      ))}
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center">-- End of ticket --</div>
    </div>
  );
}
