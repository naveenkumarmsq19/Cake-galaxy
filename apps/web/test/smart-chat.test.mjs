import test from "node:test";
import assert from "node:assert/strict";
import {findProducts,parseOptions,productReply,localAnswer,browsableCategories,productsInCategory,safeCakeImage} from "../src/components/salesAssistant.mjs";

const catalog=[
 {id:"truffle",name:"Chocolate Truffle Cake",price:44900,weights:[0.5,1,1.5],unit:"kg",flavour:"Chocolate",photo:false},
 {id:"velvet",name:"Red Velvet Cake",price:59900,weights:[0.5,1,1.5],unit:"kg",flavour:"Red Velvet",photo:false},
 {id:"chip",name:"Chocolate Chip Cake",price:47900,weights:[0.5,1],unit:"kg",flavour:"Chocolate",photo:false},
 {id:"photo",name:"Personalised Photo Cake",price:69900,weights:[0.5,1],unit:"kg",flavour:"Vanilla",photo:true}
];

test("spelling errors resolve to the intended cake without mutating catalogue",()=>{
 const result=findProducts("choclate trufle cake",catalog);
 assert.equal(result[0].product.id,"truffle");
 assert.equal(catalog[0].name,"Chocolate Truffle Cake");
});
test("eggless and kg are extracted without silently changing the requested product",()=>{
 assert.deepEqual(parseOptions("enaku choclate trufle cake 1kg egles venum"),{size:1,eggless:true,quantity:1});
 assert.equal(parseOptions("500gm without eggs").size,0.5);
 assert.equal(parseOptions("half kg").size,0.5);
});
test("real catalogue pricing and 1kg discount are reused",()=>{
 const result=localAnswer("choclate trufle cake 1kg egles venum",catalog);
 assert.equal(result.item.productId,"truffle");
 assert.equal(result.item.size,1);
 assert.equal(result.item.eggless,true);
 assert.match(result.text,/₹908\.20/);
});
test("no unapproved product price or size is invented",()=>{
 const result=productReply(catalog[0],{size:3});
 assert.equal(result.item,undefined);
 assert.ok(result.sizes.includes(1));
});
test("photo cake requires product workflow rather than direct cart mutation",()=>{
 const result=productReply(catalog[3],{size:1});
 assert.equal(result.item,undefined);
 assert.match(result.link,/\/product\?/);
});
test("follow-up sizes can be resolved from selection",()=>{
 const result=localAnswer("1kg eggless",catalog,{productId:"truffle",size:null,eggless:false});
 assert.equal(result.item.productId,"truffle");
 assert.equal(result.item.eggless,true);
});
test("uncertain product match offers choices, not an automatic add",()=>{
 const result=localAnswer("choclate cake",catalog);
 assert.equal(result.item,undefined);
 assert.ok(result.choices.length>1);
});
test("order tracking and cancellations use authenticated checkout pages",()=>{
 assert.equal(localAnswer("track my order",catalog).link,"/orders");
 assert.equal(localAnswer("cancel order",catalog).link,"/orders");
});
test("unsupported allergy claims are not made",()=>{
 assert.match(localAnswer("is it nut free",catalog).text,/contact Cake Galaxy/);
});
test("no direct order submission is ever produced by the parser",()=>{
 const result=localAnswer("place order",catalog);
 assert.equal(result.link,"/cart");
 assert.equal(result.item,undefined);
});

test("English number words remain valid after AI grammar normalization",()=>{
 const opts=parseOptions("I would like a one-kilogram eggless chocolate truffle cake");
 assert.equal(opts.size,1);
 assert.equal(opts.eggless,true);
 assert.equal(parseOptions("two cakes, 500 grams each").quantity,2);
});

test("assistant does not promise an unavailable eggless product",()=>{
 const result=productReply({...catalog[0],eggless:false},{size:1,eggless:true});
 assert.equal(result.item,undefined);
 assert.match(result.text,/Eggless is not currently available/);
});

test("unknown flavour asks for live cake categories instead of guessing",()=>{
 const listed=[{...catalog[0],category:["Chocolate Flavours"],image:"/images/choco.jpg",images:["/images/new-choco.webp"]},{...catalog[1],category:["Velvet Flavours"],image:"/images/velvet.jpg"}];
 const categories=[{name:"Chocolate Flavours",active:true,image:"/images/choco-category.jpg"},{name:"Velvet Flavours",active:true},{name:"Hidden",active:false}];
 const result=localAnswer("I have no idea which flavour",listed,null,categories);
 assert.equal(result.browseCategories.length,2);
 assert.equal(result.browseCategories[0].image,"/images/choco-category.jpg");
 assert.equal(result.browseCategories.some(c=>c.name==="Hidden"),false);
 assert.deepEqual(productsInCategory(listed,"Chocolate Flavours").map(c=>c.id),["truffle"]);
});
test("browsing category then selecting a cake returns the existing size and cart flow",()=>{
 const cake={...catalog[0],category:["Chocolate Flavours"],weights:[0.5,1,2,3,4,5]};
 const result=productReply(productsInCategory([cake],"Chocolate Flavours")[0],{});
 assert.deepEqual(result.sizes,[0.5,1,2,3,4,5]);
 const selected=productReply(cake,{size:2,eggless:true});
 assert.equal(selected.item.productId,"truffle");
 assert.equal(selected.item.size,2);
});
test("unsupported 1.5kg, 2.5kg and sizes over 5kg never enter the cart",()=>{
 const legacy={...catalog[0],weights:[0.5,1,1.5,2,2.5,3,4,5,10]};
 const result=productReply(legacy,{size:1.5});
 assert.equal(result.item,undefined);
 assert.deepEqual(result.sizes,[0.5,1,2,3,4,5]);
 assert.equal(productReply(legacy,{size:10}).item,undefined);
});
test("cake images use live galleries with a safe fallback for invalid URLs",()=>{
 assert.equal(safeCakeImage("/api/product-images/ab123"),"/api/product-images/ab123");
 assert.equal(safeCakeImage("https://ik.imagekit.io/cakes/a.webp"),"https://ik.imagekit.io/cakes/a.webp");
 assert.equal(safeCakeImage("javascript:alert(1)"),"/images/celebration.jpg");
});
