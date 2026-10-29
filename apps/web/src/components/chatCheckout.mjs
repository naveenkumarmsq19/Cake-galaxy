import { availableDeliverySlots, isBookableDate } from "./deliverySchedule.js";
import { unitPrice } from "@cake-galaxy/catalog";

export const phoneValid=(phone)=>/^[6-9][0-9]{9}$/.test(String(phone||""));
export const pinValid=(pin)=>/^[1-9][0-9]{5}$/.test(String(pin||""));
export const methodsAvailable=(config)=>[
  ...(config?.codEnabled?[{id:"cod",label:"Cash on Delivery"}]:[]),
  ...(config?.paymentsEnabled?[{id:"online",label:"Online payment (UPI / card)"}]:[]),
  ...(config?.testCodEnabled?[{id:"test_cod",label:"Test order — no payment collected"}]:[])
];
export function validateChatCart(cart,catalog){
 if(!Array.isArray(cart)||!cart.length||cart.length>30)throw Error("Please add at least one cake to your bag.");
 for(const item of cart){
   const product=(catalog||[]).find(x=>x.id===item.productId);
   if(!product || !product.weights?.includes(Number(item.size)) || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>20)throw Error("One of your cakes is no longer available. Please review your bag.");
   if(item.eggless && !product.eggless)throw Error(product.name+" is not available eggless. Please edit your bag.");
   if(product.photo&&!item.uploadId)throw Error("Please upload a photo before ordering "+product.name+".");
   if(!Number.isSafeInteger(unitPrice(item,product))||unitPrice(item,product)<=0)throw Error("A cake price could not be confirmed. Please review your bag.");
 }
 return true;
}
export function validateChatDetails({sender,address,delivery,pincode,now=new Date()}){
 if(!phoneValid(sender?.phone)||!String(sender?.name||"").trim()||sender.name.length>80)throw Error("Enter a valid sender name and verified phone number.");
 if(!pinValid(pincode)||address?.pincode!==pincode)throw Error("Confirm the delivery pincode before continuing.");
 if(!String(address?.name||"").trim()||address.name.length>80||!phoneValid(address?.phone))throw Error("Enter a valid recipient name and phone number.");
 if(!String(address?.line1||"").trim()||address.line1.length>160||String(address?.line2||"").length>160||!String(address?.city||"").trim()||address.city.length>60)throw Error("Enter a valid delivery address.");
 if(!isBookableDate(delivery?.date,now)||!availableDeliverySlots(delivery.date,now).includes(delivery.slot))throw Error("Choose an available future delivery date and time.");
 return true;
}
export function calculateChatTotal({cart,catalog,deliveryFee,taxRate}){
 validateChatCart(cart,catalog);
 if(!Number.isSafeInteger(deliveryFee)||deliveryFee<0)throw Error("Delivery charges could not be confirmed.");
 if(typeof taxRate!=="number"||!Number.isFinite(taxRate)||taxRate<0||taxRate>30)throw Error("Checkout tax configuration could not be confirmed.");
 const subtotal=cart.reduce((sum,item)=>sum+unitPrice(item,catalog.find(p=>p.id===item.productId))*item.quantity,0);
 if(!Number.isSafeInteger(subtotal)||subtotal<=0)throw Error("Cake prices could not be confirmed.");
 const tax=Math.round(subtotal*taxRate/100);
 return {subtotal,deliveryFee,tax,total:subtotal+deliveryFee+tax};
}
export function makeChatOrderPayload({cart,sender,address,delivery,method,idempotencyKey}){
 if(!["cod","online","test_cod"].includes(method))throw Error("Choose an available payment method.");
 if(!/^[0-9a-f-]{36}$/i.test(idempotencyKey))throw Error("Invalid order attempt. Please retry.");
 return {items:cart.map(({productId,size,quantity,flavour,eggless,message,addons,uploadId})=>({productId,size,quantity,flavour,eggless,message,addons,uploadId})),sender,address,delivery,preferredMethod:method,gst:null,idempotencyKey};
}
