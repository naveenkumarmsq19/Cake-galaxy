import test from "node:test";
import assert from "node:assert/strict";
import {findProducts,parseOptions,productReply,localAnswer} from "../src/components/salesAssistant.mjs";

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
