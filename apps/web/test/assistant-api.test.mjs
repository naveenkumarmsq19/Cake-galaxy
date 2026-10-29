import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPost,onRequestGet} from "../../../functions/api/assistant.js";

const url="https://cakegalaxy.in/api/assistant";
function post(message,origin="https://cakegalaxy.in"){
 return new Request(url,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify({message})});
}

test("without Cloudflare AI binding, assistant gracefully falls back",async()=>{
 const response=await onRequestPost({request:post("choclate trufle cake"),env:{}});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{available:false,reason:"AI_NOT_CONFIGURED"});
});
test("AI adapter normalizes English and redacts sender phone numbers",async()=>{
 let called;
 const env={AI:{run:async(name,options)=>{called={name,options};return {response:JSON.stringify({english:"I would like a one-kilogram eggless chocolate truffle cake."})};}}};
 const response=await onRequestPost({request:post("choclate trufle cake 1kg egles 9876543210"),env});
 assert.equal((await response.json()).available,true);
 assert.equal(called.name,"@cf/meta/llama-3.1-8b-instruct");
 assert.doesNotMatch(called.options.messages[1].content,/9876543210/);
});
test("cross-origin, large and empty messages are rejected",async()=>{
 assert.equal((await onRequestPost({request:post("hi","https://bad.example"),env:{}})).status,403);
 assert.equal((await onRequestPost({request:post("x".repeat(501)),env:{}})).status,400);
 assert.equal((await onRequestPost({request:post(" " ),env:{}})).status,400);
 assert.equal((await onRequestGet()).status,405);
});
test("model failure returns deterministic fallback response, never orders",async()=>{
 const env={AI:{run:async()=>{throw Error("quota exceeded")}}};
 assert.deepEqual(await (await onRequestPost({request:post("cake"),env})).json(),{available:false,reason:"AI_UNAVAILABLE"});
});
