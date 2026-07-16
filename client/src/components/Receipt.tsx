import type { Order } from "../types";
import { formatMoney } from "../format";

export function Receipt({ order }: { order: Order }) {
  return (
    <div id="printable" className="bg-white text-black p-4 font-mono text-sm w-[80mm]">
      <div className="text-center font-bold text-base">SARINI BISTRO</div>
      <div className="text-center text-xs mb-2">Official Receipt</div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-xs">
        <div>Order #{order.id}</div>
        <div>{order.table ? order.table.label : "Takeaway"}</div>
        <div>{order.closed_at || new Date().toLocaleString()}</div>
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
      {order.payment_method && (
        <div className="flex justify-between text-xs mt-1">
          <span>Payment</span>
          <span className="uppercase">{order.payment_method}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-xs mt-2">Thank you for dining with us!</div>
    </div>
  );
}
