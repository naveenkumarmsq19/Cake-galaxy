import PDFDocument from "pdfkit";
import { money } from "@cake-galaxy/catalog";

export function invoiceConfigured() {
  return !!(process.env.MERCHANT_LEGAL_NAME && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(process.env.MERCHANT_GSTIN || "") && process.env.GST_RATE_PERCENT !== undefined && Number.isFinite(Number(process.env.GST_RATE_PERCENT)));
}

export function issueInvoice(order, response) {
  const merchant = process.env.MERCHANT_LEGAL_NAME;
  const gstin = process.env.MERCHANT_GSTIN;
  if (!invoiceConfigured()) return false;
  const pdf = new PDFDocument({ size: "A4", margin: 48 });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", 'attachment; filename="Cake-Galaxy-' + order.reference + '.pdf"');
  pdf.pipe(response);
  pdf.fontSize(24).text("Cake Galaxy", { align: "left" });
  pdf.moveDown(.4).fontSize(10).text(merchant).text("GSTIN " + gstin);
  pdf.moveDown().fontSize(16).text("Tax invoice");
  pdf.fontSize(10).text("Invoice reference: " + order.reference).text("Date: " + new Date(order.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }));
  pdf.moveDown().text("Bill to: " + (order.gst?.business || order.sender?.name || order.address.name));
  if (order.gst?.gstin) pdf.text("Customer GSTIN: " + order.gst.gstin);
  pdf.text(order.gst?.billingAddress || [order.address.line1, order.address.line2, order.address.city, order.address.pincode].filter(Boolean).join(", "));
  pdf.moveDown().text("Items").moveDown(.5);
  for (const item of order.items) pdf.text(item.quantity + " × " + item.name + " (" + item.size + " " + (item.unit || "kg") + ") — " + money(item.lineTotal));
  pdf.moveDown().text("Items subtotal: " + money(order.subtotal)).text("Delivery: " + money(order.deliveryFee)).text("GST: " + money(order.tax));
  pdf.moveDown().fontSize(13).text("Total paid: " + money(order.amount));
  pdf.end();
  return true;
}
