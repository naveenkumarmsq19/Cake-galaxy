"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "./Storefront";
import { localAnswer, parseOptions, productReply } from "./salesAssistant.mjs";
import { scrollChatToBottom } from "./chatScroll.mjs";
import styles from "./SmartChat.module.css";

const greeting={who:"bot",text:"Welcome to Cake Galaxy! Tell me the cake or occasion you have in mind. I can help you choose a cake, add it to your bag, and guide you through checkout."};
const limited=(items)=>items.slice(-28);

export default function SmartChat(){
 const {catalog,catalogLoaded,checkDelivery,addItem,hydrated}=useStore();
 const [open,setOpen]=useState(false);
 const [messages,setMessages]=useState([greeting]);
 const [input,setInput]=useState("");
 const [working,setWorking]=useState(false);
 const [selected,setSelected]=useState(null);
 const pendingOptions=useRef({});
 const chatFeedRef=useRef(null);
 // Always reveal the latest conversation when opened or updated.
 // The second scroll runs after the browser calculates the new layout.
 useLayoutEffect(()=>{
   if(!open)return;
   const feed=chatFeedRef.current;
   if(!feed)return;
   scrollChatToBottom(feed);
   const frame=requestAnimationFrame(()=>scrollChatToBottom(feed));
   return ()=>cancelAnimationFrame(frame);
 },[open,messages,working]);
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
     const answer=localAnswer(understood,catalog,selected);
     pendingOptions.current=parseOptions(understood);
     remember(answer);
   }catch{remember({text:"I could not verify that information right now. Please try again or use the regular checkout."});}
   finally{setWorking(false);}
 }
 function chooseProduct(id){
   const product=catalog.find(p=>p.id===id);
   if(!product)return;
   const opts=pendingOptions.current;
   const result=productReply(product,opts);
   remember(result);
 }
 function chooseSize(productId,size){
   const product=catalog.find(p=>p.id===productId);
   if(!product)return;
   const result=productReply(product,{size,eggless:selected?.eggless||false,quantity:pendingOptions.current.quantity||1});
   remember(result);
 }
 function addToBag(item){
   const product=catalog.find(p=>p.id===item?.productId);
   if(!product||!product.weights.includes(item.size)||product.photo)return;
   addItem(item);
   append({who:"bot",text:`${product.name} has been added to your bag. Review your delivery details and complete the order through secure checkout.`,link:"/cart"});
 }
 return <>
   <button type="button" className={styles.launcher} onClick={()=>setOpen(value=>!value)} aria-label={open?"Close Cake Galaxy assistant":"Open Cake Galaxy assistant"} aria-expanded={open}> {open?"×":"Chat with us"} </button>
   {open&&<aside className={styles.panel} role="region" aria-label="Cake Galaxy shopping assistant">
     <header className={styles.header}><div><strong>Cake Galaxy Assistant</strong><small>Ask a question or get help ordering</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close chat">×</button></header>
     <div ref={chatFeedRef} className={styles.feed} aria-live="polite" aria-relevant="additions">
       {messages.map((m,index)=><div className={m.who==="user"?styles.user:styles.bot} key={index}>
          <p>{m.text}</p>
          {Array.isArray(m.choices)&&m.choices.map(c=><button className={styles.choice} type="button" key={c.id} disabled={working} onClick={()=>chooseProduct(c.id)}>{c.name}</button>)}
          {Array.isArray(m.sizes)&&m.sizes.map(size=><button className={styles.choice} type="button" key={String(size)} disabled={working} onClick={()=>chooseSize(m.productId,size)}>{size} kg</button>)}
          {m.item&&<button type="button" disabled={working} className={styles.action} onClick={()=>addToBag(m.item)}>Add to bag</button>}
          {m.link&&<Link className={styles.actionLink} href={m.link} onClick={()=>setOpen(false)}>{m.link==="/cart"?"Review bag":m.link==="/orders"?"My Orders":m.link==="/custom"?"Custom Cakes":m.link.startsWith("/product")?"View product":m.link==="/shop"?"Browse cakes":"Help & contact"}</Link>}
        </div>)}
        {working&&<p className={styles.status} role="status">Checking your request…</p>}
     </div>
     <div className={styles.suggestions}>
       {["Chocolate cakes","Custom cakes","Delivery","My Orders"].map(v=><button key={v} type="button" disabled={working} onClick={()=>send(v)}>{v}</button>)}
     </div>
     <form className={styles.form} onSubmit={e=>{e.preventDefault();send(input);}}>
       <input aria-label="Ask the shopping assistant" placeholder="Ask about cakes or orders" value={input} onChange={e=>setInput(e.target.value)} maxLength={500} disabled={working}/>
       <button type="submit" disabled={working||!input.trim()}>Send</button>
     </form>
     <p className={styles.note}>Prices, delivery and orders are confirmed during checkout. Do not share OTPs or payment details in chat.</p>
   </aside>}
 </>;
}
