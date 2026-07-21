import type { Order } from "../types";
import { formatMoney, formatServerDate } from "../format";

export function Receipt({ order }: { order: Order }) {
  return (
    <div id="printable" className="bg-white text-black p-4 font-mono text-sm w-[80mm]">
      <div className="flex justify-center mb-2">
        <div className="w-12 h-12 border-2 border-black rounded-md flex items-center justify-center">
          <span className="font-serif font-bold text-xl leading-none">SB</span>
        </div>
      </div>
      <div className="text-center font-bold text-base tracking-wide">SARINI BISTRO</div>
      <div className="text-center text-xs">Official Receipt</div>
      <div className="text-center text-xs mb-2">Tel: +254 741 435933</div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-xs space-y-0.5">
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
          <span>{order.closed_at ? formatServerDate(order.closed_at) : new Date().toLocaleString()}</span>
        </div>
        {order.served_by_name && (
          <div className="flex justify-between">
            <span>Served by</span>
            <span>{order.served_by_name}</span>
          </div>
        )}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      {order.items.map((item) => (
        <div key={item.id} className="flex justify-between mb-1">
          <span>
            {item.name_snapshot} x{item.qty}
          </span>
          <span>{formatMoney(item.price_snapshot * item.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between font-bold text-base">
        <span>TOTAL</span>
        <span>{formatMoney(order.total)}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-xs mt-2">
        <div className="font-semibold">Thank you for dining with us!</div>
        <div className="mt-1">We hope to see you again soon.</div>
      </div>
    </div>
  );
}
