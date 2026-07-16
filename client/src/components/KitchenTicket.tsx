import type { Order } from "../types";

export function KitchenTicket({ order }: { order: Order }) {
  return (
    <div id="printable" className="bg-white text-black p-4 font-mono text-sm w-[80mm]">
      <div className="text-center font-bold text-base mb-1">KITCHEN TICKET</div>
      <div className="text-center mb-2">
        {order.table ? order.table.label : `Takeaway #${order.id}`}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between text-xs mb-2">
        <span>Order #{order.id}</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      {order.items.map((item) => (
        <div key={item.id} className="mb-2">
          <div className="flex justify-between font-semibold">
            <span>{item.name_snapshot}</span>
            <span>x{item.qty}</span>
          </div>
          {item.notes && <div className="text-xs italic">Note: {item.notes}</div>}
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-xs">-- End of ticket --</div>
    </div>
  );
}
