import { razorpayConfigured } from "./providers.js";
import { invoiceConfigured } from "./invoice.js";

// Logs/checks contain ONLY boolean readiness signals, never secret values.
// This is the single source of truth used by checkout and boot diagnostics.
export function paymentReadiness() {
  const checks = {
    razorpay_credentials: razorpayConfigured(),
    razorpay_webhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    merchant_legal_name: Boolean(process.env.MERCHANT_LEGAL_NAME?.trim()),
    receipt_or_tax_invoice_configuration: invoiceConfigured(),
    catalogue_approved: process.env.CATALOG_APPROVED === "true",
    policies_approved: process.env.POLICIES_APPROVED === "true"
  };
  return {
    ready: Object.values(checks).every(Boolean),
    missing: Object.entries(checks).filter(([, enabled]) => !enabled).map(([key]) => key)
  };
}
