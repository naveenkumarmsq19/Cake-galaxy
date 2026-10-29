"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { money } from "@cake-galaxy/catalog";
import PhoneVerification from "./PhoneVerification";
import { useStore } from "./Storefront";
import { addCalendarDays, availableDeliverySlots, firstAvailableDate, indiaNow, isBookableDate } from "./deliverySchedule";
import { calculateChatTotal, makeChatOrderPayload, makeConfirmedChatReceipt, methodsAvailable, phoneValid, pinValid, validateChatCart, validateChatDetails } from "./chatCheckout.mjs";
import styles from "./ChatOrderFlow.module.css";
import { checkoutPaymentDescriptions, checkoutSubmitState } from "./chatCheckoutUi.mjs";

const initialAddress={name:"",phone:"",line1:"",line2:"",city:"Bengaluru",whatsapp:false};

async function loadRazorpay(){
 if(typeof window==="undefined")throw Error("Online checkout is unavailable.");
 if(window.Razorpay)return;
 await new Promise((resolve,reject)=>{
   const script=document.createElement("script");
   script.src="https://checkout.razorpay.com/v1/checkout.js";
   script.onload=()=>window.Razorpay?resolve():reject(Error("Secure payment could not be loaded."));
   script.onerror=()=>reject(Error("Secure payment could not be loaded. Please retry."));
   document.head.appendChild(script);
 });
}

async function takePayment({config,data,sender}){
 if(!window.Razorpay)throw Error("Online payment is unavailable.");
 return new Promise((resolve,reject)=>{
   const payment=new window.Razorpay({
     key:config.keyId,order_id:data.orderId,amount:data.amount,currency:"INR",name:"Cake Galaxy",
     description:"Cake order "+data.reference,
     prefill:{name:sender.name,contact:"+91"+sender.phone},
     theme:{color:"#738874"},
     modal:{ondismiss:()=>reject(Error("Payment window closed. Please check My Orders before retrying."))},
     handler:resolve
   });
   payment.on("payment.failed",()=>reject(Error("Payment was not completed. Please check My Orders.")));
   payment.open();
 });
}

/** A self-contained checkout wizard inside the existing chatbot: no separate pages. */
export default function ChatOrderFlow({onClose,onOrderPlaced}){
 const {cart,catalog,session,api,checkDelivery,clearCart,setReceipt,saveCheckoutDetails,pincode:storedPin,hydrated}=useStore();
 const [step,setStep]=useState("pincode");
 const [pin,setPin]=useState(storedPin||"");
 const [deliveryQuote,setDeliveryQuote]=useState(null);
 const [delivery,setDelivery]=useState({date:"",slot:""});
 const [phone,setPhone]=useState(session.phone||"");
 const [senderName,setSenderName]=useState("");
 const [recipient,setRecipient]=useState(initialAddress);
 const [config,setConfig]=useState(null);
 const [method,setMethod]=useState("");
 const [accepted,setAccepted]=useState(false);
 const [confirmedTotal,setConfirmedTotal]=useState(null);
 const [confirmedOrder,setConfirmedOrder]=useState(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const attempt=useRef(null);
 const flowRef=useRef(null);
 const today=indiaNow().date;
 const slots=delivery.date?availableDeliverySlots(delivery.date):[];
 const methods=methodsAvailable(config);
 const submitState=checkoutSubmitState({busy,accepted,methods,method});
 const sender={name:senderName.trim(),phone};
 const address={...recipient,pincode:pin};
 const stepNumber={pincode:1,delivery:2,verify:3,address:4,review:5,complete:5}[step];
 const busyGuard=(fn)=>async(event)=>{
   event?.preventDefault?.();
   if(busy)return;
   setError("");setBusy(true);
   try{await fn(event);}catch(e){setError(e?.message||"Please try again.");}
   finally{setBusy(false);}
 };
 useEffect(()=>{
   if(step==="verify"&&session.authenticated&&session.phone===phone&&phoneValid(phone))setStep("address");
 },[step,session.authenticated,session.phone,phone]);
 useEffect(()=>{
   if(flowRef.current)flowRef.current.scrollTop=0;
 },[step]);

 const verifyPincode=busyGuard(async()=>{
   if(!pinValid(pin))throw Error("Please enter a valid six-digit delivery pincode.");
   validateChatCart(cart,catalog);
   const result=await checkDelivery(pin);
   if(result.available!==true)throw Error(result.available===false?"Delivery is not currently available for this pincode.":"We could not verify delivery to this pincode. Please try again.");
   if(!Number.isSafeInteger(result.deliveryFee)||result.deliveryFee<0)throw Error("Delivery charges could not be verified.");
   setDeliveryQuote(result);
   setStep("delivery");
 });
 const chooseDelivery=busyGuard(async()=>{
   if(!isBookableDate(delivery.date)||!availableDeliverySlots(delivery.date).includes(delivery.slot))throw Error("Please choose a future delivery date and an available time slot.");
   const recent=await checkDelivery(pin);
   if(recent.available!==true)throw Error("Delivery availability needs to be checked again.");
   setDeliveryQuote(recent);
   setStep("verify");
 });
 const saveAddress=busyGuard(async(event)=>{
   const fields=new FormData(event.currentTarget);
   const nextSender=String(fields.get("senderName")||"").trim();
   const nextAddress={
     name:String(fields.get("name")||"").trim(),
     phone:String(fields.get("phone")||"").trim(),
     line1:String(fields.get("line1")||"").trim(),
     line2:String(fields.get("line2")||"").trim(),
     city:String(fields.get("city")||"").trim(),
     pincode:pin,
     whatsapp:fields.get("whatsapp")==="on"
   };
   if(!session.authenticated||session.phone!==phone)throw Error("Please verify your phone number again.");
   validateChatDetails({sender:{name:nextSender,phone},address:nextAddress,delivery,pincode:pin});
   validateChatCart(cart,catalog);
   const fresh=await checkDelivery(pin);
   if(fresh.available!==true)throw Error("Delivery is not available for this pincode.");
   const paymentConfig=await api("/checkout/config");
   const available=methodsAvailable(paymentConfig);
   if(!available.length)throw Error("Checkout is not enabled at the moment. No order has been placed.");
   const quote=calculateChatTotal({cart,catalog,deliveryFee:fresh.deliveryFee,taxRate:paymentConfig.taxRate});
   setSenderName(nextSender);
   setRecipient(nextAddress);
   setDeliveryQuote(fresh);
   setConfig(paymentConfig);
   setMethod(available[0].id);
   setConfirmedTotal(quote);
   setAccepted(false);
   setStep("review");
 });
 function finishConfirmedOrder(order,expectedReference){
   // Only return to chat after the existing backend confirms a COD order
   // or securely verifies an online payment. No AI output can create a receipt.
   const receipt=makeConfirmedChatReceipt({
     order, expectedReference, expectedMethod:method,
     expectedAmount:confirmedTotal.total, cart, catalog, address, delivery
   });
   setReceipt(order);
   setConfirmedOrder(order);
   attempt.current=null;
   clearCart();
   if(onOrderPlaced)onOrderPlaced(receipt);
   else setStep("complete");
 }
 const placeOrder=busyGuard(async()=>{
   if(!accepted)throw Error("Please review and accept the terms and cancellation policy.");
   if(!session.authenticated||session.phone!==phone)throw Error("Please verify your phone number again.");
   if(!methods.some(x=>x.id===method))throw Error("Please choose an available payment method.");
   validateChatDetails({sender,address,delivery,pincode:pin});
   validateChatCart(cart,catalog);
   const freshConfig=await api("/checkout/config");
   if(!methodsAvailable(freshConfig).some(x=>x.id===method))throw Error("Your selected payment method is no longer available.");
   const freshDelivery=await checkDelivery(pin);
   if(freshDelivery.available!==true)throw Error("Delivery could not be confirmed. No order has been submitted.");
   const freshTotal=calculateChatTotal({cart,catalog,deliveryFee:freshDelivery.deliveryFee,taxRate:freshConfig.taxRate});
   if(freshTotal.total!==confirmedTotal?.total)throw Error("The total has changed. Please review your updated order before confirming.");
   if(method==="online")await loadRazorpay();
   const fingerprint=JSON.stringify({cart,sender,address,delivery,method});
   if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
   const idempotencyKey=attempt.current.key;
   const payload=makeChatOrderPayload({cart,sender,address,delivery,method,idempotencyKey});
   saveCheckoutDetails({sender,address,delivery});
   // From this point, a server order can exist even when a later network/payment step fails.
   let data;
   try{
     data=await api("/checkout/orders",{method:"POST",body:payload});
   }catch(e){
     if(e.status===409||e.serviceUnavailable)throw Error("Your order submission status is uncertain. Check My Orders before trying again.");
     throw e;
   }
   if(!data.reference||!Number.isSafeInteger(data.amount)||data.amount!==freshTotal.total){
     throw Error("The server order total differs from the reviewed amount. Do not pay; check My Orders or contact support.");
   }
   if(method==="cod"||method==="test_cod"){
     const expected=method==="cod"?"cod_pending":"test_cod";
     if(data.status!=="confirmed"||data.order?.paymentStatus!==expected){
       throw Error("Order status could not be confirmed. Check My Orders before trying again.");
     }
     if(data.order.reference!==data.reference)throw Error("Order reference could not be verified. Check My Orders.");
     finishConfirmedOrder(data.order,data.reference);
     return;
   }
   if(!data.orderId||!freshConfig.keyId)throw Error("Payment could not be prepared. Check My Orders before trying again.");
   const payment=await takePayment({config:freshConfig,data,sender});
   const verified=await api("/checkout/verify",{method:"POST",body:{reference:data.reference,...payment}});
   if(verified.status!=="paid"||!verified.order)throw Error("Payment confirmation is pending. Please check My Orders.");
   if(verified.order.reference!==data.reference)throw Error("Payment order reference could not be verified. Check My Orders.");
   finishConfirmedOrder(verified.order,data.reference);
 });

 return <div className={styles.root} ref={flowRef} role="region" aria-label="Order through chat">
   <div className={styles.top}><strong>Order through Chat</strong><button type="button" onClick={onClose} disabled={busy} aria-label="Return to chat">×</button></div>
   <div className={styles.progress}>Step {stepNumber} of 5 — {step==="complete"?"Order result":step==="verify"?"Phone verification":step==="review"?"Order review":step==="pincode"?"Delivery area":step==="delivery"?"Date and time":"Recipient details"}</div>
   {!hydrated&&<p>Preparing your bag…</p>}
   {hydrated&&step!=="complete"&&<div className={styles.summary}><strong>Your bag</strong>{cart.length?cart.map(item=>{
     const product=catalog.find(p=>p.id===item.productId);
     return <span key={item.id}>{product?.name||"Cake"} · {item.size} {product?.unit==="kg"?"kg":product?.unit||""} × {item.quantity}</span>;
   }):<span>Your bag is empty. Return to chat to select a cake.</span>}</div>}
   {step==="pincode"&&<section>
     <p className={styles.bot}>Let’s arrange your cake delivery. First, what is your six-digit delivery pincode?</p>
     <form className={styles.form} onSubmit={verifyPincode}>
       <label>Delivery pincode<input type="text" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>
       <button type="submit" disabled={busy||!cart.length}>Check availability</button>
     </form>
   </section>}
   {step==="delivery"&&<section>
     <p className={styles.bot}>Delivery is available for {pin}. Please choose a delivery date and time. Times are in India Standard Time.</p>
     <form className={styles.form} onSubmit={chooseDelivery}>
       <label>Delivery date<input type="date" required min={firstAvailableDate()} max={addCalendarDays(today,31)} value={delivery.date} onChange={e=>setDelivery({date:e.target.value,slot:""})}/></label>
       <label>Delivery time<select required value={delivery.slot} onChange={e=>setDelivery(d=>({...d,slot:e.target.value}))}>
         <option value="">Select an available slot</option>
         {slots.map(slot=><option key={slot} value={slot}>{slot}</option>)}
       </select></label>
       <button type="submit" disabled={busy||!delivery.date||!delivery.slot}>Continue to phone verification</button>
     </form>
   </section>}
   {step==="verify"&&<section>
     <p className={styles.bot}>To protect your order, please verify your mobile number. Enter the OTP only in the verification field below—not as a chat message.</p>
     <div className={styles.phone}><PhoneVerification phone={phone} onPhoneChange={setPhone} onVerified={()=>setStep("address")}/></div>
     {session.authenticated&&session.phone===phone&&<button className={styles.secondaryButton} type="button" onClick={()=>setStep("address")}>Continue as verified customer</button>}
   </section>}
   {step==="address"&&<section>
     <p className={styles.bot}>Your number is verified. Please provide the sender and recipient details for this delivery.</p>
     <form className={styles.form} onSubmit={saveAddress}>
       <label>Your name<input name="senderName" maxLength={80} required defaultValue={senderName} autoComplete="name"/></label>
       <label>Recipient name<input name="name" maxLength={80} required defaultValue={recipient.name}/></label>
       <label>Recipient phone<input name="phone" inputMode="numeric" type="tel" pattern="[6-9][0-9]{9}" maxLength={10} required defaultValue={recipient.phone}/></label>
       <label>House / flat and street<input name="line1" maxLength={160} required defaultValue={recipient.line1}/></label>
       <label>Area / landmark (optional)<input name="line2" maxLength={160} defaultValue={recipient.line2}/></label>
       <label>City<input name="city" maxLength={60} required defaultValue={recipient.city}/></label>
       <label className={styles.checkbox}><input type="checkbox" name="whatsapp" defaultChecked={recipient.whatsapp}/> Receive optional order updates on WhatsApp</label>
       <p className={styles.small}>Delivery pincode: {pin}. You can edit it by returning to the previous step.</p>
       <button type="submit" disabled={busy}>Review your order</button>
     </form>
   </section>}
   {step==="review"&&<section>
     <p className={styles.bot}>Please review the order details and total before placing your order.</p>
     <div className={styles.review}>
       <p><strong>Customer:</strong> {sender.name} · Verified phone ending {phone.slice(-4)}</p>
       <p><strong>Recipient:</strong> {address.name} · Phone ending {address.phone.slice(-4)}</p>
       <p><strong>Address:</strong> {address.line1}, {address.line2?address.line2+", ":""}{address.city} {pin}</p>
       <p><strong>Delivery:</strong> {delivery.date} · {delivery.slot}</p>
       <p><strong>Cakes:</strong> {money(confirmedTotal?.subtotal||0)}</p>
       <p><strong>Delivery:</strong> {money(confirmedTotal?.deliveryFee||0)}</p>
       <p><strong>Tax:</strong> {money(confirmedTotal?.tax||0)}</p>
       <p className={styles.total}><strong>Total payable:</strong> <strong>{money(confirmedTotal?.total||0)}</strong></p>
     </div>
     <fieldset className={styles.methods}>
       <legend>Payment method</legend>
       <div className={styles.paymentList}>
         {methods.map(option=><label
           key={option.id}
           className={styles.paymentOption}
           data-selected={method===option.id}
         >
           <input
             className={styles.paymentRadio}
             type="radio"
             name="chatPayment"
             value={option.id}
             checked={method===option.id}
             onChange={()=>setMethod(option.id)}
           />
           <span className={styles.paymentDescription}>
             <strong>{option.label}</strong>
             <small>{checkoutPaymentDescriptions[option.id]}</small>
           </span>
         </label>)}
       </div>
       {!methods.length && <p className={styles.paymentUnavailable}>Payment options are temporarily unavailable. No order has been placed.</p>}
     </fieldset>
     <div className={styles.termsCard}>
       <input
         className={styles.termsCheckbox}
         id="nc-chat-order-terms"
         type="checkbox"
         checked={accepted}
         onChange={e=>setAccepted(e.target.checked)}
       />
       <div className={styles.termsBody}>
         <label htmlFor="nc-chat-order-terms">I agree to the terms and cancellation policy.</label>
         <div className={styles.policyLinks}>
           <Link href="/policy?type=terms" target="_blank" rel="noopener noreferrer">View terms</Link>
           <Link href="/policy?type=refund" target="_blank" rel="noopener noreferrer">Cancellation policy</Link>
         </div>
       </div>
     </div>
     <button className={styles.orderButton} type="button" aria-busy={busy} disabled={submitState.disabled} onClick={placeOrder}>{submitState.label}</button>
     <p className={styles.small}>Your order is submitted only after you confirm. Online payments use secure Razorpay checkout.</p>
   </section>}
   {step==="complete"&&<section>
     <p className={styles.success}>Your order has been confirmed.</p>
     <div className={styles.review}>
       <p><strong>Order:</strong> {confirmedOrder?.reference}</p>
       <p><strong>Total:</strong> {money(confirmedOrder?.amount||0)}</p>
       <p><strong>Status:</strong> {confirmedOrder?.statusLabel||confirmedOrder?.status}</p>
       {confirmedOrder?.testOrder&&<p>This is a test order. No payment was collected.</p>}
     </div>
     <Link className={styles.linkButton} href="/orders" onClick={onClose}>View My Orders</Link>
     <button className={styles.secondaryButton} type="button" onClick={onClose}>Return to chat</button>
   </section>}
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {busy&&<p className={styles.small} role="status">Checking with Cake Galaxy…</p>}
   {step!=="complete"&&step!=="pincode"&&<div className={styles.back}><button type="button" disabled={busy} onClick={()=>{
     setError("");attempt.current=null;setAccepted(false);
     setStep(step==="delivery"?"pincode":step==="verify"?"delivery":step==="address"?"verify":"address");
   }}>Back</button><button type="button" disabled={busy} onClick={onClose}>Cancel order flow</button></div>}
 </div>;
}
