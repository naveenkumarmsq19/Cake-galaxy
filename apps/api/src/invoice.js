import PDFDocument from "pdfkit";
import { money } from "@cake-galaxy/catalog";

// Non-GST merchants can issue a normal payment receipt, never a GST tax invoice.
// Keep legacy behavior for existing GST-registered stores until explicitly opted out.
export const merchantGstRegistered = () => process.env.MERCHANT_GST_REGISTERED !== "false";

export function invoiceConfigured() {
  const name = process.env.MERCHANT_LEGAL_NAME?.trim();
  const tax = Number(process.env.GST_RATE_PERCENT);
  if (!name || process.env.GST_RATE_PERCENT === undefined || !Number.isFinite(tax) || tax < 0 || tax > 30) return false;
  if (!merchantGstRegistered()) {
    // Fail closed: prevent taxes or a made-up GSTIN being quietly published.
    return !process.env.MERCHANT_GSTIN?.trim() && tax === 0;
  }
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(process.env.MERCHANT_GSTIN || "");
}

export function issueInvoice(order, response) {
  const merchant = process.env.MERCHANT_LEGAL_NAME;
  const gstin = process.env.MERCHANT_GSTIN;
  const registered = merchantGstRegistered();
  if (!invoiceConfigured()) return false;
  const pdf = new PDFDocument({ size: "A4", margin: 48 });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", 'attachment; filename="Cake-Galaxy-' + order.reference + '.pdf"');
  pdf.pipe(response);
  pdf.fontSize(24).text("Cake Galaxy", { align: "left" });
  pdf.moveDown(.4).fontSize(10).text(merchant);
  if (registered) pdf.text("GSTIN " + gstin);
  pdf.moveDown().fontSize(16).text(registered ? "Tax invoice" : "Payment receipt");
  pdf.fontSize(10).text((registered ? "Invoice" : "Receipt") + " reference: " + order.reference).text("Date: " + new Date(order.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }));
  pdf.moveDown().text("Bill to: " + (order.gst?.business || order.sender?.name || order.address.name));
  if (registered && order.gst?.gstin) pdf.text("Customer GSTIN: " + order.gst.gstin);
  pdf.text(order.gst?.billingAddress || [order.address.line1, order.address.line2, order.address.city, order.address.pincode].filter(Boolean).join(", "));
  pdf.moveDown().text("Items").moveDown(.5);
  for (const item of order.items) {
    const label = item.quantity + " × " + item.name + " (" + item.size + " " + (item.unit || "kg") + ")";
    pdf.text(label + " — " + money(item.lineTotal));
    if (item.discountPerUnit > 0) pdf.text("   10% cake discount: -" + money(item.discountPerUnit * item.quantity));
  }
  const listSubtotal = order.items.reduce((sum, item) => sum + (item.originalUnitPrice ?? item.unitPrice) * item.quantity, 0);
  pdf.moveDown().text("Items list price: " + money(listSubtotal));
  pdf.text("Items subtotal after discount: " + money(order.subtotal)).text("Delivery: " + money(order.deliveryFee));
  if (registered) pdf.text("GST: " + money(order.tax));
  else pdf.text("GST not charged: seller is not GST-registered.");
  pdf.moveDown().fontSize(13).text("Total paid: " + money(order.amount));
  pdf.end();
  return true;
}
