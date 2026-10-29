import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat=readFileSync(new URL("../src/components/SmartChat.jsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/components/SmartChat.module.css",import.meta.url),"utf8");

test("Cake Galaxy is the primary chatbot brand in header and welcome message",()=>{
  assert.match(chat,/Cake Galaxy Assistant<\/strong>/);
  assert.match(chat,/Welcome to Cake Galaxy!/);
  assert.match(chat,/\{open\?"×":"Chat with us"\}/);
});

test("NC Bot attribution appears only once, in a discreet footer",()=>{
  assert.equal([...chat.matchAll(/NC Bot™/g)].length,1);
  assert.match(chat,/<footer className=\{styles.note\}>[\s\S]*?<span className=\{styles.botCredit\}>Powered by NC Bot™ · NC Groups<\/span><\/footer>/);
  assert.match(css,/\.botCredit\{[^}]*font-size:9px/);
  assert.doesNotMatch(chat,/<strong>NC Bot/);
});

test("security reminder stays visible and separate from bot branding",()=>{
  assert.match(chat,/Please never share OTPs or payment details in chat messages/);
});
