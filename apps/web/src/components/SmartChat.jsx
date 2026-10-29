"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "./Storefront";
import { browsableCategories, localAnswer, parseOptions, productReply, productsInCategory } from "./salesAssistant.mjs";
import { CategoryPicker, CakeFlatList } from "./ChatCakeBrowser";
import { scrollChatToBottom } from "./chatScroll.mjs";
import styles from "./SmartChat.module.css";
import ChatOrderFlow from "./ChatOrderFlow";

const greeting={who:"bot",text:"Welcome to Cake Galaxy! I can help you find the perfect cake, browse our collection, and place your order. Not sure what to choose? Tap Browse Cakes to explore categories and photos."};
const limited=(items)=>items.slice(-28);

function OrderReceipt({receipt}){
 return <section className={styles.orderReceipt} aria-label={"Confirmed order "+receipt.reference}>
   <strong className={styles.receiptTitle}>Order Confirmed</strong>
   <div className={styles.receiptRow}><span>Order ID</span><strong>{receipt.reference}</strong></div>
   <div className={styles.receiptProducts}>
     <strong>Cakes</strong>
     {receipt.items.map((item,index)=><p key={index}>{item.name} · {item.size} {item.unit} × {item.quantity}{item.eggless?" · Eggless":""}</p>)}
   </div>
   <div className={styles.receiptRow}><span>Delivery</span><strong>{receipt.deliveryLabel}</strong></div>
   <div className={styles.receiptRow}><span>Recipient</span><strong>{receipt.recipient}</strong></div>
   <div className={styles.receiptAddress}><span>Delivery address</span><p>{receipt.deliveryAddress}</p></div>
   <div className={styles.receiptRow}><span>Payment</span><strong>{receipt.paymentLabel}</strong></div>
   <div className={styles.receiptRow}><span>Status</span><strong>{receipt.status}</strong></div>
   <div className={styles.receiptTotal}><span>Order total</span><strong>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(receipt.total/100)}</strong></div>
   {receipt.testOrder&&<p className={styles.receiptNote}>Test order — no payment collected.</p>}
   <Link className={styles.actionLink} href="/orders">View My Orders</Link>
 </section>;
}



export default function SmartChat(){
 const {catalog,categories,catalogLoaded,checkDelivery,addItem,hydrated,cart}=useStore();
 const [ordering,setOrdering]=useState(false);
 const [open,setOpen]=useState(false);
 const [messages,setMessages]=useState([greeting]);
 const [input,setInput]=useState("");
 const [working,setWorking]=useState(false);
 const [selected,setSelected]=useState(null);
 const pendingOptions=useRef({});
 const confirmedReferences=useRef(new Set());
 const chatFeedRef=useRef(null);
 // Reveal the newest conversation message after React updates the feed.
 useLayoutEffect(()=>{
   if(!open)return;
   const feed=chatFeedRef.current;
   if(!feed)return;
   scrollChatToBottom(feed);
   const frame=requestAnimationFrame(()=>scrollChatToBottom(feed));
   return ()=>cancelAnimationFrame(frame);
 },[open,messages,working,ordering]);
 const append=(...items)=>setMessages(prev=>limited([...prev,...items]));
 const remember=(result)=>{
   if(result?.productId) setSelected(prev=>({productId:result.productId,size:result.item?.size??prev?.size??null,eggless:result.item?.eggless??prev?.eggless??false}));
   append({who:"bot",...result});
 };
 async function send(raw){
   const message=String(raw||"").trim();
   if(!message||working||!hydrated)return;
   setInput("");setWorking(true);
   append({who:"user",text:message});
   try {
     if(/^\d{6}$/.test(message)){
       const delivery=await checkDelivery(message);
       remember(delivery.available===true?
         {text:"Great! Delivery is available for this pincode. Please select your date and available time slot in the bag.",link:"/cart"}:
         {text:delivery.available===false?"Sorry, delivery is not available to that pincode at present.":"Delivery availability could not be confirmed. Please check again before ordering.",askPincode:true});
       return;
     }
     if(!catalogLoaded){remember({text:"The product catalogue is still loading. Please try again shortly."});return;}
     // Safe deterministic path works even without a free AI binding or available quota.
     let understood=message;
     try {
       const response=await fetch("/api/assistant",{
         method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message}),
         cache:"no-store",signal:AbortSignal.timeout(3500)
       });
       if(response.ok){const data=await response.json();if(data?.available&&typeof data.english==="string"&&data.english.length<=500)understood=data.english;}
     }catch{/* Offline / free-tier quota fallback. */}
     const answer=localAnswer(understood,catalog,selected,categories);
     pendingOptions.current=parseOptions(understood);
     remember(answer);
   }catch{remember({text:"I could not verify that information right now. Please try again or use the regular checkout."});}
   finally{setWorking(false);}
 }
 function browseCakes(){
   if(!catalogLoaded){remember({text:"Our cake catalogue is still loading. Please try again."});return;}
   pendingOptions.current={};
   remember({text:"Please select a cake category to explore available cake designs.",browseCategories:browsableCategories(catalog,categories)});
 }
 function chooseCategory(name){
   if(!browsableCategories(catalog,categories).some(c=>c.name===name))return;
   const cakes=productsInCategory(catalog,name);
   pendingOptions.current={};
   append({who:"user",text:"Show me "+name+" cakes"});
   remember(cakes.length?{text:"Here are the available "+name+" cakes. Select a cake to choose the size and continue your order.",categoryProducts:cakes}:{text:"No cakes are currently available in this category. Please choose another.",browseCategories:browsableCategories(catalog,categories)});
 }
 function chooseProduct(id){
   const product=catalog.find(p=>p.id===id);
   if(!product)return;
   const opts=pendingOptions.current;
   pendingOptions.current={};
   const result=productReply(product,opts);
   remember(result);
 }
 function chooseSize(productId,size){
   const product=catalog.find(p=>p.id===productId);
   if(!product)return;
   const result=productReply(product,{size,eggless:selected?.eggless||false,quantity:pendingOptions.current.quantity||1});
   remember(result);
 }
 function startChatOrder(){
   if(!cart.length){append({who:"bot",text:"Please select a cake and add it to your bag before starting your order."});return;}
   setOrdering(true);
 }
 function orderPlaced(receipt){
   if(confirmedReferences.current.has(receipt.reference))return;
   confirmedReferences.current.add(receipt.reference);
   append({who:"bot",text:"Thank you! Your Cake Galaxy order has been confirmed. Here are your order details:",receipt});
   setOrdering(false);
 }
 function addToBag(item){
   const product=catalog.find(p=>p.id===item?.productId);
   if(!product||!product.weights.includes(item.size)||product.photo)return;
   addItem(item);
   append({who:"bot",text:`${product.name} has been added to your bag. You can complete the order here in chat, or use regular checkout.`,orderChat:true,link:"/cart"});
 }
 return <>
   <button type="button" className={styles.launcher} onClick={()=>setOpen(value=>!value)} aria-label={open?"Close Cake Galaxy assistant":"Open Cake Galaxy assistant"} aria-expanded={open}> {open?"×":"Chat with us"} </button>
   {open&&<aside className={styles.panel} role="region" aria-label="Cake Galaxy shopping assistant">
     <header className={styles.header}><div className={styles.brandCopy}><strong>Cake Galaxy Assistant</strong><small>Here to help with cakes & orders</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close chat">×</button></header>
     {ordering ? <ChatOrderFlow onClose={()=>setOrdering(false)} onOrderPlaced={orderPlaced}/> : <>
     <div ref={chatFeedRef} className={styles.feed} aria-live="polite" aria-relevant="additions">
       {messages.map((m,index)=><div className={m.who==="user"?styles.user:styles.bot} key={index}>
          <p>{m.text}</p>
          {m.receipt&&<OrderReceipt receipt={m.receipt}/>}
          {Array.isArray(m.browseCategories)&&<CategoryPicker categories={m.browseCategories} onSelect={chooseCategory} disabled={working}/>}
          {Array.isArray(m.categoryProducts)&&<><CakeFlatList products={m.categoryProducts} onSelect={chooseProduct} disabled={working}/><button type="button" className={styles.browseAgain} disabled={working} onClick={browseCakes}>← Back to categories</button></>}
          {Array.isArray(m.choices)&&m.choices.map(c=><button className={styles.choice} type="button" key={c.id} disabled={working} onClick={()=>chooseProduct(c.id)}>{c.name}</button>)}
          {Array.isArray(m.sizes)&&<div className={styles.sizeGrid}>{m.sizes.map(size=><button className={styles.sizePill} type="button" key={String(size)} disabled={working} onClick={()=>chooseSize(m.productId,size)}>{size} {catalog.find(p=>p.id===m.productId)?.unit==="kg"?"kg":catalog.find(p=>p.id===m.productId)?.unit==="pieces"?"pieces":""}</button>)}</div>}
          {m.item&&<button type="button" disabled={working} className={styles.action} onClick={()=>addToBag(m.item)}>Add to bag</button>}
          {m.orderChat&&<button type="button" disabled={working} className={styles.action} onClick={startChatOrder}>Order through Chat</button>}
          {m.link&&<Link className={styles.actionLink} href={m.link} onClick={()=>setOpen(false)}>{m.link==="/cart"?"Review bag":m.link==="/orders"?"My Orders":m.link==="/custom"?"Custom Cakes":m.link.startsWith("/product")?"View product":m.link==="/shop"?"Browse cakes":"Help & contact"}</Link>}
        </div>)}
        {working&&<p className={styles.status} role="status">Checking your request…</p>}
     </div>
     <div className={styles.suggestions}>
       <button type="button" disabled={working} onClick={browseCakes}>Browse Cakes</button>
       <button type="button" disabled={working} onClick={startChatOrder}>Order through Chat{cart.length?` (${cart.length})`:""}</button>
       {["Chocolate cakes","Custom cakes","Delivery","My Orders"].map(v=><button key={v} type="button" disabled={working} onClick={()=>send(v)}>{v}</button>)}
     </div>
     <form className={styles.form} onSubmit={e=>{e.preventDefault();send(input);}}>
       <input aria-label="Ask the shopping assistant" placeholder="Ask about cakes or orders" value={input} onChange={e=>setInput(e.target.value)} maxLength={500} disabled={working}/>
       <button type="submit" disabled={working||!input.trim()}>Send</button>
     </form>
     </>}
     <footer className={styles.note}><span>Please never share OTPs or payment details in chat messages.</span><span className={styles.botCredit}>Powered by NC Bot™ · NC Groups</span></footer>
   </aside>}
 </>;
}
