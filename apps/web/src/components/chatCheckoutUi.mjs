/** Presentation-only checkout helpers. All payment availability and totals remain backend-validated. */
export const checkoutPaymentDescriptions = Object.freeze({
  cod: "Pay when your order is delivered",
  online: "UPI or card through secure Razorpay checkout",
  test_cod: "Test checkout only — no payment will be collected",
});

export function checkoutSubmitState({busy,accepted,methods,method}) {
  if (busy) return {disabled:true,label:"Processing your order…"};
  if (!Array.isArray(methods) || !methods.length) return {disabled:true,label:"Payment options unavailable"};
  if (!methods.some(option=>option.id===method)) return {disabled:true,label:"Select a payment method"};
  if (!accepted) return {disabled:true,label:"Accept terms to continue"};
  if (method==="online") return {disabled:false,label:"Proceed to secure payment"};
  if (method==="test_cod") return {disabled:false,label:"Place test order"};
  return {disabled:false,label:"Confirm & place COD order"};
}
