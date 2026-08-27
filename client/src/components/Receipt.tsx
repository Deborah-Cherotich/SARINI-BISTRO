import type { Order } from "../types";
import { formatMoney, formatServerDate } from "../format";
export function Receipt({ order }: { order: Order }) {
  return (
    <div
      id="printable"
      // Fixed, conservatively narrow width — chosen to fit inside the
      // printable area of even a small 58mm thermal roll, rather than
      // trusting Chrome/the print dialog to correctly detect the printer's
      // real page width (in practice it doesn't, and content sized as
      // "100%" of a wrongly-assumed wide page gets physically sliced by
      // the print head). Small font + tight spacing to match.
      // Extra-large left padding vs. right: this printer has a hardware
      // non-printable dead zone on the left edge of the roll (CSS @page
      // margins can't override that), which was slicing the first
      // character off every left-aligned line while the right edge
      // printed fine. Padding pushes text clear of that zone.
      className="bg-white text-black pl-4 pr-2 py-2 font-mono text-[11px] leading-snug w-[210px] max-w-full break-words"
    >
      <div className="flex justify-center mb-1">
        <div className="w-9 h-9 border-2 border-black rounded flex items-center justify-center">
          <span className="font-serif font-bold text-base leading-none">SB</span>
        </div>
      </div>
      <div className="text-center font-bold text-sm tracking-wide">SARINI BISTRO</div>
      <div className="text-center">Official Receipt</div>
      <div className="text-center mb-1">Tel: +254 741 435933</div>
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
          <span>{order.closed_at ? formatServerDate(order.closed_at) : new Date().toLocaleString()}</span>
        </div>
        {order.served_by_name && (
          <div className="flex justify-between">
            <span>Served by</span>
            <span>{order.served_by_name}</span>
          </div>
        )}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      {order.items.map((item) => (
        <div key={item.id} className="flex justify-between mb-0.5">
          <span>
            {item.name_snapshot} x{item.qty}
          </span>
          <span>{formatMoney(item.price_snapshot * item.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-1" />
      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatMoney(order.total)}</span>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center leading-tight">
        <div className="font-semibold">PRICES INC. OF VAT WHERE APPLICABLE</div>
        <div>KRA PIN: </div>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center">
        <div className="font-semibold mb-0.5">Pay via M-Pesa</div>
        <div className="flex justify-between">
          <span>Paybill</span>
          <span className="font-bold">542542</span>
        </div>
        <div className="flex justify-between">
          <span>Account No.</span>
          <span className="font-bold">31310</span>
        </div>
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center mt-1">
        <div className="font-semibold">Thank you for dining with us!</div>
        <div>We hope to see you again soon.</div>
      </div>
    </div>
  );
}
