import { unitPrice, money } from "@cake-galaxy/catalog";

// Never use fuzzy matching or an LLM to set final checkout totals.
const IGNORED=new Set("i want need please give me can you have do we a an the for my to of is are with and or this that one get buy order add cart bag cake cakes kg kilo kilogram eggless egless without egg half today tomorrow naliku naalaiku venum enaku ennaku bro hi hello dear sir madam birthday price cost how much what which any available show find options recommend suggest".split(" "));
const ALIAS={choclate:"chocolate",choclet:"chocolate",choco:"chocolate",choc:"chocolate",trufle:"truffle",truffel:"truffle",redvelvet:"red velvet",vanila:"vanilla",vannila:"vanilla",egles:"eggless",egless:"eggless",eggles:"eggless",blak:"black",forrest:"forest",strawbery:"strawberry"};
export function cleanWords(value){return String(value||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(Boolean).flatMap(x=>(ALIAS[x]||x).split(" "));}
function distance(a,b){if(Math.abs(a.length-b.length)>2)return 3;const r=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=r[0];r[0]=i;for(let j=1;j<=b.length;j++){const save=r[j];r[j]=Math.min(r[j]+1,r[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=save;}}return r[b.length];}
function similar(a,b){return a===b||(Math.min(a.length,b.length)>=5&&distance(a,b)<=(Math.max(a.length,b.length)>=9?2:1));}
export function findProducts(query,catalog){
 const withoutSize=String(query||"").replace(/\b\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|kilo|g|gm|grams?)\b/gi," ");
 const words=[...new Set(cleanWords(withoutSize).filter(x=>!IGNORED.has(x)&&!/^[0-9]+$/.test(x)))];
 if(!words.length)return [];
 return (Array.isArray(catalog)?catalog:[]).filter(p=>p&&p.id&&p.name&&Array.isArray(p.weights)&&p.weights.length).map(product=>{
 const pwords=[...new Set(cleanWords(product.name+" "+(product.flavour||"")))];
 const matched=words.filter(word=>pwords.some(w=>similar(word,w))).length;
 const score=matched/words.length+(matched>1?0.15:0);
 return {product,score,matched};
 }).filter(x=>x.matched&&x.score>=0.52).sort((a,b)=>b.score-a.score||a.product.name.localeCompare(b.product.name)).slice(0,4);
}
export function parseOptions(text){
 const numberWords={one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10"};
 const q=String(text||"").toLowerCase().replace(/-/g," ").replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?=kilograms?|kilos?|kg|cakes?|pieces?)/g,(all,num)=>numberWords[num]+" ");
 const kg=q.match(/\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilograms?)\b/);
 const gm=q.match(/\b(\d{3,4})\s*(g|gm|grams?)\b/);
 const size=kg?Number(kg[1]):gm?Number(gm[1])/1000:/\bhalf\s*(kg|kilo|kilogram)\b/.test(q)?0.5:null;
 const eggless=/\b(egg\s*less|egless|egles|eggless|without\s+eggs?)\b/.test(q)?true:/\b(with\s+egg|non\s*eggless)\b/.test(q)?false:null;
 const qty=q.match(/\b(?:quantity|qty|pieces|pcs)\s*[:=]?\s*(\d{1,2})\b/)||q.match(/\b(\d{1,2})\s+(?:cakes?|pieces?|pcs)\b/);
 return {size:Number.isFinite(size)&&size>0?size:null,eggless,quantity:qty?Math.min(20,Number(qty[1])):1};
}
export function productReply(product,options={}){
 if(!product||!Array.isArray(product.weights))return {text:"Please choose a cake from our current catalogue."};
 const size=options.size;
 if(size==null)return {text:`I found ${product.name}. Which size would you like? Available sizes: ${product.weights.map(w=>w+(product.unit==="kg"?" kg":product.unit==="pieces"?" pieces":"")).join(", ")}.`,productId:product.id,sizes:product.weights};
 if(!product.weights.includes(size))return {text:`That size is not available for ${product.name}. Please select a listed size.`,productId:product.id,sizes:product.weights};
 if(product.photo)return {text:`${product.name} requires a photo upload. Please open its product page to complete the design.`,productId:product.id,link:"/product?id="+encodeURIComponent(product.id)};
 const item={productId:product.id,size,quantity:Math.max(1,Math.min(20,Number(options.quantity)||1)),flavour:product.flavour||"",eggless:options.eggless===true,addons:[]};
 const price=unitPrice(item,product);
 if(!Number.isSafeInteger(price)||price<=0)return {text:`Please open ${product.name} to verify its current price and options.`,productId:product.id,link:"/product?id="+encodeURIComponent(product.id)};
 return {text:`${product.name}, ${size}${product.unit==="kg"?" kg":product.unit==="pieces"?" pieces":""}${item.eggless?", eggless":""}: ${money(price)} per cake. ${item.quantity>1?`Quantity: ${item.quantity}. `:""}Delivery and checkout charges are confirmed later. Would you like to add it to your bag?`,item,productId:product.id};
}
export function localAnswer(text,catalog,selected=null){
 const message=String(text||"").trim().slice(0,500),q=message.toLowerCase();
 if(!message)return {text:"Please type your question."};
 if(/\b(refund|cancel|cancellation|return)\b/.test(q))return {text:"You can request a cancellation from My Orders. The store reviews eligibility; refunds are not automatic.",link:"/orders"};
 if(/\b(order\s*status|track\s*(my\s*)?order|where\s*(is\s*)?my\s*order|my\s*orders)\b/.test(q))return {text:"Please sign in with your verified mobile number to check your order under My Orders.",link:"/orders"};
 if(/\b(custom|design|photo\s*cake|personalised|personalized)\b/.test(q))return {text:"For a custom or photo cake, upload your reference and requirements on the Custom Cakes page. The store will confirm the quotation.",link:"/custom"};
 if(/\b(allerg|nut.free|dairy.free|gluten.free)\b/.test(q))return {text:"Please contact Cake Galaxy about allergies before ordering. Eggless does not mean dairy-free or nut-free.",link:"/help"};
 if(/\b(deliver|delivery|pincode|postal\s*code|ship)\b/.test(q))return {text:"Please enter your six-digit delivery pincode. Availability and charges will be checked before checkout.",askPincode:true};
 const opts=parseOptions(message),matches=findProducts(message,catalog);
 if(matches.length){
  if(matches[0].score>=0.88&&(matches.length===1||matches[0].score-matches[1].score>0.13))return productReply(matches[0].product,opts);
  return {text:"I found a few possible cakes. Please choose one:",choices:matches.map(x=>({id:x.product.id,name:x.product.name}))};
 }
 if(selected&&/\b(yes|that|this|same|add|want|buy|order|kg|half|eggless|egless)\b/.test(q)){
  const product=(catalog||[]).find(x=>x.id===selected.productId);
  if(product)return productReply(product,{size:opts.size??selected.size??null,eggless:opts.eggless??selected.eggless??false,quantity:opts.quantity});
 }
 if(/^\s*(hi|hello|hey|good morning|good evening)[!. ]*$/i.test(message))return {text:"Hello! Welcome to Cake Galaxy. I can help you find a cake, check delivery, and prepare your order."};
 if(/\b(checkout|place\s*(an?\s*)?order|proceed\s*to\s*pay)\b/.test(q))return {text:"Please review your bag and complete the secure checkout. Phone verification, delivery details and payment are required.",link:"/cart"};
 if(/\b(price|cost|budget|how much|recommend|suggest|cakes|menu)\b/.test(q))return {text:"I can help you find a cake. What flavour, occasion, budget or size would you prefer?",link:"/shop"};
 return {text:"I can help with cake selection, prices, delivery, custom designs and orders. Please tell me what you need, or visit Help for other questions.",link:"/help"};
}
